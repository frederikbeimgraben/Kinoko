package render

import (
	"math"
	"os"
	"path/filepath"
	"slices"
	"testing"

	"github.com/frederikbeimgraben/kinoko/backend/internal/pipeline/core/pyjson"
	"github.com/frederikbeimgraben/kinoko/backend/internal/pipeline/pio"
)

func TestSmoothKeepsMaskedCellsEmptyWithoutSpill(t *testing.T) {
	ny, nx := 7, 9
	field := make([]float64, ny*nx)
	for i := range field {
		field[i] = 0.2 + 0.01*float64(i%nx)
	}
	field[3*nx+4] = math.NaN()
	field[0] = math.NaN()
	spilled := Smooth(field, ny, nx, 1.2, true)
	kept := Smooth(field, ny, nx, 1.2, false)
	if math.IsNaN(spilled[3*nx+4]) {
		t.Fatal("spill must fill a masked cell inside the field")
	}
	if !math.IsNaN(kept[3*nx+4]) || !math.IsNaN(kept[0]) {
		t.Fatal("without spill a masked cell must stay empty")
	}
	for i := range field {
		if !math.IsNaN(field[i]) && kept[i] != spilled[i] {
			t.Fatalf("cell %d: %v against %v", i, kept[i], spilled[i])
		}
	}
}

// TestGridPlacesByPosition shuffles the rows of the trees grid: the raster
// must not change, because cells are placed by (gy, gx) and not by row order.
func TestGridPlacesByPosition(t *testing.T) {
	b := Bounds{X0: 4_000_000, Y0: 3_000_000, X1: 4_002_000, Y1: 3_001_500}
	var xs, ys []float64
	for gy := range 3 {
		for gx := range 4 {
			xs = append(xs, float64(b.X0)+(float64(gx)+0.5)*500)
			ys = append(ys, float64(b.Y1)-(float64(gy)+0.5)*500)
		}
	}
	raster := func(order []int) []float64 {
		tb := pio.NewTable(len(order))
		tb.F64["x"], tb.F64["y"] = pick(xs, order), pick(ys, order)
		g, err := NewGrid(b, 500, Tables{Trees: tb}, nil)
		if err != nil {
			t.Fatal(err)
		}
		return place(g, g.X, math.NaN())
	}
	ordered := raster([]int{0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11})
	shuffled := raster([]int{7, 2, 11, 0, 5, 9, 1, 10, 3, 8, 4, 6})
	if !slices.Equal(ordered, shuffled) || !slices.Equal(ordered, xs) {
		t.Fatalf("placement depends on row order: %v against %v", ordered, shuffled)
	}
}

func TestDecodeOrderedKeepsText(t *testing.T) {
	want := pyjson.MarshalManifest(pyjson.O("b", []any{1e-05, 151.9, 0.0, 3}, "a",
		pyjson.O("x", "Höhe", "n", nil, "t", true, "e", []any{})))
	v, err := decodeOrdered(want)
	if err != nil {
		t.Fatal(err)
	}
	if got := pyjson.MarshalManifest(v); string(got) != string(want) {
		t.Fatalf("round trip changed the text:\n%s\n%s", got, want)
	}
}

func writeFile(t *testing.T, path, text string) {
	t.Helper()
	if err := os.MkdirAll(filepath.Dir(path), 0o755); err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(path, []byte(text), 0o644); err != nil {
		t.Fatal(err)
	}
}

func exists(path string) bool {
	_, err := os.Stat(path)
	return err == nil
}

func TestCleanupRemovesWeeksThatNoManifestNames(t *testing.T) {
	maps := t.TempDir()
	writeFile(t, filepath.Join(maps, "steinpilz.json"),
		`{"name": "steinpilz", "weeks": [{"tiles": "steinpilz_kacheln/2026W10"}, {"tiles": "steinpilz_kacheln/2026W11"}]}`)
	writeFile(t, filepath.Join(maps, "leer.json"), `{"name": "leer", "weeks": []}`)
	writeFile(t, filepath.Join(maps, LayersFile), `{"layers": {
		"regen": {"static": false, "tiles": "layers_kacheln/regen", "weeks": ["2026W11"]},
		"wald": {"static": true, "tiles": "layers_kacheln/wald"}}}`)
	for _, p := range []string{
		"steinpilz_kacheln/2026W09/5/1/1.png", "steinpilz_kacheln/2026W10/5/1/1.png",
		"steinpilz_kacheln/2026W11/5/1/1.png", "leer_kacheln/2026W01/5/1/1.png",
		"layers_kacheln/regen/2026W10/5/1/1.png", "layers_kacheln/regen/2026W11/5/1/1.png",
		"layers_kacheln/wald/5/1/1.png",
	} {
		writeFile(t, filepath.Join(maps, p), "x")
	}
	if err := Cleanup(maps); err != nil {
		t.Fatal(err)
	}
	for p, want := range map[string]bool{
		"steinpilz_kacheln/2026W09": false, "steinpilz_kacheln/2026W10": true,
		"steinpilz_kacheln/2026W11": true, "leer_kacheln/2026W01": true,
		"layers_kacheln/regen/2026W10": false, "layers_kacheln/regen/2026W11": true,
		"layers_kacheln/wald/5": true,
	} {
		if exists(filepath.Join(maps, p)) != want {
			t.Errorf("%s: exists %v, want %v", p, !want, want)
		}
	}
}

func TestInstallStaticLayersMergesStaticFirst(t *testing.T) {
	maps, src := t.TempDir(), t.TempDir()
	writeFile(t, filepath.Join(maps, LayersFile), `{"bounds": [[47.0, 5.5], [55.0, 15.5]], "layers": {
 "regen": {"label": "Regen", "static": false, "tiles": "layers_kacheln/regen", "weeks": ["2026W11"]},
 "relief": {"label": "alt", "static": true, "tiles": "layers_kacheln/relief"},
 "hoehe": {"label": "Höhe", "static": true, "tiles": "layers_kacheln/hoehe"}}}`)
	writeFile(t, filepath.Join(maps, "layers_kacheln/relief/5/1/1.png"), "old")
	writeFile(t, filepath.Join(src, LayersFile), `{"layers": {
 "relief": {"label": "neu", "static": true, "low": 1e-05, "tiles": "layers_kacheln/relief"},
 "wald": {"label": "Wald", "static": true, "tiles": "layers_kacheln/wald"}}}`)
	writeFile(t, filepath.Join(src, "layers_kacheln/relief/6/2/2.png"), "new")
	writeFile(t, filepath.Join(src, "layers_kacheln/wald/5/1/1.png"), "wald")
	res, err := InstallStaticLayers(maps, StaticSource{Dir: src})
	if err != nil {
		t.Fatal(err)
	}
	if got := layerEntries(res.Manifest).Keys(); !slices.Equal(got, []string{"relief", "wald", "hoehe", "regen"}) {
		t.Fatalf("order %v", got)
	}
	if exists(filepath.Join(maps, "layers_kacheln/relief/5/1/1.png")) || !exists(filepath.Join(maps, "layers_kacheln/relief/6/2/2.png")) ||
		!exists(filepath.Join(maps, "layers_kacheln/wald/5/1/1.png")) {
		t.Fatal("the tile folders were not replaced")
	}
	data, _ := os.ReadFile(filepath.Join(maps, LayersFile))
	if string(data) != string(pyjson.MarshalManifest(res.Manifest)) || !res.Written {
		t.Fatal("layers.json differs from the returned manifest")
	}
	writeFile(t, filepath.Join(src, LayersFile), `{"layers": {"x": {"static": true, "tiles": "../x"}}}`)
	if _, err := InstallStaticLayers(maps, StaticSource{Dir: src}); err == nil {
		t.Fatal("a tile path outside layers_kacheln must fail")
	}
	writeFile(t, filepath.Join(src, LayersFile), `{"layers": {"regen": {"static": false, "tiles": "layers_kacheln/regen"}}}`)
	if _, err := InstallStaticLayers(maps, StaticSource{Dir: src}); err == nil {
		t.Fatal("a weekly layer in a static source must fail")
	}
}

func TestInstallStaticLayersCopiesAVersionOnce(t *testing.T) {
	maps, upload, dem := t.TempDir(), t.TempDir(), t.TempDir()
	writeFile(t, filepath.Join(upload, LayersFile), `{"bounds": [[47.0, 5.5], [55.0, 15.5]], "layers": {
 "hoehe": {"label": "alt", "static": true, "tiles": "layers_kacheln/hoehe"},
 "relief": {"label": "Relief", "static": true, "tiles": "layers_kacheln/relief"}}}`)
	writeFile(t, filepath.Join(upload, "layers_kacheln/hoehe/5/1/1.png"), "upload")
	writeFile(t, filepath.Join(upload, "layers_kacheln/relief/5/1/1.png"), "relief")
	writeFile(t, filepath.Join(dem, LayersFile), `{"layers": {
 "hoehe": {"label": "Höhe", "static": true, "tiles": "layers_kacheln/hoehe"}}}`)
	writeFile(t, filepath.Join(dem, "layers_kacheln/hoehe/6/2/2.png"), "dem")
	srcs := []StaticSource{{Dir: upload, Tag: "static-layers/v1"}, {Dir: dem, Tag: "dem/v1"}}
	first, err := InstallStaticLayers(maps, srcs...)
	if err != nil {
		t.Fatal(err)
	}
	if !slices.Equal(first.Copied, []string{"hoehe", "relief"}) || len(first.Kept) != 0 || !first.Written {
		t.Fatalf("first: %+v", first)
	}
	entry, _ := layerEntries(first.Manifest).Get("hoehe")
	if label, _ := entry.(*pyjson.Obj).Get("label"); label != "Höhe" {
		t.Fatalf("the later source must win: %v", label)
	}
	if exists(filepath.Join(maps, "layers_kacheln/hoehe/5/1/1.png")) || !exists(filepath.Join(maps, "layers_kacheln/hoehe/6/2/2.png")) {
		t.Fatal("hoehe must hold the tiles of the dem")
	}
	if markerOf(filepath.Join(maps, "layers_kacheln/hoehe")) != "dem/v1" {
		t.Fatal("the marker must name the dem version")
	}
	stamp := filepath.Join(maps, "layers_kacheln/relief/5/1/1.png")
	writeFile(t, stamp, "published")
	again, err := InstallStaticLayers(maps, srcs...)
	if err != nil {
		t.Fatal(err)
	}
	if len(again.Copied) != 0 || !slices.Equal(again.Kept, []string{"hoehe", "relief"}) || again.Written {
		t.Fatalf("again: %+v", again)
	}
	if data, _ := os.ReadFile(stamp); string(data) != "published" {
		t.Fatal("the same version must not copy the tiles again")
	}
	srcs[1].Tag = "dem/v2"
	next, err := InstallStaticLayers(maps, srcs...)
	if err != nil || !slices.Equal(next.Copied, []string{"hoehe"}) || next.Written {
		t.Fatalf("next: %+v, %v", next, err)
	}
	if exists(filepath.Join(maps, "layers_kacheln/hoehe.tmp")) || exists(filepath.Join(maps, "layers_kacheln/hoehe.old")) {
		t.Fatal("the replacement left a temporary folder")
	}
}

func TestLayerScale(t *testing.T) {
	vals := []float32{-12.34, 0.5, 3, 7.77, float32(math.NaN()), 25}
	cases := map[string][2]float64{
		"regen_anomalie": {-24.3, 24.3}, "regen": {0, 24.3},
		"temperatur": {-11.8, 24.3}, "frosttage": {0, 7},
	}
	for _, l := range WeeklyLayers {
		want, ok := cases[l.Name]
		if !ok {
			continue
		}
		if got := layerScale(l, vals); got != want {
			t.Errorf("%s: %v, want %v", l.Name, got, want)
		}
	}
}

func TestWeatherInputsNameOnlyTheCheckpointsOfTheTask(t *testing.T) {
	got := WeatherInputs([]string{"forest_fraction_500m", "pr_sum4_anom", "tas_lag1", "fichte_scale"})
	if !slices.Equal(got, []string{"pr", "tas"}) {
		t.Fatalf("species inputs %v", got)
	}
	want := []string{"days_since_rain", "frost_days", "heat_days", "hurs", "paws_beech", "paws_oak", "paws_pine",
		"paws_spruce", "pr", "tas", "tasmax", "tasmin"}
	if got := LayerWeather(); !slices.Equal(got, want) {
		t.Fatalf("layer inputs %v", got)
	}
	if got := ScaleColumnsOf([]string{"tas_lag1", "buche", "buche"}); !slices.Equal(got, []string{"buche", "forest_fraction_500m", "tas_lag1"}) {
		t.Fatalf("scale columns %v", got)
	}
}
