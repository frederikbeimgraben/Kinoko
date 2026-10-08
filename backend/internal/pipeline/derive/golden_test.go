package derive

import (
	"context"
	"path/filepath"
	"slices"
	"strings"
	"testing"

	"github.com/frederikbeimgraben/kinoko/backend/internal/fn"
	"github.com/frederikbeimgraben/kinoko/backend/internal/pipeline/pio"
)

// TestGridOfGermany compares the Germany grid with trees_germany.main
// (pyproj), golden grid.json "germany500".
func TestGridOfGermany(t *testing.T) {
	want := loadGrid(t).Germany500
	g := GridOf(Germany, CellStep)
	if got := [4]int{g.X0, g.Y0, g.X1, g.Y1}; got != want {
		t.Fatalf("got %v, want %v", got, want)
	}
}

// TestTileTreesGolden compares the trees grid with region_map.tile_trees and
// the cell column of trees_germany.main: golden trees_de_500m.parquet.
func TestTileTreesGolden(t *testing.T) {
	gg := loadGrid(t)
	counts, err := TileTrees(context.Background(), in("trees_32632.tif"), gg.grid(), TreeOptions{Tile: gg.TreeTile})
	if err != nil {
		t.Fatal(err)
	}
	want, info := readGolden(t, "trees_de_500m.parquet")
	compareTable(t, counts.Table(), TreesGridSchema(), want, info, exact)
}

// TestTreeScalesGolden runs TreeScales on the golden trees grid and compares
// it with tree_scales.main: golden tree_scales.parquet.
func TestTreeScalesGolden(t *testing.T) {
	grid, gridInfo := readGolden(t, "trees_de_500m.parquet")
	names := fn.Map(gridInfo.Columns, func(c pio.ColumnSpec) string { return c.Name })
	got, schema, err := TreeScales(grid, names, CellStep)
	if err != nil {
		t.Fatal(err)
	}
	want, info := readGolden(t, "tree_scales.parquet")
	if len(info.Columns) != 59 {
		t.Fatalf("golden has %d columns, want 59", len(info.Columns))
	}
	compareTable(t, got, schema, want, info, func(string) (float64, float64) { return 1e-6, 1e-7 })
}

// buildSite runs the terrain and the soil steps on the synthetic inputs.
func buildSite(t *testing.T, g Grid) (DEMFiles, Columns, Columns) {
	t.Helper()
	ctx := context.Background()
	files, err := BuildDEM(ctx, []string{in("dem", "dem_w.tif"), in("dem", "dem_e.tif")}, g, t.TempDir())
	if err != nil {
		t.Fatal(err)
	}
	dem, err := DEMColumns(ctx, files, g)
	if err != nil {
		t.Fatal(err)
	}
	soilFiles, err := filepath.Glob(in("soil", "*.tif"))
	if err != nil {
		t.Fatal(err)
	}
	soil, err := SoilColumns(ctx, soilFiles, g)
	if err != nil {
		t.Fatal(err)
	}
	return files, dem, soil
}

// TestSiteGolden compares the site grid with static_features.main at 500 m:
// golden site_500m.parquet. Northness and eastness come from a float32 cos
// and sin, whose last bit can differ from numpy.
func TestSiteGolden(t *testing.T) {
	g := loadGrid(t).grid()
	_, dem, soil := buildSite(t, g)
	got, schema := SiteTable(g, dem, soil)
	want, info := readGolden(t, "site_500m.parquet")
	compareTable(t, got, schema, want, info, func(name string) (float64, float64) {
		switch {
		case name == "northness" || name == "eastness":
			return 1e-5, 1e-6
		case strings.HasPrefix(name, "tpi_"):
			return 1e-5, 1e-3
		}
		return 1e-6, 0
	})
}

// TestDEMRastersGolden compares the 90 m rasters with the work files of
// static_features.main.
func TestDEMRastersGolden(t *testing.T) {
	g := loadGrid(t).grid()
	files, _, _ := buildSite(t, g)
	for _, c := range []struct {
		got, want string
		abs       float64
	}{
		{files.DEM, "dem90_3035.tif", 0}, {files.Slope, "slope90.tif", 0},
		{files.Aspect, "aspect90.tif", 0}, {files.Northness, "northness90.tif", 1e-6},
	} {
		got, gotNX, gotNY := readAll(t, c.got)
		want, nx, ny := readAll(t, golden(c.want))
		if gotNX != nx || gotNY != ny {
			t.Fatalf("%s: got %d×%d, want %d×%d", c.want, gotNX, gotNY, nx, ny)
		}
		bad := 0
		for i := range want {
			if !near(got[i], want[i], 0, c.abs) {
				bad++
			}
		}
		if bad > 0 {
			t.Errorf("%s: %d of %d points differ", c.want, bad, len(want))
		}
	}
}

func readAll(t *testing.T, path string) ([]float32, int, int) {
	t.Helper()
	ds, err := openRaster(path)
	if err != nil {
		t.Fatal(err)
	}
	defer func() { _ = ds.Close() }()
	v, err := readRawFloat(ds, 0)
	if err != nil {
		t.Fatal(err)
	}
	nx, ny := size(ds)
	return v, nx, ny
}

// TestScaleWindow checks the window rule of tree_scales.py.
func TestScaleWindow(t *testing.T) {
	got := fn.Map(ScaleRadii, func(r int) int { return ScaleWindow(r, CellStep) })
	if !slices.Equal(got, []int{5, 9, 21}) {
		t.Fatalf("got %v", got)
	}
	if ScaleWindow(500, 500) != 3 || ScaleWindow(1500, 500) != 7 {
		t.Fatal("small windows")
	}
}

// TestSoilName checks the column names of static_features.py.
func TestSoilName(t *testing.T) {
	if got := SoilName("/x/phh2o_0-5cm_mean.tif"); got != "soil_phh2o_0_5cm" {
		t.Fatal(got)
	}
	if got := SoilStem("/vsizip/a.zip/d/soc_15-30cm_mean.tif"); got != "soc_15-30cm" {
		t.Fatal(got)
	}
}
