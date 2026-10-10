package derive

import (
	"bytes"
	"context"
	"io/fs"
	"math"
	"os"
	"path/filepath"
	"slices"
	"testing"

	"github.com/frederikbeimgraben/kinoko/backend/internal/pipeline/tiles"
)

// goldenLayers are the layers of the golden fine layer run.
var goldenLayers = []string{"wald", "fichte", "nadelholz", "hoehe", "hangneigung", "nordexposition",
	"boden_ph", "boden_sand", "boden_kohlenstoff"}

func soilInputs(t *testing.T) map[string]string {
	t.Helper()
	files, err := filepath.Glob(in("soil", "*.tif"))
	if err != nil {
		t.Fatal(err)
	}
	out := map[string]string{}
	for _, f := range files {
		out[SoilStem(f)] = f
	}
	return out
}

// TestRenderFineGolden compares the tiles and layers.json with the golden
// maps/. The golden tree source is a cut of the same tree map. A tile byte may differ by 1 on 0.1 % of the points.
func TestRenderFineGolden(t *testing.T) {
	if testing.Short() {
		t.Skip("the fine layers take a while")
	}
	gg := loadGrid(t)
	files, _, _ := buildSite(t, gg.grid())
	out := t.TempDir()
	inputs := FineInputs{Trees: in("trees_32632.tif"), Outline: in("outline.geojson"), DEM: files, Soil: soilInputs(t)}
	layers, err := RenderFine(context.Background(), inputs, out, t.TempDir(), FineOptions{Box: gg.FineBox, Layers: goldenLayers})
	if err != nil {
		t.Fatal(err)
	}
	if len(layers) != len(goldenLayers) {
		t.Fatalf("rendered %d layers, want %d", len(layers), len(goldenLayers))
	}
	compareTileTrees(t, filepath.Join(out, TilesFolder), golden("maps", TilesFolder))
	got, err := os.ReadFile(filepath.Join(out, LayersFile))
	if err != nil {
		t.Fatal(err)
	}
	want, err := os.ReadFile(golden("maps", LayersFile))
	if err != nil {
		t.Fatal(err)
	}
	if !bytes.Equal(got, want) {
		t.Errorf("layers.json differs:\n got %s\nwant %s", clip(got), clip(want))
	}
}

func clip(b []byte) string {
	if len(b) > 1500 {
		return string(b[:1500]) + "…"
	}
	return string(b)
}

func listTiles(t *testing.T, root string) []string {
	t.Helper()
	var out []string
	err := filepath.WalkDir(root, func(p string, d fs.DirEntry, err error) error {
		if err != nil || d.IsDir() {
			return err
		}
		rel, err := filepath.Rel(root, p)
		out = append(out, rel)
		return err
	})
	if err != nil {
		t.Fatal(err)
	}
	slices.Sort(out)
	return out
}

func compareTileTrees(t *testing.T, gotRoot, wantRoot string) {
	t.Helper()
	got, want := listTiles(t, gotRoot), listTiles(t, wantRoot)
	if !slices.Equal(got, want) {
		t.Fatalf("tile sets differ: got %d tiles, want %d\n got %v\nwant %v", len(got), len(want), got, want)
	}
	for _, rel := range want {
		a := readPNG(t, filepath.Join(gotRoot, rel))
		b := readPNG(t, filepath.Join(wantRoot, rel))
		off, far := 0, 0
		for i := range b {
			d := math.Abs(float64(a[i]) - float64(b[i]))
			if d > 0 {
				off++
			}
			if d > 1 {
				far++
			}
		}
		if far > 0 || float64(off) > 0.001*float64(len(b)) {
			t.Errorf("%s: %d points differ, %d by more than 1", rel, off, far)
		}
	}
}

func readPNG(t *testing.T, path string) []uint8 {
	t.Helper()
	raw, err := os.ReadFile(path)
	if err != nil {
		t.Fatal(err)
	}
	code, err := tiles.DecodePNG(raw)
	if err != nil {
		t.Fatal(err)
	}
	return code
}

// TestScaleField checks scale_field: nodata and NaN give NaN, the scale
// applies before the clip.
func TestScaleField(t *testing.T) {
	l := FineLayers[slices.IndexFunc(FineLayers, func(l FineLayer) bool { return l.Name == "boden_ph" })]
	got := ScaleField([]float32{0, 35, 60, 85, 100, float32(math.NaN())}, l)
	want := []float32{float32(math.NaN()), 0, 0.5, 1, 1, float32(math.NaN())}
	for i := range want {
		if !near(got[i], want[i], 1e-6, 1e-7) {
			t.Fatalf("point %d: got %v, want %v", i, got[i], want[i])
		}
	}
}

// TestTreeField checks tree_fields on a small block.
func TestTreeField(t *testing.T) {
	classes := []uint8{0, 8, 3, 0, 9}
	inland := []uint8{1, 1, 1, 0, 0}
	nan := float32(math.NaN())
	byName := func(n string) FineLayer {
		return FineLayers[slices.IndexFunc(FineLayers, func(l FineLayer) bool { return l.Name == n })]
	}
	for name, want := range map[string][]float32{
		"wald":      {0, 1, 1, nan, nan},
		"fichte":    {nan, 1, 0, nan, 0},
		"nadelholz": {nan, 1, 0, nan, 1},
	} {
		got := TreeField(classes, inland, byName(name))
		for i := range want {
			if !near(got[i], want[i], 0, 0) {
				t.Fatalf("%s point %d: got %v, want %v", name, i, got[i], want[i])
			}
		}
	}
}

// TestInlandMaskBurnsOutline checks that the reprojected outline gives
// features to gdal_rasterize, so that the inland mask is not empty.
func TestInlandMaskBurnsOutline(t *testing.T) {
	r := &fineRun{in: FineInputs{Trees: in("trees_32632.tif"), Outline: in("outline.geojson")}}
	if err := r.openTrees(t.TempDir()); err != nil {
		t.Fatal(err)
	}
	defer r.close()
	gt, err := r.trees.ds.GeoTransform()
	if err != nil {
		t.Fatal(err)
	}
	mask, w, h, err := inlandMask(r.outline, r.trees.bounds, math.Abs(gt[1]))
	if err != nil {
		t.Fatal(err)
	}
	inland := len(slices.DeleteFunc(slices.Clone(mask), func(v uint8) bool { return v == 0 }))
	if inland == 0 || inland == w*h {
		t.Fatalf("inland mask burns %d of %d pixels, want a part of the box", inland, w*h)
	}
}
