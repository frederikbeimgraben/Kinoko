package derive

import (
	"fmt"
	"math"
	"slices"
	"strings"

	"github.com/frederikbeimgraben/kinoko/backend/internal/pipeline/numeric"
	"github.com/frederikbeimgraben/kinoko/backend/internal/pipeline/pio"
)

// ScaleRadii are the radii of the tree scales in metres, after the 500 m cell.
var ScaleRadii = []int{1000, 2000, 5000}

// ScaleWindow gives the odd window edge in cells for a radius, as
// max(3, round(2r/step) | 1).
func ScaleWindow(radius, step int) int {
	return max(3, int(math.RoundToEven(float64(radius)*2/float64(step)))|1)
}

func scaleLabel(radius int) string { return fmt.Sprintf("%dkm", radius/1000) }

// TreeScalesSchema gives the 59 columns of tree_scales.parquet for the share
// names of the grid, in file order.
func TreeScalesSchema(shares []string) []pio.ColumnSpec {
	specs := []pio.ColumnSpec{{Name: "cell", Type: pio.String}, {Name: "x", Type: pio.Float64}, {Name: "y", Type: pio.Float64}}
	for _, label := range append([]string{"500m"}, mapLabels(ScaleRadii)...) {
		specs = append(specs, pio.ColumnSpec{Name: "forest_fraction_" + label, Type: pio.Float32})
		for _, s := range shares {
			specs = append(specs, pio.ColumnSpec{Name: s + "_" + label, Type: pio.Float32})
		}
	}
	return specs
}

func mapLabels(radii []int) []string {
	out := make([]string, len(radii))
	for i, r := range radii {
		out[i] = scaleLabel(r)
	}
	return out
}

// shareColumns gives the tree_ columns of a grid table in file order, as the
// class list. names is the column order of the file.
func shareColumns(names []string) []string {
	return slices.DeleteFunc(slices.Clone(names), func(n string) bool {
		return !strings.HasPrefix(n, "tree_") || strings.HasSuffix(n, "_5km") || strings.HasSuffix(n, "_fine")
	})
}

// TreeScales gives the forest-weighted share of each class within 500 m,
// 1 km, 2 km and 5 km of each cell. grid is the trees
// grid; names is its column order; step is the cell edge in metres.
func TreeScales(grid *pio.Table, names []string, step int) (*pio.Table, []pio.ColumnSpec, error) {
	shares := shareColumns(names)
	gx, gy := grid.I64["gx"], grid.I64["gy"]
	pixels, okP := grid.F32["forest_pixels"]
	fraction, okF := grid.F32["forest_fraction"]
	if gx == nil || gy == nil || !okP || !okF {
		return nil, nil, fmt.Errorf("derive: the trees grid needs gx, gy, forest_pixels and forest_fraction as float32")
	}
	n := grid.N
	nx, ny := int(slices.Max(gx))+1, int(slices.Max(gy))+1
	at := func(i int) int { return int(gy[i])*nx + int(gx[i]) }
	forest := make([]float32, nx*ny)
	for i := range n {
		forest[at(i)] = pixels[i]
	}
	counts := make(map[string][]float32, len(shares))
	out := pio.NewTable(n)
	out.Str["cell"] = grid.Str["cell"]
	out.F64["x"], out.F64["y"] = grid.F64["x"], grid.F64["y"]
	out.F32["forest_fraction_500m"] = fraction
	for _, s := range shares {
		values, err := float32Column(grid, s)
		if err != nil {
			return nil, nil, err
		}
		field := make([]float32, nx*ny)
		for i := range n {
			field[at(i)] = values[i] * pixels[i]
		}
		counts[s] = field
		out.F32[s+"_500m"] = values
	}
	perCell := float32((step / TreePixel) * (step / TreePixel))
	for _, radius := range ScaleRadii {
		size := ScaleWindow(radius, step)
		label := scaleLabel(radius)
		wideForest := numeric.UniformSum2D(forest, ny, nx, size)
		window := perCell * float32(size*size)
		out.F32["forest_fraction_"+label] = gather(n, at, func(k int) float32 { return wideForest[k] / window })
		for _, s := range shares {
			wide := numeric.UniformSum2D(counts[s], ny, nx, size)
			out.F32[s+"_"+label] = gather(n, at, func(k int) float32 {
				if wideForest[k] > 0 {
					return wide[k] / max(wideForest[k], 1)
				}
				return 0
			})
		}
	}
	return out, TreeScalesSchema(shares), nil
}

// gather reads a field at the cell of each row.
func gather(n int, at func(int) int, value func(k int) float32) []float32 {
	out := make([]float32, n)
	for i := range n {
		out[i] = value(at(i))
	}
	return out
}

// float32Column gives a float column as float32. A float64 column is cast.
func float32Column(t *pio.Table, name string) ([]float32, error) {
	if v, ok := t.F32[name]; ok {
		return v, nil
	}
	if v, ok := t.F64[name]; ok {
		out := make([]float32, len(v))
		for i, x := range v {
			out[i] = float32(x)
		}
		return out, nil
	}
	return nil, fmt.Errorf("derive: the trees grid has no float column %s", name)
}
