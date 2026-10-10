package geo

import "math"

// Constants of the XYZ tile grid and of the byte coding.
const (
	// Rand is half the width of the web mercator world, in metres.
	Rand = 20037508.342789244
	// TileSize is the edge of a tile in points.
	TileSize = 256
	// Steps is the number of byte steps over the scale 0 to 1.
	Steps = 254.0
	// ZoomBase is the coarsest zoom of a pyramid.
	ZoomBase = 5
	// ZoomCap is the finest zoom of a pyramid.
	ZoomCap = 13
	// ResolutionZero is the step in metres of zoom 0 on the equator.
	ResolutionZero = 2 * Rand / TileSize
	// CentreLatitude is the latitude in degrees where FinestZoom measures the step.
	CentreLatitude = 51.2
)

// ToMercator returns a point in degrees as EPSG:3857 metres (spherical).
func ToMercator(lon, lat float64) (x, y float64) {
	x = Rand * lon / 180.0
	y = Rand * math.Log(math.Tan(math.Pi/4+lat*degToRad/2)) / math.Pi
	return x, y
}

// FinestZoom returns the finest zoom that a source with a step of resM metres
// carries, in base..cap.
func FinestZoom(resM float64, cap, base int) int {
	ground := ResolutionZero * math.Cos(CentreLatitude*degToRad)
	zoom := int(math.Ceil(math.Log2(ground/resM))) + 1
	return max(base, min(cap, zoom))
}

func tileWidth(z int) float64 { return 2 * Rand / math.Pow(2, float64(z)) }

// TileRange returns the tile indices that cover a box in EPSG:3857, as kachelraster.
func TileRange(w, s, e, n float64, z int) (tx0, ty0, tx1, ty1 int) {
	width := tileWidth(z)
	tx0 = int(math.Floor((w + Rand) / width))
	tx1 = int(math.Floor((e + Rand) / width))
	ty0 = int(math.Floor((Rand - n) / width))
	ty1 = int(math.Floor((Rand - s) / width))
	return tx0, ty0, tx1, ty1
}

// TileBox returns the EPSG:3857 extent (west, south, east, north) of a block
// of tiles, as kachelbox.
func TileBox(tx0, ty0, tx1, ty1, z int) [4]float64 {
	width := tileWidth(z)
	return [4]float64{
		-Rand + float64(tx0)*width,
		Rand - float64(ty1+1)*width,
		-Rand + float64(tx1+1)*width,
		Rand - float64(ty0)*width,
	}
}

// ToByte codes a share of 0 to 1 as a byte, as tiles.to_byte. A value that is
// not finite gets 0. The arithmetic stays in float32 and rounds half to even.
func ToByte(v float32) uint8 {
	f := float64(v)
	if math.IsNaN(f) || math.IsInf(f, 0) {
		return 0
	}
	clipped := float32(min(max(f, 0), 1))
	scaled := clipped * float32(Steps)
	return uint8(float32(math.RoundToEven(float64(scaled))) + 1)
}

// FromByte reads a byte back as a share of 0 to 1, as tiles.from_byte. Byte 0 gives NaN.
func FromByte(b uint8) float32 {
	if b == 0 {
		return float32(math.NaN())
	}
	return (float32(b) - 1) / float32(Steps)
}

// ToBytes applies ToByte to each value.
func ToBytes(vals []float32) []uint8 {
	out := make([]uint8, len(vals))
	for i, v := range vals {
		out[i] = ToByte(v)
	}
	return out
}

// FromBytes applies FromByte to each byte.
func FromBytes(codes []uint8) []float32 {
	out := make([]float32, len(codes))
	for i, b := range codes {
		out[i] = FromByte(b)
	}
	return out
}
