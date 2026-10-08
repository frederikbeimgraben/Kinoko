package render

import (
	"context"
	"encoding/json"
	"io/fs"
	"math"
	"os"
	"path/filepath"
	"regexp"
	"slices"
	"strconv"
	"testing"
	"time"

	"github.com/frederikbeimgraben/kinoko/backend/internal/pipeline/core/calendar"
	"github.com/frederikbeimgraben/kinoko/backend/internal/pipeline/core/geo"
	"github.com/frederikbeimgraben/kinoko/backend/internal/pipeline/model/bundle"
	"github.com/frederikbeimgraben/kinoko/backend/internal/pipeline/occ"
	"github.com/frederikbeimgraben/kinoko/backend/internal/pipeline/tiles"
	"github.com/frederikbeimgraben/kinoko/backend/internal/pipeline/weather"
)

// golden holds the fixtures of testdata/gen_golden.py: region_map.main (--region tt --weeks 4 --forecast 2
// --tiles --no-image) and input_layers.main (--only-weekly --weeks 3 --tiles) of modell/src/pilze on a
// synthetic region of 616 cells. The inputs are beside the outputs.
const golden = "testdata/golden"

var goldenRegion = [4]float64{9.40, 51.25, 9.60, 51.35}

func goldenPath(parts ...string) string { return filepath.Join(append([]string{golden}, parts...)...) }

func readJSON(t *testing.T, path string, v any) {
	t.Helper()
	data, err := os.ReadFile(path)
	if err != nil {
		t.Fatal(err)
	}
	if err := json.Unmarshal(data, v); err != nil {
		t.Fatalf("%s: %v", path, err)
	}
}

// goldenCube reads weather.json: the cells, the weeks and each variable as [w*len(cells)+c].
func goldenCube(t *testing.T, vars ...string) *weather.Cube {
	t.Helper()
	var raw struct {
		Cells []string             `json:"cells"`
		Weeks [][2]int             `json:"weeks"`
		Vars  map[string][]float64 `json:"vars"`
	}
	readJSON(t, goldenPath("input", "weather.json"), &raw)
	cells := make([]geo.CellKey, len(raw.Cells))
	for i, s := range raw.Cells {
		k, err := geo.ParseCellKey(s)
		if err != nil {
			t.Fatal(err)
		}
		cells[i] = k
	}
	weeks := make([]calendar.Week, len(raw.Weeks))
	for i, w := range raw.Weeks {
		weeks[i] = calendar.Week{Year: w[0], Week: w[1]}
	}
	out := map[string][]float32{}
	for _, v := range vars {
		col := make([]float32, len(raw.Vars[v]))
		for i, x := range raw.Vars[v] {
			col[i] = float32(x)
		}
		out[v] = col
	}
	return weather.NewCube(cells, weeks, out)
}

func goldenRecords(t *testing.T) []occ.Record {
	t.Helper()
	var raw []struct {
		X, Y                    float64
		Date, Species, Observer string
	}
	readJSON(t, goldenPath("input", "records.json"), &raw)
	out := make([]occ.Record, len(raw))
	for i, r := range raw {
		d, err := time.Parse("2006-01-02", r.Date)
		if err != nil {
			t.Fatal(err)
		}
		y, w := d.ISOWeek()
		out[i] = occ.Record{X: r.X, Y: r.Y, Date: d, Species: r.Species, Observer: r.Observer,
			ISOYear: y, ISOWeek: w, Uncertainty: math.NaN(), Cell: geo.CellOf(r.X, r.Y, TrainCell)}
	}
	return out
}

func goldenTables(t *testing.T, cols []string) Tables {
	t.Helper()
	tb, err := LoadTables(goldenPath("input", "trees_de_500m.parquet"), goldenPath("input", "tree_scales.parquet"),
		goldenPath("input", "site_500m.parquet"), cols)
	if err != nil {
		t.Fatal(err)
	}
	return tb
}

var numberRe = regexp.MustCompile(`-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?`)

// compareText checks that two manifests are equal byte for byte outside the
// numbers, and that each number differs by at most tol (relative above 1).
// It returns the count of numbers that are not byte-equal.
func compareText(t *testing.T, name string, got, want []byte, tol float64) int {
	t.Helper()
	gs, ws := numberRe.Split(string(got), -1), numberRe.Split(string(want), -1)
	gn, wn := numberRe.FindAllString(string(got), -1), numberRe.FindAllString(string(want), -1)
	if !slices.Equal(gs, ws) || len(gn) != len(wn) {
		for i := range min(len(gs), len(ws)) {
			if gs[i] != ws[i] {
				t.Fatalf("%s: text differs at part %d: %q against %q", name, i, gs[i], ws[i])
			}
		}
		t.Fatalf("%s: structure differs (%d against %d parts)", name, len(gs), len(ws))
	}
	off := 0
	for i := range gn {
		if gn[i] == wn[i] {
			continue
		}
		off++
		t.Logf("%s: number %d is %s, Python wrote %s", name, i, gn[i], wn[i])
		a, _ := strconv.ParseFloat(gn[i], 64)
		b, _ := strconv.ParseFloat(wn[i], 64)
		if math.Abs(a-b) > tol*max(1, math.Abs(b)) {
			t.Errorf("%s: number %d is %s, want %s", name, i, gn[i], wn[i])
		}
	}
	return off
}

// compareTiles checks that both trees hold the same PNG files and that the
// decoded bytes differ by at most one step on at most 0.1 % of the points.
func compareTiles(t *testing.T, gotRoot, wantRoot string) int {
	t.Helper()
	list := func(root string) []string {
		var out []string
		_ = filepath.WalkDir(root, func(p string, d fs.DirEntry, err error) error {
			if err == nil && !d.IsDir() && filepath.Ext(p) == ".png" {
				rel, _ := filepath.Rel(root, p)
				out = append(out, rel)
			}
			return nil
		})
		return out
	}
	got, want := list(gotRoot), list(wantRoot)
	if !slices.Equal(got, want) {
		t.Fatalf("tile sets differ under %s:\n got %v\nwant %v", wantRoot, got, want)
	}
	for _, rel := range want {
		a, b := decodeFile(t, filepath.Join(gotRoot, rel)), decodeFile(t, filepath.Join(wantRoot, rel))
		off := 0
		for i := range a {
			d := int(a[i]) - int(b[i])
			if d > 1 || d < -1 || (a[i] == 0) != (b[i] == 0) {
				t.Fatalf("tile %s point %d: %d against %d", rel, i, a[i], b[i])
			}
			if d != 0 {
				off++
			}
		}
		if off*1000 > len(a) {
			t.Errorf("tile %s: %d points differ by one step", rel, off)
		}
		if off > 0 {
			t.Logf("tile %s: %d points differ by one step", rel, off)
		}
	}
	return len(want)
}

func decodeFile(t *testing.T, path string) []uint8 {
	t.Helper()
	data, err := os.ReadFile(path)
	if err != nil {
		t.Fatal(err)
	}
	code, err := tiles.DecodePNG(data)
	if err != nil {
		t.Fatal(err)
	}
	return code
}

func TestRenderSpeciesMatchesRegionMap(t *testing.T) {
	b, err := bundle.Load(goldenPath("input", "bundle"))
	if err != nil {
		t.Fatal(err)
	}
	defer b.Close()
	maps := t.TempDir()
	cfg := DefaultConfig("steinpilz-test", maps)
	cfg.Region, cfg.Weeks, cfg.Forecast, cfg.Threads = goldenRegion, 4, 2, 1
	cfg.Spill = true
	cfg.ChunkRows = 250 // several chunks over 616 rows
	in := Inputs{Tables: goldenTables(t, ScaleColumns(b)), Weather: goldenCube(t, "pr", "tas", "tasmin"),
		Records: goldenRecords(t), Bundle: b, Warper: tiles.NewGDALWarper()}
	if _, err := Species(context.Background(), in, cfg); err != nil {
		t.Fatal(err)
	}
	got, err := os.ReadFile(filepath.Join(maps, "steinpilz-test.json"))
	if err != nil {
		t.Fatal(err)
	}
	want, err := os.ReadFile(goldenPath("maps", "steinpilz-test.json"))
	if err != nil {
		t.Fatal(err)
	}
	if off := compareText(t, "species manifest", got, want, 1e-9); off != 0 {
		t.Errorf("species manifest: %d numbers are not byte-equal", off)
	}
	n := compareTiles(t, filepath.Join(maps, "steinpilz-test_kacheln"), goldenPath("maps", "steinpilz-test_kacheln"))
	t.Logf("manifest byte-equal, %d tiles equal", n)
}

func TestRenderLayersMatchesInputLayers(t *testing.T) {
	maps := t.TempDir()
	old, err := os.ReadFile(goldenPath("input", "old_layers.json"))
	if err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(filepath.Join(maps, LayersFile), old, 0o644); err != nil {
		t.Fatal(err)
	}
	cfg := DefaultLayerConfig(maps)
	cfg.Weeks = 3
	in := LayerInputs{Tables: goldenTables(t, nil), Warper: tiles.NewGDALWarper(),
		Weather: goldenCube(t, "pr", "tas", "tasmin", "tasmax", "hurs", "paws_spruce", "paws_beech",
			"paws_oak", "paws_pine", "days_since_rain", "frost_days", "heat_days")}
	if _, err := Layers(context.Background(), in, cfg); err != nil {
		t.Fatal(err)
	}
	got, err := os.ReadFile(filepath.Join(maps, LayersFile))
	if err != nil {
		t.Fatal(err)
	}
	want, err := os.ReadFile(goldenPath("maps", LayersFile))
	if err != nil {
		t.Fatal(err)
	}
	// Only "bounds" may differ: geo.InvLAEA3035 is 1 to 3 ULP from pyproj there.
	off := compareText(t, "layers.json", got, want, 1e-12)
	n := compareTiles(t, filepath.Join(maps, "layers_kacheln"), goldenPath("maps", "layers_kacheln"))
	t.Logf("%d tiles equal; %d numbers of layers.json not byte-equal", n, off)
}
