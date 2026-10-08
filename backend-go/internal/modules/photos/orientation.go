package photos

import (
	"bytes"
	"encoding/binary"
	"image"
)

// orientationTag is the EXIF tag 274 that tells how to turn the stored pixels.
const orientationTag = 0x0112

// Orientation reads the EXIF orientation (1 to 8) of a JPEG. It gives 1 when
// the file is not a JPEG or has no valid tag.
func Orientation(raw []byte) int {
	if len(raw) < 4 || raw[0] != 0xff || raw[1] != 0xd8 {
		return 1
	}
	for at := 2; at+4 <= len(raw); {
		if raw[at] != 0xff {
			return 1
		}
		marker := raw[at+1]
		if marker == 0xff {
			at++
			continue
		}
		if marker == 0xda || marker == 0xd9 {
			return 1
		}
		length := int(binary.BigEndian.Uint16(raw[at+2:]))
		end := at + 2 + length
		if length < 2 || end > len(raw) {
			return 1
		}
		segment := raw[at+4 : end]
		if marker == 0xe1 && bytes.HasPrefix(segment, []byte("Exif\x00\x00")) {
			return tiffOrientation(segment[6:])
		}
		at = end
	}
	return 1
}

func tiffOrientation(tiff []byte) int {
	if len(tiff) < 8 {
		return 1
	}
	var order binary.ByteOrder
	switch string(tiff[:2]) {
	case "II":
		order = binary.LittleEndian
	case "MM":
		order = binary.BigEndian
	default:
		return 1
	}
	if order.Uint16(tiff[2:]) != 42 {
		return 1
	}
	ifd := int(order.Uint32(tiff[4:]))
	if ifd < 8 || ifd+2 > len(tiff) {
		return 1
	}
	count := int(order.Uint16(tiff[ifd:]))
	for i := range count {
		entry := ifd + 2 + i*12
		if entry+12 > len(tiff) {
			return 1
		}
		if order.Uint16(tiff[entry:]) != orientationTag {
			continue
		}
		if order.Uint16(tiff[entry+2:]) != 3 {
			return 1
		}
		value := int(order.Uint16(tiff[entry+8:]))
		if value < 1 || value > 8 {
			return 1
		}
		return value
	}
	return 1
}

// Orient turns the pixels so that the image shows upright for the EXIF
// orientation. The result does not need the tag any more.
func Orient(src *image.RGBA, orientation int) *image.RGBA {
	if orientation <= 1 || orientation > 8 {
		return src
	}
	w, h := src.Bounds().Dx(), src.Bounds().Dy()
	swap := orientation >= 5
	dw, dh := w, h
	if swap {
		dw, dh = h, w
	}
	out := image.NewRGBA(image.Rect(0, 0, dw, dh))
	for y := range dh {
		for x := range dw {
			sx, sy := sourceOf(orientation, x, y, w, h)
			from := src.PixOffset(sx, sy)
			copy(out.Pix[out.PixOffset(x, y):out.PixOffset(x, y)+4], src.Pix[from:from+4])
		}
	}
	return out
}

// sourceOf maps a pixel of the upright image to the stored pixel of a w by h image.
func sourceOf(orientation, x, y, w, h int) (int, int) {
	switch orientation {
	case 2:
		return w - 1 - x, y
	case 3:
		return w - 1 - x, h - 1 - y
	case 4:
		return x, h - 1 - y
	case 5:
		return y, x
	case 6:
		return y, h - 1 - x
	case 7:
		return w - 1 - y, h - 1 - x
	default:
		return w - 1 - y, x
	}
}
