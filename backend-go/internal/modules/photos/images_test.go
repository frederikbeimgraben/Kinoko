package photos_test

import (
	"bytes"
	"errors"
	"image"
	"image/color"
	"image/jpeg"
	"image/png"
	"os"
	"testing"

	"github.com/frederikbeimgraben/kinoko/backend/internal/core/db"
	"github.com/frederikbeimgraben/kinoko/backend/internal/core/enums"
	"github.com/frederikbeimgraben/kinoko/backend/internal/core/problem"
	"github.com/frederikbeimgraben/kinoko/backend/internal/modules/photos"
)

func jpegSize(t *testing.T, path string) (int, int) {
	t.Helper()
	raw, err := os.ReadFile(path)
	if err != nil {
		t.Fatal(err)
	}
	config, err := jpeg.DecodeConfig(bytes.NewReader(raw))
	if err != nil {
		t.Fatal(err)
	}
	return config.Width, config.Height
}

func codeOf(err error) string {
	var p *problem.Problem
	if errors.As(err, &p) {
		if len(p.Errors) > 0 {
			return p.Code + "/" + p.Errors[0].Field + "/" + p.Errors[0].Code
		}
		return p.Code
	}
	return ""
}

func TestAcceptRendersThreeSizes(t *testing.T) {
	rendered, err := photos.Accept(imageBytes(t, 40, 30), "image/jpeg", 1<<20)
	if err != nil {
		t.Fatal(err)
	}
	if rendered.Width != 40 || rendered.Height != 30 || len(rendered.Files) != len(enums.PhotoSizeValues) {
		t.Fatal(rendered.Width, rendered.Height, len(rendered.Files))
	}
	for size, data := range rendered.Files {
		if len(data) < 2 || data[0] != 0xff || data[1] != 0xd8 {
			t.Errorf("%s is not a JPEG", size)
		}
	}
}

func TestAcceptRefusesWrongTypeAndSize(t *testing.T) {
	cases := []struct {
		raw       []byte
		mediaType string
		limit     int64
		want      string
	}{
		{imageBytes(t, 40, 30), "text/plain", 1 << 20, "validation/file/media_type"},
		{imageBytes(t, 40, 30), "image/jpeg", 10, "too_large"},
		{[]byte("kein Bild"), "image/jpeg", 1 << 20, "validation/file/image"},
	}
	for _, c := range cases {
		if _, err := photos.Accept(c.raw, c.mediaType, c.limit); codeOf(err) != c.want {
			t.Errorf("%s: %v", c.want, err)
		}
	}
}

func TestWriteReadRemove(t *testing.T) {
	root := t.TempDir()
	id := db.NewID()
	rendered, err := photos.Accept(imageBytes(t, 40, 30), "image/jpeg", 1<<20)
	if err != nil {
		t.Fatal(err)
	}
	if err := photos.WriteFiles(root, id, rendered); err != nil {
		t.Fatal(err)
	}
	if path, ok := photos.PathOf(root, id, enums.PhotoSizeThumb); !ok || path != root+"/"+id.String()+"/thumb.jpg" {
		t.Fatal(path, ok)
	}
	if err := photos.RemoveFiles(root, []db.ID{id}); err != nil {
		t.Fatal(err)
	}
	if _, ok := photos.PathOf(root, id, enums.PhotoSizeFull); ok {
		t.Fatal("file still exists")
	}
	if err := photos.RemoveFiles(root, []db.ID{id}); err != nil {
		t.Fatal(err)
	}
}

// exifJPEG puts an APP1 Exif segment after the start marker.
func exifJPEG(t *testing.T) []byte {
	raw := imageBytes(t, 8, 8)
	payload := append([]byte("Exif\x00\x00"), []byte("GPS etwas")...)
	segment := append([]byte{0xff, 0xe1, byte((len(payload) + 2) >> 8), byte(len(payload) + 2)}, payload...)
	return append(append(append([]byte{}, raw[:2]...), segment...), raw[2:]...)
}

func TestStripMetadataDropsExif(t *testing.T) {
	raw := exifJPEG(t)
	if !bytes.Contains(raw, []byte("Exif")) {
		t.Fatal("fixture has no Exif")
	}
	rendered, err := photos.Accept(raw, "image/jpeg", 1<<20)
	if err != nil {
		t.Fatal(err)
	}
	if rendered.Width != 8 || rendered.Height != 8 {
		t.Fatal(rendered.Width, rendered.Height)
	}
	for size, data := range rendered.Files {
		if bytes.Contains(data, []byte("Exif")) || bytes.Contains(data, []byte("GPS")) {
			t.Errorf("%s keeps metadata", size)
		}
	}
}

func TestAcceptReadsPNGAndKeepsColourOfTransparentPixels(t *testing.T) {
	made := image.NewNRGBA(image.Rect(0, 0, 4, 4))
	for y := range 4 {
		for x := range 4 {
			made.SetNRGBA(x, y, color.NRGBA{R: 200, G: 10, B: 10, A: 0})
		}
	}
	var buffer bytes.Buffer
	if err := png.Encode(&buffer, made); err != nil {
		t.Fatal(err)
	}
	rendered, err := photos.Accept(buffer.Bytes(), "image/png", 1<<20)
	if err != nil {
		t.Fatal(err)
	}
	decoded, err := jpeg.Decode(bytes.NewReader(rendered.Files[enums.PhotoSizeFull]))
	if err != nil {
		t.Fatal(err)
	}
	r, _, _, _ := decoded.At(1, 1).RGBA()
	if r>>8 < 150 {
		t.Fatalf("red channel %d: alpha was premultiplied", r>>8)
	}
}

// The sizes come from Pillow's Image.thumbnail of the old service.
func TestFitMatchesPillowThumbnail(t *testing.T) {
	cases := []struct{ w, h, edge, ww, wh int }{
		{1000, 333, 88, 88, 29}, {1000, 333, 320, 320, 107}, {1000, 333, 1600, 1000, 333},
		{333, 1000, 88, 29, 88}, {333, 1000, 320, 107, 320},
		{2000, 1500, 88, 88, 66}, {2000, 1500, 320, 320, 240}, {2000, 1500, 1600, 1600, 1200},
		{1601, 3, 88, 88, 1}, {1601, 3, 1600, 1600, 3}, {3, 1601, 320, 1, 320},
		{7, 1000, 88, 1, 88}, {7, 1000, 320, 2, 320},
		{999, 1000, 88, 88, 88}, {999, 1000, 320, 320, 320}, {999, 1000, 1600, 999, 1000},
	}
	for _, c := range cases {
		if w, h := photos.Fit(c.w, c.h, c.edge); w != c.ww || h != c.wh {
			t.Errorf("%dx%d at %d: %dx%d, want %dx%d", c.w, c.h, c.edge, w, h, c.ww, c.wh)
		}
	}
}
