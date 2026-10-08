package photos

import (
	"image"
	"image/color"
	"testing"
)

func TestRGBKeepsTheColourOfTransparentPixelsOfEachDecoderType(t *testing.T) {
	wide := image.NewNRGBA64(image.Rect(0, 0, 2, 1))
	wide.SetNRGBA64(0, 0, color.NRGBA64{R: 0xc8ff, G: 0x0a00, B: 0x1400, A: 0})
	wide.SetNRGBA64(1, 0, color.NRGBA64{R: 0x6400, G: 0x3200, B: 0x1900, A: 0x8000})
	webp := image.NewNYCbCrA(image.Rect(0, 0, 2, 2), image.YCbCrSubsampleRatio444)
	y, cb, cr := color.RGBToYCbCr(200, 10, 20)
	for i := range webp.Y {
		webp.Y[i], webp.Cb[i], webp.Cr[i], webp.A[i] = y, cb, cr, 0
	}
	wr, wg, wb := color.YCbCrToRGB(y, cb, cr)
	cases := []struct {
		name string
		src  image.Image
		want []color.RGBA
	}{
		{"NRGBA64", wide, []color.RGBA{{200, 10, 20, 0xff}, {100, 50, 25, 0xff}}},
		{"NYCbCrA", webp, []color.RGBA{{wr, wg, wb, 0xff}, {wr, wg, wb, 0xff}}},
	}
	for _, c := range cases {
		out := rgb(c.src)
		for x, want := range c.want {
			if got := out.RGBAAt(x, 0); got != want {
				t.Errorf("%s pixel %d: %v, expected %v", c.name, x, got, want)
			}
		}
	}
	if wr < 150 {
		t.Fatal(wr)
	}
}
