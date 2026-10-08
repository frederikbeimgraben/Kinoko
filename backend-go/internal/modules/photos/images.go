package photos

import (
	"bytes"
	"errors"
	"fmt"
	"image"
	"image/color"
	"image/jpeg"
	"math"
	"os"
	"path/filepath"
	"slices"

	// The decoders register their formats. The old service read each format that Pillow reads.
	_ "image/gif"
	_ "image/png"

	"golang.org/x/image/draw"

	_ "golang.org/x/image/bmp"
	_ "golang.org/x/image/tiff"
	_ "golang.org/x/image/webp"

	"github.com/frederikbeimgraben/kinoko/backend/internal/core/db"
	"github.com/frederikbeimgraben/kinoko/backend/internal/core/enums"
	"github.com/frederikbeimgraben/kinoko/backend/internal/core/problem"
	"github.com/frederikbeimgraben/kinoko/backend/internal/fn"
)

// MediaTypes are the content types that an upload can have.
var MediaTypes = []string{"image/jpeg", "image/png", "image/webp"}

// Edges gives the longest edge in pixels of each size.
var Edges = map[enums.PhotoSize]int{
	enums.PhotoSizeThumb: 88,
	enums.PhotoSizeList:  320,
	enums.PhotoSizeFull:  1600,
}

// Quality is the JPEG quality of each written size.
const Quality = 85

// maxPixels is the decompression bomb limit of Pillow: two times MAX_IMAGE_PIXELS.
const maxPixels = 2 * 89_478_485

// Rendered is one image in each size, with the dimensions of the upright original.
type Rendered struct {
	Width  int
	Height int
	Files  map[enums.PhotoSize][]byte
}

// Accept checks an uploaded image and makes each size. It turns a JPEG upright by
// its EXIF orientation and keeps no metadata: each size is a new JPEG.
func Accept(raw []byte, mediaType string, limit int64) (Rendered, error) {
	if !slices.Contains(MediaTypes, mediaType) {
		return Rendered{}, problem.InvalidField("file", "media_type")
	}
	if int64(len(raw)) > limit {
		return Rendered{}, problem.TooLarge()
	}
	decoded, err := decode(raw)
	if err != nil {
		return Rendered{}, problem.InvalidField("file", "image")
	}
	clean := Orient(rgb(decoded), Orientation(raw))
	files, err := encodeAll(clean)
	if err != nil {
		return Rendered{}, err
	}
	bounds := clean.Bounds()
	return Rendered{Width: bounds.Dx(), Height: bounds.Dy(), Files: files}, nil
}

func decode(raw []byte) (image.Image, error) {
	config, _, err := image.DecodeConfig(bytes.NewReader(raw))
	if err != nil {
		return nil, err
	}
	if config.Width <= 0 || config.Height <= 0 || int64(config.Width)*int64(config.Height) > maxPixels {
		return nil, errors.New("image dimensions out of range")
	}
	decoded, _, err := image.Decode(bytes.NewReader(raw))
	return decoded, err
}

// rgb copies the colour channels without alpha, as Pillow's convert("RGB")
// does. The values are not premultiplied, so a transparent pixel keeps its colour.
func rgb(src image.Image) *image.RGBA {
	bounds := src.Bounds()
	out := image.NewRGBA(image.Rect(0, 0, bounds.Dx(), bounds.Dy()))
	if opaque, ok := src.(interface{ Opaque() bool }); ok && opaque.Opaque() {
		draw.Draw(out, out.Bounds(), src, bounds.Min, draw.Src)
		return out
	}
	if nrgba, ok := src.(*image.NRGBA); ok {
		for y := range bounds.Dy() {
			row := nrgba.Pix[nrgba.PixOffset(bounds.Min.X, bounds.Min.Y+y):]
			line := out.Pix[y*out.Stride:]
			for x := range bounds.Dx() {
				copy(line[x*4:x*4+3], row[x*4:x*4+3])
				line[x*4+3] = 0xff
			}
		}
		return out
	}
	for y := bounds.Min.Y; y < bounds.Max.Y; y++ {
		for x := bounds.Min.X; x < bounds.Max.X; x++ {
			c := color.NRGBAModel.Convert(src.At(x, y)).(color.NRGBA)
			out.SetRGBA(x-bounds.Min.X, y-bounds.Min.Y, color.RGBA{R: c.R, G: c.G, B: c.B, A: 0xff})
		}
	}
	return out
}

func encodeAll(clean *image.RGBA) (map[enums.PhotoSize][]byte, error) {
	sizes := enums.PhotoSizeValues
	encoded, err := fn.MapErr(sizes, func(size enums.PhotoSize) ([]byte, error) {
		return scaled(clean, Edges[size])
	})
	if err != nil {
		return nil, err
	}
	return fn.Reduce(fn.Zip(sizes, encoded), map[enums.PhotoSize][]byte{},
		func(acc map[enums.PhotoSize][]byte, pair fn.Pair[enums.PhotoSize, []byte]) map[enums.PhotoSize][]byte {
			acc[pair.First] = pair.Second
			return acc
		}), nil
}

// scaled fits the image into a square of edge pixels and writes a JPEG.
// It never makes the image larger.
func scaled(src *image.RGBA, edge int) ([]byte, error) {
	bounds := src.Bounds()
	width, height := Fit(bounds.Dx(), bounds.Dy(), edge)
	target := image.Image(src)
	if width != bounds.Dx() || height != bounds.Dy() {
		resized := image.NewRGBA(image.Rect(0, 0, width, height))
		draw.CatmullRom.Scale(resized, resized.Bounds(), src, bounds, draw.Src, nil)
		target = resized
	}
	var buffer bytes.Buffer
	if err := jpeg.Encode(&buffer, target, &jpeg.Options{Quality: Quality}); err != nil {
		return nil, fmt.Errorf("encode jpeg: %w", err)
	}
	return buffer.Bytes(), nil
}

// Fit gives the size of Pillow's thumbnail((edge, edge)) for an image of
// width by height. Each side stays at one pixel or more.
func Fit(width, height, edge int) (int, int) {
	if edge >= width && edge >= height {
		return width, height
	}
	aspect := float64(width) / float64(height)
	x, y := float64(edge), float64(edge)
	if x/y >= aspect {
		return roundAspect(y*aspect, func(n float64) float64 { return math.Abs(aspect - n/y) }), edge
	}
	return edge, roundAspect(x/aspect, func(n float64) float64 {
		if n == 0 {
			return 0
		}
		return math.Abs(aspect - x/n)
	})
}

// roundAspect picks floor or ceil of number by the smaller key. The floor
// wins a tie, as in Python's min.
func roundAspect(number float64, key func(float64) float64) int {
	low, high := math.Floor(number), math.Ceil(number)
	chosen := low
	if key(high) < key(low) {
		chosen = high
	}
	return max(int(chosen), 1)
}

// FolderOf is the folder of a photo: the key with dashes, under root.
func FolderOf(root string, id db.ID) string {
	return filepath.Join(root, id.String())
}

// FileOf is the file of one size of a photo.
func FileOf(root string, id db.ID, size enums.PhotoSize) string {
	return filepath.Join(FolderOf(root, id), string(size)+".jpg")
}

// WriteFiles stores each size of a photo. A new file replaces an old file
// in one step, so a reader never sees half a file.
func WriteFiles(root string, id db.ID, rendered Rendered) error {
	folder := FolderOf(root, id)
	if err := os.MkdirAll(folder, 0o755); err != nil {
		return err
	}
	for _, size := range enums.PhotoSizeValues {
		if err := writeAtomic(FileOf(root, id, size), rendered.Files[size]); err != nil {
			return err
		}
	}
	return nil
}

func writeAtomic(path string, data []byte) error {
	temp, err := os.CreateTemp(filepath.Dir(path), ".upload-*")
	if err != nil {
		return err
	}
	_, writeErr := temp.Write(data)
	closeErr := temp.Close()
	if err := errors.Join(writeErr, closeErr); err != nil {
		_ = os.Remove(temp.Name())
		return err
	}
	if err := os.Chmod(temp.Name(), 0o644); err != nil {
		_ = os.Remove(temp.Name())
		return err
	}
	return os.Rename(temp.Name(), path)
}

// PathOf gives the file of one size of a photo, or false when it is missing.
func PathOf(root string, id db.ID, size enums.PhotoSize) (string, bool) {
	path := FileOf(root, id, size)
	info, err := os.Stat(path)
	return path, err == nil && info.Mode().IsRegular()
}

// RemoveFiles deletes the folder of each photo. A missing folder is not an error.
func RemoveFiles(root string, ids []db.ID) error {
	return errors.Join(fn.Map(ids, func(id db.ID) error {
		return os.RemoveAll(FolderOf(root, id))
	})...)
}
