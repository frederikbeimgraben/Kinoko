package tiles

import (
	"fmt"

	"github.com/frederikbeimgraben/kinoko/backend/internal/pipeline/core/geo"
)

// Grid is the block of tiles that covers a box in degrees at one zoom.
type Grid struct {
	Zoom, TX0, TY0, TX1, TY1 int
}

// GridOf returns the tile block of wgsBox (west, south, east, north in
// degrees) at zoom, as the first lines of render_field.
func GridOf(wgsBox [4]float64, zoom int) Grid {
	west, south := geo.ToMercator(wgsBox[0], wgsBox[1])
	east, north := geo.ToMercator(wgsBox[2], wgsBox[3])
	tx0, ty0, tx1, ty1 := geo.TileRange(west, south, east, north, zoom)
	return Grid{Zoom: zoom, TX0: tx0, TY0: ty0, TX1: tx1, TY1: ty1}
}

// Box returns the exact EPSG:3857 extent of the block.
func (g Grid) Box() [4]float64 { return geo.TileBox(g.TX0, g.TY0, g.TX1, g.TY1, g.Zoom) }

// Size returns the width and the height of the block in points.
func (g Grid) Size() (w, h int) {
	return (g.TX1 - g.TX0 + 1) * TileSize, (g.TY1 - g.TY0 + 1) * TileSize
}

// RenderField cuts every band of src into its own pyramid from zoom down to
// base. One warp hits the finest level; band i is
// coded relative to tops[i].
func RenderField(w Warper, src Source, tops []float64, zoom, base int, wgsBox [4]float64) ([]Pyramid, error) {
	g := GridOf(wgsBox, zoom)
	width, height := g.Size()
	warped, err := w.Warp(src, TileGridSwitches(g.Box(), width, height))
	if err != nil {
		return nil, err
	}
	if warped.NX != width || warped.NY != height || len(warped.Bands) < len(tops) {
		return nil, fmt.Errorf("tiles: warp gave %d bands of %d×%d, want %d of %d×%d",
			len(warped.Bands), warped.NX, warped.NY, len(tops), width, height)
	}
	out := make([]Pyramid, len(tops))
	for i, top := range tops {
		out[i] = BuildPyramid(CodeField(warped.Bands[i], top), width, height, zoom, g.TX0, g.TY0, base)
	}
	return out, nil
}

// Written is the result of one band on disk: the tiles with data and their bytes.
type Written struct {
	Filled []geo.TileID
	Bytes  int64
}

// RenderFieldTo runs RenderField and writes band i under roots[i].
func RenderFieldTo(w Warper, src Source, roots []string, tops []float64, zoom, base int, wgsBox [4]float64) ([]Written, error) {
	if len(roots) != len(tops) {
		return nil, fmt.Errorf("tiles: %d roots for %d tops", len(roots), len(tops))
	}
	pyramids, err := RenderField(w, src, tops, zoom, base, wgsBox)
	if err != nil {
		return nil, err
	}
	out := make([]Written, len(pyramids))
	for i, p := range pyramids {
		size, err := WritePyramid(roots[i], p)
		if err != nil {
			return nil, err
		}
		out[i] = Written{Filled: p.Filled, Bytes: size}
	}
	return out, nil
}

// BlockGrid returns the blocks of blockTiles×blockTiles tiles that cover a
// box in degrees: x first, then y.
func BlockGrid(wgsBox [4]float64, zoom, blockTiles int) [][2]int {
	g := GridOf(wgsBox, zoom)
	var out [][2]int
	for bx := floorDiv(g.TX0, blockTiles); bx <= floorDiv(g.TX1, blockTiles); bx++ {
		for by := floorDiv(g.TY0, blockTiles); by <= floorDiv(g.TY1, blockTiles); by++ {
			out = append(out, [2]int{bx, by})
		}
	}
	return out
}

// BlockBox returns the EPSG:3857 extent of one block.
func BlockBox(bx, by, zoom, blockTiles int) [4]float64 {
	return geo.TileBox(bx*blockTiles, by*blockTiles, (bx+1)*blockTiles-1, (by+1)*blockTiles-1, zoom)
}

func floorDiv(a, b int) int {
	q := a / b
	if a%b != 0 && (a < 0) != (b < 0) {
		q--
	}
	return q
}
