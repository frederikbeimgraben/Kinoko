package render

import (
	"fmt"
	"math"
	"slices"

	"github.com/frederikbeimgraben/kinoko/backend/internal/pipeline/core/geo"
	"github.com/frederikbeimgraben/kinoko/backend/internal/pipeline/pio"
)

// Bounds is the extent of a map raster in EPSG:3035 metres, aligned to the step.
type Bounds struct{ X0, Y0, X1, Y1 int }

// RegionBounds projects a box in degrees to EPSG:3035 and floors each corner to
// the step, as the bounds of region_map.main.
func RegionBounds(region [4]float64, step int) Bounds {
	x0, y0 := geo.LAEA3035(region[0], region[1])
	x1, y1 := geo.LAEA3035(region[2], region[3])
	s := float64(step)
	align := func(v float64) int { return int(geo.FloorDiv(v, s) * s) }
	return Bounds{align(x0), align(y0), align(x1), align(y1)}
}

// ExtentBounds is the box of input_layers.main: the cell centres plus half a step on each side.
func ExtentBounds(xs, ys []float64, step int) Bounds {
	half := float64(step) / 2
	trunc := func(v float64) int { return int(math.Trunc(v)) }
	return Bounds{
		trunc(slices.Min(xs) - half), trunc(slices.Min(ys) - half),
		trunc(slices.Max(xs) + half), trunc(slices.Max(ys) + half),
	}
}

// Shape returns the rows and the columns of the raster, as raster_ausrichten.
func (b Bounds) Shape(step int) (ny, nx int) {
	return floorInt(b.Y1-b.Y0, step), floorInt(b.X1-b.X0, step)
}

// WGSBox returns west, south, east, north in degrees of the four corners, as wgs_box.
func (b Bounds) WGSBox() [4]float64 {
	box := [4]float64{math.Inf(1), math.Inf(1), math.Inf(-1), math.Inf(-1)}
	for _, x := range []int{b.X0, b.X1} {
		for _, y := range []int{b.Y0, b.Y1} {
			lon, lat := geo.InvLAEA3035(float64(x), float64(y))
			box = [4]float64{min(box[0], lon), min(box[1], lat), max(box[2], lon), max(box[3], lat)}
		}
	}
	return box
}

func floorInt(a, b int) int { return int(math.Floor(float64(a) / float64(b))) }

// Grid holds the map cells inside the bounds, in the row order of the trees grid.
// Each cell keeps its raster position (GX, GY): fields are placed by it, not by row order.
type Grid struct {
	Bounds Bounds
	Step   int
	NX, NY int
	X, Y   []float64
	GX, GY []int32
	// Cell is the 5 km weather and training cell of each map cell.
	Cell []geo.CellKey
	// Forest is forest_fraction; ForestF32 tells that the column holds float32.
	Forest    []float64
	ForestF32 bool
	// Soil is soil_phh2o_0_5cm, NaN for water. It is nil without a site table.
	Soil []float32
	// Cols holds the joined tree-scale columns, NaN for a cell without a match.
	Cols map[string][]float32
}

// Len returns the number of cells.
func (g *Grid) Len() int { return len(g.X) }

// NewGrid keeps the cells of t.Trees inside b, rebuilds gx and gy from x and y
// (raster_ausrichten) and joins the site and the tree-scale columns cols by the
// fine cell key. A column that the scales table lacks is left out.
func NewGrid(b Bounds, step int, t Tables, cols []string) (*Grid, error) {
	if t.Trees == nil {
		return nil, fmt.Errorf("render: no trees grid")
	}
	xs, okX := floats(t.Trees, "x")
	ys, okY := floats(t.Trees, "y")
	if !okX || !okY {
		return nil, fmt.Errorf("render: trees grid needs x and y")
	}
	g := &Grid{Bounds: b, Step: step, Cols: map[string][]float32{}}
	g.NY, g.NX = b.Shape(step)
	s := float64(step)
	keep := make([]int, 0, len(xs))
	for i := range xs {
		gx := int(geo.FloorDiv(xs[i]-float64(b.X0), s))
		gy := int(geo.FloorDiv(float64(b.Y1)-ys[i], s))
		if gx >= 0 && gx < g.NX && gy >= 0 && gy < g.NY {
			keep = append(keep, i)
			g.GX, g.GY = append(g.GX, int32(gx)), append(g.GY, int32(gy))
		}
	}
	g.X, g.Y = pick(xs, keep), pick(ys, keep)
	g.Cell = make([]geo.CellKey, len(keep))
	for i := range keep {
		g.Cell[i] = geo.CellOf(g.X[i], g.Y[i], TrainCell)
	}
	if forest, ok := floats(t.Trees, "forest_fraction"); ok {
		g.Forest = pick(forest, keep)
		_, g.ForestF32 = t.Trees.F32["forest_fraction"]
	}
	fine := make([]geo.CellKey, len(keep))
	for i := range keep {
		fine[i] = geo.CellOf(g.X[i], g.Y[i], s)
	}
	if t.Site != nil {
		soil, err := joinColumns(t.Site, fine, []string{"soil_phh2o_0_5cm"})
		if err != nil {
			return nil, fmt.Errorf("render: site grid: %w", err)
		}
		g.Soil = soil["soil_phh2o_0_5cm"]
	}
	if t.Scales != nil {
		joined, err := joinColumns(t.Scales, fine, cols)
		if err != nil {
			return nil, fmt.Errorf("render: tree scales: %w", err)
		}
		g.Cols = joined
	}
	return g, nil
}

// joinColumns is a left merge on the fine cell key: the column "cell" of t
// against keys. A key without a row gives NaN. A column that t lacks is left out,
// except soil_phh2o_0_5cm, which the water mask needs.
func joinColumns(t *pio.Table, keys []geo.CellKey, cols []string) (map[string][]float32, error) {
	cells, ok := t.Str["cell"]
	if !ok {
		return nil, fmt.Errorf("column cell is missing")
	}
	row := make(map[geo.CellKey]int32, len(cells))
	for i, s := range cells {
		k, err := geo.ParseCellKey(s)
		if err != nil {
			return nil, err
		}
		if _, dup := row[k]; dup {
			return nil, fmt.Errorf("cell %s is not unique", s)
		}
		row[k] = int32(i)
	}
	out := map[string][]float32{}
	for _, name := range cols {
		src, ok := float32s(t, name)
		if !ok {
			if name == "soil_phh2o_0_5cm" {
				return nil, fmt.Errorf("column %s is missing", name)
			}
			continue
		}
		dst := make([]float32, len(keys))
		for i, k := range keys {
			dst[i] = nan32
			if r, ok := row[k]; ok {
				dst[i] = src[r]
			}
		}
		out[name] = dst
	}
	return out, nil
}

// Water tells if cell i has no soil value, as the mask "wasser" of region_map.py.
func (g *Grid) Water(i int) bool { return g.Soil != nil && isNaN32(g.Soil[i]) }

// UniqueCells returns the 5 km cells of the grid, each once, in the order of appearance.
func (g *Grid) UniqueCells() []geo.CellKey {
	seen := map[geo.CellKey]bool{}
	var out []geo.CellKey
	for _, c := range g.Cell {
		if !seen[c] {
			seen[c] = true
			out = append(out, c)
		}
	}
	return out
}

// place puts one value per cell into a NY×NX raster at (GY, GX). Other points get fill.
func place[T any](g *Grid, vals []T, fill T) []T {
	out := make([]T, g.NY*g.NX)
	for i := range out {
		out[i] = fill
	}
	for i, v := range vals {
		out[int(g.GY[i])*g.NX+int(g.GX[i])] = v
	}
	return out
}

func pick[T any](vals []T, idx []int) []T {
	out := make([]T, len(idx))
	for j, i := range idx {
		out[j] = vals[i]
	}
	return out
}

var nan32 = float32(math.NaN())

func isNaN32(v float32) bool { return v != v }

func finite32(v float32) bool { return !math.IsNaN(float64(v)) && !math.IsInf(float64(v), 0) }
