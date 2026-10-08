// Package derive makes the prepared tables and the static tiles of the
// forecast chain from the raw admin uploads: the tree species map, the
// elevation model and the SoilGrids rasters. It ports the one-time Python
// steps trees_germany.py, tree_scales.py, static_features.py and fine_layers.py.
package derive

import (
	"fmt"
	"math"

	"github.com/frederikbeimgraben/kinoko/backend/internal/pipeline/core/geo"
)

// ModelCRS is the CRS of the model grid.
const ModelCRS = "EPSG:3035"

// Germany is the box of the chain in degrees (west, south, east, north), as
// GERMANY in trees_germany.py and REGIONEN["de"] in region_map.py.
var Germany = [4]float64{5.75, 47.15, 15.15, 55.15}

// CellStep is the edge of a cell of the map grid in metres.
const CellStep = 500

// Grid is a box of square cells in EPSG:3035. X0, Y0, X1, Y1 are multiples
// of Step. Row 0 is the north row, as in tile_trees.
type Grid struct {
	X0, Y0, X1, Y1 int
	Step           int
}

// GridOf gives the grid over a box in degrees, as trees_germany.main: it
// projects the south-west and the north-east corner and floors each to the step.
func GridOf(wgs [4]float64, step int) Grid {
	x0, y0 := geo.LAEA3035(wgs[0], wgs[1])
	x1, y1 := geo.LAEA3035(wgs[2], wgs[3])
	s := float64(step)
	floor := func(v float64) int { return int(geo.FloorDiv(v, s) * s) }
	return Grid{X0: floor(x0), Y0: floor(y0), X1: floor(x1), Y1: floor(y1), Step: step}
}

// NX gives the count of columns.
func (g Grid) NX() int { return (g.X1 - g.X0) / g.Step }

// NY gives the count of rows.
func (g Grid) NY() int { return (g.Y1 - g.Y0) / g.Step }

// Len gives the count of cells.
func (g Grid) Len() int { return g.NX() * g.NY() }

// Check tells if the box is a whole count of cells.
func (g Grid) Check() error {
	if g.Step <= 0 || g.X1 <= g.X0 || g.Y1 <= g.Y0 ||
		(g.X1-g.X0)%g.Step != 0 || (g.Y1-g.Y0)%g.Step != 0 || g.X0%g.Step != 0 || g.Y0%g.Step != 0 {
		return fmt.Errorf("derive: grid %+v is not aligned to its step", g)
	}
	return nil
}

// Centre gives the centre of cell (gx, gy), as tile_trees.
func (g Grid) Centre(gx, gy int) (x, y float64) {
	s := float64(g.Step)
	return float64(g.X0) + (float64(gx)+0.5)*s, float64(g.Y1) - (float64(gy)+0.5)*s
}

// Key gives the cell key "x_y" of cell (gx, gy): the centre floored to the step.
func (g Grid) Key(gx, gy int) geo.CellKey {
	x, y := g.Centre(gx, gy)
	return geo.CellOf(x, y, float64(g.Step))
}

// Extent gives the switch values of "-te" for the grid.
func (g Grid) Extent() []string {
	return []string{itoa(g.X0), itoa(g.Y0), itoa(g.X1), itoa(g.Y1)}
}

func itoa(v int) string { return fmt.Sprintf("%d", v) }

// nanOf gives NaN as float32.
func nanOf() float32 { return float32(math.NaN()) }
