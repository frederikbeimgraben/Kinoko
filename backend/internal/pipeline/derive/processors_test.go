package derive

import (
	"archive/zip"
	"context"
	"errors"
	"io"
	"os"
	"path/filepath"
	"slices"
	"testing"

	"github.com/frederikbeimgraben/kinoko/backend/internal/fn"
	"github.com/frederikbeimgraben/kinoko/backend/internal/modules/sources"
	"github.com/frederikbeimgraben/kinoko/backend/internal/pipeline/pio"
)

// fakeResolver gives fixed artifact paths per kind.
type fakeResolver map[sources.Kind]map[string]string

func (f fakeResolver) Active(kind sources.Kind, _ string) (*sources.Version, error) {
	return nil, sources.ErrMissing
}

func (f fakeResolver) Path(kind sources.Kind, artifact string) (string, error) {
	if p, ok := f[kind][artifact]; ok {
		return p, nil
	}
	return "", sources.ErrMissing
}

func copyFile(t *testing.T, from, to string) {
	t.Helper()
	data, err := os.ReadFile(from)
	if err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(to, data, 0o644); err != nil {
		t.Fatal(err)
	}
}

func zipFiles(t *testing.T, target string, files map[string]string) {
	t.Helper()
	f, err := os.Create(target)
	if err != nil {
		t.Fatal(err)
	}
	w := zip.NewWriter(f)
	for _, name := range fn.SortedKeys(files) {
		dst, err := w.Create(name)
		if err != nil {
			t.Fatal(err)
		}
		src, err := os.Open(files[name])
		if err != nil {
			t.Fatal(err)
		}
		if _, err := io.Copy(dst, src); err != nil {
			t.Fatal(err)
		}
		_ = src.Close()
	}
	if err := w.Close(); err != nil {
		t.Fatal(err)
	}
	if err := f.Close(); err != nil {
		t.Fatal(err)
	}
}

// version makes an uploaded version whose original is file under name.
func version(t *testing.T, kind sources.Kind, name string, place func(target string)) *sources.Version {
	t.Helper()
	dir := t.TempDir()
	place(filepath.Join(dir, "original"+filepath.Ext(name)))
	return &sources.Version{Kind: kind, Origin: sources.OriginUpload, FileName: fn.Ptr(name), Dir: dir}
}

func names(a []sources.Artifact) []string {
	return fn.Map(a, func(x sources.Artifact) string { return x.Name })
}

func run(t *testing.T, p sources.Processor, v *sources.Version) ([]sources.Artifact, map[string]any) {
	t.Helper()
	meta, err := p.Validate(context.Background(), v)
	if err != nil {
		t.Fatalf("validate: %v", err)
	}
	artifacts, err := p.Derive(context.Background(), v)
	if err != nil {
		t.Fatalf("derive: %v", err)
	}
	return artifacts, meta
}

// TestProcessors runs the three processors on the synthetic uploads: the tree map as a GeoTIFF,
// the DEM and SoilGrids as zips. The site grid of the soil run joins the terrain part of the
// DEM run. It must equal the golden site_500m.parquet of static_features.main.
func TestProcessors(t *testing.T) {
	if testing.Short() {
		t.Skip("the processors take a while")
	}
	gg := loadGrid(t)
	res := fakeResolver{sources.KindGermanyOutline: {"outline": in("outline.geojson")}}
	cfg := Config{Resolve: res, Grid: gg.grid(), TreeTile: gg.TreeTile, Fine: FineOptions{Box: gg.FineBox}}

	cfg.Fine.Layers = []string{"wald"}
	trees := version(t, sources.KindTreeSpeciesMap, "map.tif", func(p string) { copyFile(t, in("trees_32632.tif"), p) })
	got, meta := run(t, TreeMap{cfg}, trees)
	if want := []string{ArtTreesGrid, ArtTreeScales, LayersFile, TilesFolder + "/wald"}; !slices.Equal(names(got), want) {
		t.Fatalf("tree artifacts %v, want %v", names(got), want)
	}
	if seen := meta["classesSeen"].([]int); !slices.Contains(seen, 7) || !slices.Contains(seen, 8) {
		t.Errorf("classes seen %v", seen)
	}
	grid, err := pio.ReadParquet(got[0].Path, nil)
	if err != nil {
		t.Fatal(err)
	}
	want, info := readGolden(t, "trees_de_500m.parquet")
	compareTable(t, grid, TreesGridSchema(), want, info, exact)

	cfg.Fine.Layers = []string{"hangneigung"}
	dem := version(t, sources.KindDEM, "glo90.zip", func(p string) {
		zipFiles(t, p, map[string]string{"tiles/dem_w.tif": in("dem", "dem_w.tif"), "tiles/dem_e.tif": in("dem", "dem_e.tif")})
	})
	got, _ = run(t, DEM{cfg}, dem)
	wantDEM := []string{"dem90_3035", "slope90", "aspect90", "northness90", "eastness90", ArtSiteDEM, LayersFile, TilesFolder + "/hangneigung"}
	if !slices.Equal(names(got), wantDEM) {
		t.Fatalf("dem artifacts %v, want %v", names(got), wantDEM)
	}
	sitePart := got[slices.Index(names(got), ArtSiteDEM)].Path

	cfg.Fine.Layers = []string{"boden_ph"}
	res[sources.KindDEM] = map[string]string{ArtSiteDEM: sitePart}
	soilFiles := map[string]string{}
	for stem, path := range soilInputs(t) {
		soilFiles["soil/"+stem+"_mean.tif"] = path
	}
	soil := version(t, sources.KindSoilGrids, "soilgrids.zip", func(p string) { zipFiles(t, p, soilFiles) })
	got, _ = run(t, SoilGrids{cfg}, soil)
	if want := []string{ArtSiteSoil, ArtSite, LayersFile, TilesFolder + "/boden_ph"}; !slices.Equal(names(got), want) {
		t.Fatalf("soil artifacts %v, want %v", names(got), want)
	}
	site, err := pio.ReadParquet(got[1].Path, nil)
	if err != nil {
		t.Fatal(err)
	}
	siteInfo, err := pio.Inspect(got[1].Path)
	if err != nil {
		t.Fatal(err)
	}
	wantSite, wantInfo := readGolden(t, "site_500m.parquet")
	compareTable(t, site, siteInfo.Columns, wantSite, wantInfo, func(string) (float64, float64) { return 1e-5, 1e-3 })
}

// TestValidateRejects checks the refusals of the raster checks.
func TestValidateRejects(t *testing.T) {
	gg := loadGrid(t)
	cfg := Config{Resolve: fakeResolver{}, Grid: gg.grid()}
	far := Config{Resolve: fakeResolver{}, Grid: Grid{X0: 3_000_000, Y0: 2_000_000, X1: 3_020_000, Y1: 2_020_000, Step: CellStep}}
	cases := []struct {
		name string
		p    sources.Processor
		v    *sources.Version
		code string
	}{
		{"dem as tree map", TreeMap{cfg}, version(t, sources.KindTreeSpeciesMap, "x.tif", func(p string) { copyFile(t, in("dem", "dem_w.tif"), p) }), "dtype"},
		{"tree map elsewhere", TreeMap{far}, version(t, sources.KindTreeSpeciesMap, "x.tif", func(p string) { copyFile(t, in("trees_32632.tif"), p) }), "coverage"},
		{"tree map as dem", DEM{cfg}, version(t, sources.KindDEM, "x.tif", func(p string) { copyFile(t, in("trees_32632.tif"), p) }), "dtype"},
		{"soil without ph", SoilGrids{cfg}, version(t, sources.KindSoilGrids, "x.zip", func(p string) {
			zipFiles(t, p, map[string]string{"sand_0-5cm_mean.tif": in("soil", "sand_0-5cm_mean.tif")})
		}), "missing_files"},
	}
	for _, c := range cases {
		_, err := c.p.Validate(context.Background(), c.v)
		var f *sources.Failure
		if !errors.As(err, &f) || f.Code != c.code {
			t.Errorf("%s: got %v, want code %s", c.name, err, c.code)
		}
	}
}
