package photos_test

import (
	"bytes"
	"image"
	"image/color"
	"image/jpeg"
	"testing"

	"github.com/frederikbeimgraben/kinoko/backend/internal/core/enums"
	"github.com/frederikbeimgraben/kinoko/backend/internal/modules/photos"
)

// withOrientation puts an APP1 Exif segment with tag 274 after the start marker.
func withOrientation(raw []byte, orientation byte, bigEndian bool) []byte {
	tiff := []byte("II*\x00\x08\x00\x00\x00\x01\x00\x12\x01\x03\x00\x01\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00")
	tiff[18] = orientation
	if bigEndian {
		tiff = []byte("MM\x00*\x00\x00\x00\x08\x00\x01\x01\x12\x00\x03\x00\x00\x00\x01\x00\x00\x00\x00\x00\x00\x00\x00")
		tiff[19] = orientation
	}
	payload := append([]byte("Exif\x00\x00"), tiff...)
	segment := append([]byte{0xff, 0xe1, byte((len(payload) + 2) >> 8), byte(len(payload) + 2)}, payload...)
	return append(append(append([]byte{}, raw[:2]...), segment...), raw[2:]...)
}

// halves gives a JPEG whose left half is red and right half is blue.
func halves(t *testing.T, width, height int) []byte {
	t.Helper()
	made := image.NewRGBA(image.Rect(0, 0, width, height))
	for y := range height {
		for x := range width {
			c := color.RGBA{R: 230, G: 10, B: 10, A: 255}
			if x >= width/2 {
				c = color.RGBA{R: 10, G: 10, B: 230, A: 255}
			}
			made.Set(x, y, c)
		}
	}
	var buffer bytes.Buffer
	if err := jpeg.Encode(&buffer, made, &jpeg.Options{Quality: 100}); err != nil {
		t.Fatal(err)
	}
	return buffer.Bytes()
}

func TestOrientationReadsTag274(t *testing.T) {
	raw := imageBytes(t, 8, 8)
	for _, big := range []bool{false, true} {
		for o := byte(1); o <= 8; o++ {
			if got := photos.Orientation(withOrientation(raw, o, big)); got != int(o) {
				t.Errorf("orientation %d (big endian %v): %d", o, big, got)
			}
		}
	}
	if photos.Orientation(raw) != 1 || photos.Orientation([]byte("kein Bild")) != 1 {
		t.Fatal("no tag must give 1")
	}
	if photos.Orientation(withOrientation(raw, 9, false)) != 1 {
		t.Fatal("a value out of range must give 1")
	}
}

func TestOrientTurnsEachCornerToItsPlace(t *testing.T) {
	// Stored 3x2 image: each corner has its own red value.
	corner := map[string]uint8{"TL": 10, "TR": 20, "BL": 30, "BR": 40}
	src := image.NewRGBA(image.Rect(0, 0, 3, 2))
	src.SetRGBA(0, 0, color.RGBA{R: corner["TL"], A: 255})
	src.SetRGBA(2, 0, color.RGBA{R: corner["TR"], A: 255})
	src.SetRGBA(0, 1, color.RGBA{R: corner["BL"], A: 255})
	src.SetRGBA(2, 1, color.RGBA{R: corner["BR"], A: 255})
	// Stored corner at the upright top left and top right, by orientation.
	want := map[int][2]string{
		1: {"TL", "TR"}, 2: {"TR", "TL"}, 3: {"BR", "BL"}, 4: {"BL", "BR"},
		5: {"TL", "BL"}, 6: {"BL", "TL"}, 7: {"BR", "TR"}, 8: {"TR", "BR"},
	}
	for o, corners := range want {
		out := photos.Orient(src, o)
		w, h := out.Bounds().Dx(), out.Bounds().Dy()
		if (o >= 5) != (w == 2 && h == 3) {
			t.Errorf("orientation %d: size %dx%d", o, w, h)
			continue
		}
		if out.RGBAAt(0, 0).R != corner[corners[0]] || out.RGBAAt(w-1, 0).R != corner[corners[1]] {
			t.Errorf("orientation %d: corners %d, %d", o, out.RGBAAt(0, 0).R, out.RGBAAt(w-1, 0).R)
		}
	}
}

func TestAcceptAppliesExifOrientation(t *testing.T) {
	raw := withOrientation(halves(t, 80, 40), 6, false)
	rendered, err := photos.Accept(raw, "image/jpeg", 1<<20)
	if err != nil {
		t.Fatal(err)
	}
	if rendered.Width != 40 || rendered.Height != 80 {
		t.Fatalf("size %dx%d", rendered.Width, rendered.Height)
	}
	full, err := jpeg.Decode(bytes.NewReader(rendered.Files[enums.PhotoSizeFull]))
	if err != nil {
		t.Fatal(err)
	}
	if full.Bounds().Dx() != 40 || full.Bounds().Dy() != 80 {
		t.Fatal(full.Bounds())
	}
	top, _, topBlue, _ := full.At(20, 5).RGBA()
	bottom, _, bottomBlue, _ := full.At(20, 75).RGBA()
	if top>>8 < 150 || topBlue>>8 > 100 || bottomBlue>>8 < 150 || bottom>>8 > 100 {
		t.Fatalf("top %d/%d bottom %d/%d", top>>8, topBlue>>8, bottom>>8, bottomBlue>>8)
	}
	if bytes.Contains(rendered.Files[enums.PhotoSizeFull], []byte("Exif")) {
		t.Fatal("the tag is still there")
	}
}
