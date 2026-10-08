package weather

import (
	"math"
	"path/filepath"
	"slices"
	"testing"

	"github.com/frederikbeimgraben/kinoko/backend/internal/pipeline/core/calendar"
	"github.com/frederikbeimgraben/kinoko/backend/internal/pipeline/core/geo"
	"github.com/frederikbeimgraben/kinoko/backend/internal/pipeline/pio"
)

// mergedGolden is testdata/merged.json: merge_weekly.main on the checkpoints in
// testdata/py_weekly, which extract_grids.main wrote (testdata/gen_golden.py).
type mergedGolden struct {
	Columns []string `json:"columns"`
	Rows    [][]any  `json:"rows"`
}

func TestLoadCubeAndWriteMergedMatchPython(t *testing.T) {
	var g mergedGolden
	readJSON(t, "testdata/merged.json", &g)
	cube, err := LoadCube("testdata/py_weekly", nil)
	if err != nil {
		t.Fatal(err)
	}
	if len(cube.Weeks) != 6 || len(cube.Cells) != 5 {
		t.Fatalf("cube has %d weeks and %d cells", len(cube.Weeks), len(cube.Cells))
	}
	path := filepath.Join(t.TempDir(), "weather_weekly.parquet")
	if err := WriteMerged(path, cube); err != nil {
		t.Fatal(err)
	}
	info, err := pio.Inspect(path)
	if err != nil {
		t.Fatal(err)
	}
	names := make([]string, len(info.Columns))
	for i, c := range info.Columns {
		names[i] = c.Name
	}
	if !slices.Equal(names, g.Columns) {
		t.Fatalf("columns %v, want %v", names, g.Columns)
	}
	tab, err := pio.ReadParquet(path, nil)
	if err != nil {
		t.Fatal(err)
	}
	if tab.N != len(g.Rows) {
		t.Fatalf("%d rows, want %d", tab.N, len(g.Rows))
	}
	for i, row := range g.Rows {
		if int(tab.I64["iso_year"][i]) != int(row[0].(float64)) || int(tab.I64["iso_week"][i]) != int(row[1].(float64)) ||
			tab.Str["cell"][i] != row[2].(string) {
			t.Fatalf("row %d keys differ: %v", i, row[:3])
		}
		for j, col := range g.Columns[3:] {
			want := math.NaN()
			if row[3+j] != nil {
				want = row[3+j].(float64)
			}
			if got := float64(tab.F32[col][i]); !close32(got, want) {
				t.Errorf("row %d %s = %v, want %v", i, col, got, want)
			}
		}
	}
}

func TestLoadCubeIsOuterJoin(t *testing.T) {
	dir := t.TempDir()
	copyTree(t, "testdata/py_weekly", dir)
	// The soil stand lacks 2021 and one cell, as after a failed soil fetch (bug 3).
	partial, err := readCheckpoint(CheckpointPath(dir, "paws_spruce"), "paws_spruce",
		func(w calendar.Week) bool { return w.Year == 2020 })
	if err != nil {
		t.Fatal(err)
	}
	var kept rows
	for i, c := range partial.cells {
		if c != "820_600" {
			kept.add(partial.weeks[i], c, partial.vals[i])
		}
	}
	kept.add(calendar.Week{Year: 2020, Week: 52}, "999_999", 7)
	if err := writeCheckpoint(CheckpointPath(dir, "paws_spruce"), "paws_spruce", kept.sorted()); err != nil {
		t.Fatal(err)
	}
	cube, err := LoadCube(dir, []string{"pr", "paws_spruce"})
	if err != nil {
		t.Fatal(err)
	}
	if len(cube.Cells) != 6 || len(cube.Weeks) != 6 {
		t.Fatalf("cube has %d cells and %d weeks", len(cube.Cells), len(cube.Weeks))
	}
	full, err := LoadCube("testdata/py_weekly", []string{"pr"})
	if err != nil {
		t.Fatal(err)
	}
	extra, _ := cube.Index(geo.CellKey{X: 999, Y: 999})
	gone, _ := cube.Index(geo.CellKey{X: 820, Y: 600})
	for w, week := range cube.Weeks {
		for i, k := range cube.Cells {
			soil := cube.At("paws_spruce", w, i)
			wantNaN := week.Year == 2021 || i == gone || (i == extra && week.Week != 52)
			if isNaN32(soil) != wantNaN {
				t.Errorf("%s %s paws_spruce = %v", week, k, soil)
			}
			j, ok := full.Index(k)
			pr := cube.At("pr", w, i)
			if ok && pr != full.At("pr", w, j) && !(isNaN32(pr) && isNaN32(full.At("pr", w, j))) {
				t.Errorf("%s %s pr changed", week, k)
			}
			if !ok && !isNaN32(pr) {
				t.Errorf("%s %s pr = %v for a cell without rain", week, k, pr)
			}
		}
	}
}

func TestLoadCubeWithoutFiles(t *testing.T) {
	if _, err := LoadCube(t.TempDir(), nil); err == nil {
		t.Error("no error for an empty directory")
	}
	if _, err := LoadCube(t.TempDir(), []string{"pr"}); err == nil {
		t.Error("no error for a missing checkpoint")
	}
}

func TestLoadCubeOnlyCells(t *testing.T) {
	keep := []geo.CellKey{{X: 821, Y: 601}}
	cube, err := LoadCube("testdata/py_weekly", []string{"tas"}, OnlyCells(keep))
	if err != nil {
		t.Fatal(err)
	}
	if !slices.Equal(cube.Cells, keep) || len(cube.Vars["tas"]) != len(cube.Weeks) {
		t.Errorf("cells %v, %d values", cube.Cells, len(cube.Vars["tas"]))
	}
}

func TestCubeForecastAndRestrict(t *testing.T) {
	cells := []geo.CellKey{{X: 1, Y: 1}, {X: 2, Y: 1}, {X: 3, Y: 1}}
	weeks := []calendar.Week{{Year: 2020, Week: 51}, {Year: 2020, Week: 52}}
	cube := NewCube(cells, weeks, map[string][]float32{"pr": {1, 2, 3, 4, 5, 6}})
	fc := cube.WithForecast(2)
	want := []calendar.Week{{Year: 2020, Week: 51}, {Year: 2020, Week: 52}, {Year: 2020, Week: 53}, {Year: 2021, Week: 1}}
	if !slices.Equal(fc.Weeks, want) {
		t.Fatalf("weeks %v", fc.Weeks)
	}
	if fc.LastObserved() != (calendar.Week{Year: 2020, Week: 52}) || fc.Observed() != 2 {
		t.Errorf("last observed %v", fc.LastObserved())
	}
	if fc.At("pr", 1, 2) != 6 || !isNaN32(fc.At("pr", 2, 0)) || !isNaN32(fc.At("tas", 0, 0)) {
		t.Errorf("values %v", fc.Vars["pr"])
	}
	r := fc.Restrict([]geo.CellKey{{X: 3, Y: 1}, {X: 9, Y: 9}, {X: 1, Y: 1}}, calendar.Week{Year: 2020, Week: 52})
	if !slices.Equal(r.Cells, []geo.CellKey{{X: 3, Y: 1}, {X: 1, Y: 1}}) || len(r.Weeks) != 3 || r.Observed() != 1 {
		t.Fatalf("restricted %v %v %d", r.Cells, r.Weeks, r.Observed())
	}
	if r.At("pr", 0, 0) != 6 || r.At("pr", 0, 1) != 4 || !isNaN32(r.At("pr", 1, 0)) {
		t.Errorf("restricted values %v", r.Vars["pr"])
	}
	if i, ok := r.Index(geo.CellKey{X: 1, Y: 1}); !ok || i != 1 {
		t.Errorf("index %d %v", i, ok)
	}
}
