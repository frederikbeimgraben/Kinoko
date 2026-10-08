package fit

import (
	"compress/gzip"
	"encoding/json"
	"io"
	"math"
	"os"
	"strconv"
	"testing"
	"time"

	"github.com/frederikbeimgraben/kinoko/backend/internal/pipeline/core/calendar"
	"github.com/frederikbeimgraben/kinoko/backend/internal/pipeline/core/geo"
	"github.com/frederikbeimgraben/kinoko/backend/internal/pipeline/model/train"
	"github.com/frederikbeimgraben/kinoko/backend/internal/pipeline/occ"
	"github.com/frederikbeimgraben/kinoko/backend/internal/pipeline/weather"
)

// inputsFile is testdata/inputs.json.gz, the synthetic inputs that testdata/gen_golden.py writes.
type inputsFile struct {
	Records []struct {
		GBIFID   string   `json:"gbifID"`
		Species  *string  `json:"species"`
		Observer *string  `json:"observer"`
		Basis    string   `json:"basis"`
		Lat      float64  `json:"lat"`
		Lon      float64  `json:"lon"`
		Unc      *float64 `json:"unc"`
		Date     string   `json:"date"`
		ISOYear  int      `json:"iso_year"`
		ISOWeek  int      `json:"iso_week"`
		DOY      int      `json:"doy"`
		X, Y     float64
		Cell     string `json:"cell"`
	} `json:"records"`
	Taxa    []string `json:"taxa"`
	Weather struct {
		Cells []string             `json:"cells"`
		Weeks [][2]int             `json:"weeks"`
		Vars  map[string][]float64 `json:"vars"`
	} `json:"weather"`
	Trees struct {
		Cells   []string             `json:"cells"`
		Columns []string             `json:"columns"`
		Values  map[string][]float64 `json:"values"`
	} `json:"trees"`
}

func readGz(t *testing.T, path string, v any) {
	t.Helper()
	f, err := os.Open(path)
	if err != nil {
		t.Fatal(err)
	}
	defer f.Close()
	r, err := gzip.NewReader(f)
	if err != nil {
		t.Fatal(err)
	}
	data, err := io.ReadAll(r)
	if err != nil {
		t.Fatal(err)
	}
	if err := json.Unmarshal(data, v); err != nil {
		t.Fatal(err)
	}
}

func deref(s *string) string {
	if s == nil {
		return ""
	}
	return *s
}

// loadInputs reads the synthetic inputs and returns them with the target taxa.
func loadInputs(t *testing.T) (Inputs, []string) {
	t.Helper()
	var f inputsFile
	readGz(t, "testdata/inputs.json.gz", &f)
	records := make([]occ.Record, len(f.Records))
	for i, r := range f.Records {
		date, err := time.Parse(time.DateOnly, r.Date)
		cell, err2 := geo.ParseCellKey(r.Cell)
		if err != nil || err2 != nil {
			t.Fatal(err, err2)
		}
		unc := math.NaN()
		if r.Unc != nil {
			unc = *r.Unc
		}
		records[i] = occ.Record{GBIFID: r.GBIFID, Species: deref(r.Species), Observer: deref(r.Observer), Basis: r.Basis,
			Lat: r.Lat, Lon: r.Lon, Uncertainty: unc, Date: date, ISOYear: r.ISOYear, ISOWeek: r.ISOWeek, DOY: r.DOY,
			X: r.X, Y: r.Y, Cell: cell}
	}
	cells := make([]geo.CellKey, len(f.Weather.Cells))
	for i, c := range f.Weather.Cells {
		k, err := geo.ParseCellKey(c)
		if err != nil {
			t.Fatal(err)
		}
		cells[i] = k
	}
	weeks := make([]calendar.Week, len(f.Weather.Weeks))
	for i, w := range f.Weather.Weeks {
		weeks[i] = calendar.Week{Year: w[0], Week: w[1]}
	}
	vars := map[string][]float32{}
	for name, vals := range f.Weather.Vars {
		vars[name] = to32(vals)
	}
	trees := TreeScales{Cells: f.Trees.Cells, Columns: f.Trees.Columns, Values: map[string][]float32{}}
	for name, vals := range f.Trees.Values {
		trees.Values[name] = to32(vals)
	}
	cube := weather.NewCube(cells, weeks, vars)
	return Inputs{Records: records, Weather: CubeWeather{All: cube}, TreeScales: trees}, f.Taxa
}

func to32(v []float64) []float32 {
	out := make([]float32, len(v))
	for i, x := range v {
		out[i] = float32(x)
	}
	return out
}

// testGrid is GRID with the settings that gen_golden.py adds for a deterministic run.
func testGrid() []train.Setting {
	grid := train.WithThreads(train.Grid(), 1)
	for i, s := range grid {
		grid[i].Params = s.Params.With("deterministic", true).With("force_col_wise", true)
	}
	return grid
}

func testConfig(taxa []string) Config {
	return Config{Label: "testus_chain", Slug: "testus-chain", Species: taxa, Horizons: []int{0, 2}, Grid: testGrid(),
		Now: func() time.Time { return time.Date(2026, 10, 8, 0, 0, 0, 0, time.UTC) }}
}

func near(got, want, tol float64) bool {
	if math.IsNaN(want) {
		return math.IsNaN(got)
	}
	return math.Abs(got-want) <= tol*max(1, math.Abs(want))
}

func nullable(v []*float64) []float64 {
	out := make([]float64, len(v))
	for i, p := range v {
		out[i] = math.NaN()
		if p != nil {
			out[i] = *p
		}
	}
	return out
}

func nearAll(got, want []float64, tol float64) bool {
	if len(got) != len(want) {
		return false
	}
	for i := range got {
		if !near(got[i], want[i], tol) {
			return false
		}
	}
	return true
}

func atoi(t *testing.T, s string) int {
	t.Helper()
	n, err := strconv.Atoi(s)
	if err != nil {
		t.Fatal(err)
	}
	return n
}

func itoa(n int) string { return strconv.Itoa(n) }

// subTable keeps the rows of t in rows.
func subTable(t *Table, rows []int) *Table {
	out := &Table{N: len(rows), Keys: pick(t.Keys, rows), Label: pick(t.Label, rows), ISOYear: pick(t.ISOYear, rows),
		ISOWeek: pick(t.ISOWeek, rows), NSpecies: pick(t.NSpecies, rows), X: pick(t.X, rows), Y: pick(t.Y, rows),
		Lon: pick(t.Lon, rows), Lat: pick(t.Lat, rows), Date: pick(t.Date, rows), Cell: pick(t.Cell, rows),
		Block: pick(t.Block, rows), Columns: map[string][]float64{}, Blocks: t.Blocks}
	for name, col := range t.Columns {
		out.Columns[name] = pick(col, rows)
	}
	return out
}
