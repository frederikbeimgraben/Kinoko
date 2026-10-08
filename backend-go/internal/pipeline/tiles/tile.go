package tiles

import (
	"math"
	"slices"

	"github.com/frederikbeimgraben/kinoko/backend/internal/pipeline/core/geo"
)

// TileSize is the edge of a tile in points.
const TileSize = geo.TileSize

// Tile is one tile of a pyramid: the value bytes and the weight bytes, each
// TileSize² points, north row first. The weight is the coded share of the
// area behind each point that has data.
type Tile struct {
	Code, Weight []uint8
}

// Placed is a tile with its position.
type Placed struct {
	ID   geo.TileID
	Tile Tile
}

// HasData reports whether a byte is not 0, as numpy any().
func HasData(code []uint8) bool {
	return slices.ContainsFunc(code, func(b uint8) bool { return b != 0 })
}

// CodeField codes a band as bytes relative to top, as
// to_byte(band / max(top, 1e-6)) in render_field. The division is float32, as numpy.
func CodeField(band []float32, top float64) []uint8 {
	scale := float32(max(top, 1e-6))
	out := make([]uint8, len(band))
	for i, v := range band {
		out[i] = geo.ToByte(v / scale)
	}
	return out
}

// FullWeight is the weight of the finest level, as pyramid.full_weight:
// a point with data is full (255), a point without data has no weight.
func FullWeight(code []uint8) []uint8 {
	out := make([]uint8, len(code))
	for i, b := range code {
		if b > 0 {
			out[i] = 255
		}
	}
	return out
}

// Cut cuts a coded field of nx×ny points into tiles from tile (tx0, ty0), as
// pyramid.cut_field. Only tiles with data are returned, rows first.
// Points beyond whole tiles are dropped.
func Cut(code []uint8, nx, ny, zoom, tx0, ty0 int) []Placed {
	var out []Placed
	for j := range ny / TileSize {
		for i := range nx / TileSize {
			tile := make([]uint8, 0, TileSize*TileSize)
			for r := range TileSize {
				start := (j*TileSize+r)*nx + i*TileSize
				tile = append(tile, code[start:start+TileSize]...)
			}
			if HasData(tile) {
				id := geo.TileID{Z: zoom, X: tx0 + i, Y: ty0 + j}
				out = append(out, Placed{ID: id, Tile: Tile{Code: tile, Weight: FullWeight(tile)}})
			}
		}
	}
	return out
}

func zeroNaN(v float32) float32 {
	if math.IsNaN(float64(v)) {
		return 0
	}
	return v
}

// point returns the value and the weight of one point, NaN as 0, as
// nan_to_num(from_byte(...)) in pyramid.halve.
func point(code, weight []uint8, k int) (value, share float32) {
	return zeroNaN(geo.FromByte(code[k])), zeroNaN(geo.FromByte(weight[k]))
}

// Halve averages each block of 2×2 points of a rows×cols field into one
// point, weighted, as pyramid.halve. It returns the mean value and the mean
// weight. A block without weight gets no data. The arithmetic is float32.
func Halve(code, weight []uint8, rows, cols int) (c, w []uint8) {
	or, oc := rows/2, cols/2
	c, w = make([]uint8, or*oc), make([]uint8, or*oc)
	nan := float32(math.NaN())
	for i := range or {
		for j := range oc {
			top, bottom := (2*i)*cols+2*j, (2*i+1)*cols+2*j
			v00, w00 := point(code, weight, top)
			v01, w01 := point(code, weight, top+1)
			v10, w10 := point(code, weight, bottom)
			v11, w11 := point(code, weight, bottom+1)
			// numpy adds the pairs of a row first, then the rows; float32 sums depend on the order.
			// The float32 conversions block a fused multiply-add, because numpy rounds each product.
			total := (float32(v00*w00) + float32(v01*w01)) + (float32(v10*w10) + float32(v11*w11))
			mass := (w00 + w01) + (w10 + w11)
			mean, quarter := nan, nan
			if mass > 0 {
				mean, quarter = total/mass, mass/4
			}
			c[i*oc+j], w[i*oc+j] = geo.ToByte(mean), geo.ToByte(quarter)
		}
	}
	return c, w
}

// canvas puts the four children of a parent side by side, as pyramid._canvas.
// A missing child stays 0. pick selects the value or the weight bytes.
func canvas(children [4]*Tile, pick func(*Tile) []uint8) []uint8 {
	side := 2 * TileSize
	out := make([]uint8, side*side)
	for k, child := range children {
		if child == nil {
			continue
		}
		dx, dy := k%2, k/2
		src := pick(child)
		for r := range TileSize {
			copy(out[(dy*TileSize+r)*side+dx*TileSize:], src[r*TileSize:(r+1)*TileSize])
		}
	}
	return out
}

// Parent averages the four children (dx, dy) = (0,0), (1,0), (0,1), (1,1) of a
// tile into the tile one zoom coarser. A nil child has no data.
func Parent(children [4]*Tile) Tile {
	side := 2 * TileSize
	code := canvas(children, func(t *Tile) []uint8 { return t.Code })
	weight := canvas(children, func(t *Tile) []uint8 { return t.Weight })
	c, w := Halve(code, weight, side, side)
	return Tile{Code: c, Weight: w}
}
