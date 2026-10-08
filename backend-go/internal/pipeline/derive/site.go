package derive

import (
	"context"
	"fmt"
	"math"
	"path/filepath"
	"slices"
	"strings"

	"github.com/airbusgeo/godal"

	"github.com/frederikbeimgraben/kinoko/backend/internal/pipeline/numeric"
	"github.com/frederikbeimgraben/kinoko/backend/internal/pipeline/pio"
)

// Columns is an ordered set of float32 columns, one value per grid cell.
type Columns struct {
	Names  []string
	Values map[string][]float32
}

func (c *Columns) add(name string, v []float32) {
	if c.Values == nil {
		c.Values = map[string][]float32{}
	}
	c.Names = append(c.Names, name)
	c.Values[name] = v
}

// tpiWindows are the windows of the topographic position index in cells
// and their column names. The names keep the 5 km labels of the Python chain.
var tpiWindows = []struct {
	size int
	name string
}{{5, "tpi_25km"}, {11, "tpi_55km"}}

// demFloor is the height below which static_features.py drops a DEM value.
const demFloor = -20

// SampleGrid warps a raster onto the cells of the grid, as warp and sample of
// static_features.py. The warp grid is the cell grid, so cell (gx, gy) is
// point gy*nx+gx. srcNodata adds "-srcnodata v -dstnodata nan -ot Float32".
func SampleGrid(source *godal.Dataset, g Grid, resampler, srcNodata string) ([]float32, error) {
	step := itoa(g.Step)
	switches := append(append([]string{"-t_srs", ModelCRS, "-te"}, g.Extent()...), "-tr", step, step, "-r", resampler)
	if srcNodata != "" {
		switches = append(switches, "-srcnodata", srcNodata, "-dstnodata", "nan", "-ot", "Float32")
	}
	ds, err := warpMem(source, switches)
	if err != nil {
		return nil, err
	}
	defer ds.Close()
	if nx, ny := size(ds); nx != g.NX() || ny != g.NY() {
		return nil, fmt.Errorf("derive: warp gave %d×%d points, want %d×%d", nx, ny, g.NX(), g.NY())
	}
	return readMasked(ds, 0)
}

func sampleFile(path string, g Grid, resampler, srcNodata string) ([]float32, error) {
	src, err := openRaster(path)
	if err != nil {
		return nil, err
	}
	defer src.Close()
	return SampleGrid(src, g, resampler, srcNodata)
}

// DEMColumns gives the terrain columns of static_features.py in its order:
// dem_mean, dem_min, dem_max, dem_relief, northness, eastness, slope_mean,
// slope_max, tpi_25km, tpi_55km.
func DEMColumns(ctx context.Context, f DEMFiles, g Grid) (Columns, error) {
	var c Columns
	var raw []float32
	for _, w := range []struct{ how, name string }{{"average", "dem_mean"}, {"min", "dem_min"}, {"max", "dem_max"}} {
		v, err := sampleFile(f.VRT, g, w.how, "")
		if err != nil {
			return c, err
		}
		if w.name == "dem_mean" {
			raw = slices.Clone(v)
		}
		c.add(w.name, v)
	}
	for _, name := range c.Names {
		for i, v := range c.Values[name] {
			if v < demFloor {
				c.Values[name][i] = nanOf()
			}
		}
	}
	relief := make([]float32, g.Len())
	for i := range relief {
		relief[i] = c.Values["dem_max"][i] - c.Values["dem_min"][i]
	}
	c.add("dem_relief", relief)
	for _, w := range []struct{ path, how, name string }{
		{f.Northness, "average", "northness"}, {f.Eastness, "average", "eastness"},
		{f.Slope, "average", "slope_mean"}, {f.Slope, "max", "slope_max"},
	} {
		if err := ctx.Err(); err != nil {
			return c, err
		}
		v, err := sampleFile(w.path, g, w.how, "")
		if err != nil {
			return c, err
		}
		c.add(w.name, v)
	}
	for _, w := range tpiWindows {
		c.add(w.name, TPI(raw, g.NY(), g.NX(), w.size))
	}
	return c, nil
}

// TPI gives the height of each cell minus the mean height of the window
// around it, as static_features.py: missing cells take the mean of the
// field first, and the filter repeats the edge (scipy mode "nearest").
func TPI(field []float32, ny, nx, size int) []float32 {
	filled := slices.Clone(field)
	zeroed := make([]float32, len(field))
	count := 0
	for i, v := range field {
		if isFinite(v) {
			zeroed[i] = v
			count++
		}
	}
	// np.nanmean divides the float32 sum by the count in float64 and casts back.
	mean := float32(float64(numeric.Sum(zeroed)) / float64(count))
	for i, v := range field {
		if !isFinite(v) {
			filled[i] = mean
		}
	}
	smooth := numeric.Uniform2D(filled, ny, nx, size, numeric.Nearest)
	out := make([]float32, len(field))
	for i, v := range field {
		out[i] = nanOf()
		if isFinite(v) {
			out[i] = v - smooth[i]
		}
	}
	return out
}

func isFinite(v float32) bool { return !math.IsNaN(float64(v)) && !math.IsInf(float64(v), 0) }

// SoilName gives the column of a SoilGrids file, as static_features.py:
// "phh2o_0-5cm_mean.tif" is "soil_phh2o_0_5cm".
func SoilName(path string) string {
	stem := strings.TrimSuffix(filepath.Base(path), filepath.Ext(path))
	return "soil_" + strings.ReplaceAll(strings.ReplaceAll(stem, "_mean", ""), "-", "_")
}

// SoilColumns gives one column per SoilGrids file, in the order of the
// sorted paths: the cell mean with 0 as the nodata of the source.
func SoilColumns(ctx context.Context, files []string, g Grid) (Columns, error) {
	var c Columns
	for _, path := range slices.Sorted(slices.Values(files)) {
		if err := ctx.Err(); err != nil {
			return c, err
		}
		v, err := sampleFile(path, g, "average", "0")
		if err != nil {
			return c, err
		}
		c.add(SoilName(path), v)
	}
	return c, nil
}

// SiteTable joins the cell keys and the column sets into site_500m.parquet,
// as static_features.py: cell, cell_x, cell_y, then the columns.
func SiteTable(g Grid, parts ...Columns) (*pio.Table, []pio.ColumnSpec) {
	t := pio.NewTable(g.Len())
	cells, cx, cy := make([]string, g.Len()), make([]int64, g.Len()), make([]int64, g.Len())
	for i := range g.Len() {
		k := g.Key(i%g.NX(), i/g.NX())
		cells[i], cx[i], cy[i] = k.String(), int64(k.X), int64(k.Y)
	}
	t.Str["cell"], t.I64["cell_x"], t.I64["cell_y"] = cells, cx, cy
	specs := []pio.ColumnSpec{{Name: "cell", Type: pio.String}, {Name: "cell_x", Type: pio.Int64}, {Name: "cell_y", Type: pio.Int64}}
	for _, p := range parts {
		for _, name := range p.Names {
			t.F32[name] = p.Values[name]
			specs = append(specs, pio.ColumnSpec{Name: name, Type: pio.Float32})
		}
	}
	return t, specs
}

// ColumnsOf reads the float32 columns of a table back into a column set,
// in the order of names. It skips the key columns.
func ColumnsOf(t *pio.Table, names []string) Columns {
	var c Columns
	for _, n := range names {
		if v, ok := t.F32[n]; ok {
			c.add(n, v)
		}
	}
	return c
}
