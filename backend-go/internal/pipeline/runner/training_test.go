package runner_test

import (
	"compress/gzip"
	"context"
	"encoding/json"
	"math"
	"os"
	"path/filepath"
	"testing"
	"time"

	"github.com/frederikbeimgraben/kinoko/backend/internal/core/db"
	"github.com/frederikbeimgraben/kinoko/backend/internal/core/enums"
	"github.com/frederikbeimgraben/kinoko/backend/internal/modules/sources"
	"github.com/frederikbeimgraben/kinoko/backend/internal/pipeline/core/geo"
	"github.com/frederikbeimgraben/kinoko/backend/internal/pipeline/model/bundle"
	"github.com/frederikbeimgraben/kinoko/backend/internal/pipeline/model/fit"
	"github.com/frederikbeimgraben/kinoko/backend/internal/pipeline/model/train"
	"github.com/frederikbeimgraben/kinoko/backend/internal/pipeline/occ"
	"github.com/frederikbeimgraben/kinoko/backend/internal/pipeline/pio"
	"github.com/frederikbeimgraben/kinoko/backend/internal/pipeline/runner"
)

// fitInputs is model/fit/testdata/inputs.json.gz, the synthetic inputs of
// model/fit/testdata/gen_golden.py.
type fitInputs struct {
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

// fitGolden holds the fields of model/fit/testdata/golden.json.gz that the
// test reads: the output of final_model.main (gen_golden.py) on the inputs.
type fitGolden struct {
	Visits   int `json:"visits"`
	Horizons map[string]struct {
		Brier [2]float64 `json:"brier"`
	} `json:"horizons"`
}

func readGz(t *testing.T, path string, v any) {
	t.Helper()
	file, err := os.Open(path)
	if err != nil {
		t.Fatal(err)
	}
	defer file.Close()
	r, err := gzip.NewReader(file)
	if err != nil {
		t.Fatal(err)
	}
	if err := json.NewDecoder(r).Decode(v); err != nil {
		t.Fatal(err)
	}
}

func or(s *string) string {
	if s == nil {
		return ""
	}
	return *s
}

func records(t *testing.T, in fitInputs) []occ.Record {
	t.Helper()
	out := make([]occ.Record, len(in.Records))
	for i, r := range in.Records {
		date, err := time.Parse(time.DateOnly, r.Date)
		cell, err2 := geo.ParseCellKey(r.Cell)
		if err != nil || err2 != nil {
			t.Fatal(err, err2)
		}
		unc := math.NaN()
		if r.Unc != nil {
			unc = *r.Unc
		}
		out[i] = occ.Record{GBIFID: r.GBIFID, Species: or(r.Species), Observer: or(r.Observer), Basis: r.Basis,
			Lat: r.Lat, Lon: r.Lon, Uncertainty: unc, Date: date, ISOYear: r.ISOYear, ISOWeek: r.ISOWeek, DOY: r.DOY,
			X: r.X, Y: r.Y, Cell: cell}
	}
	return out
}

// writeCheckpoints writes the weather of the inputs as weekly checkpoints.
func writeCheckpoints(t *testing.T, dir string, in fitInputs) {
	t.Helper()
	nc := len(in.Weather.Cells)
	for name, vals := range in.Weather.Vars {
		tab := pio.NewTable(len(vals))
		years, weeks, cells, values := make([]int64, len(vals)), make([]int64, len(vals)), make([]string, len(vals)), make([]float32, len(vals))
		for k, v := range vals {
			w := in.Weather.Weeks[k/nc]
			years[k], weeks[k], cells[k], values[k] = int64(w[0]), int64(w[1]), in.Weather.Cells[k%nc], float32(v)
		}
		tab.I64["iso_year"], tab.I64["iso_week"], tab.Str["cell"], tab.F32[name] = years, weeks, cells, values
		schema := []pio.ColumnSpec{{Name: "iso_year", Type: pio.Int16}, {Name: "iso_week", Type: pio.Int8},
			{Name: "cell", Type: pio.String}, {Name: name, Type: pio.Float32}}
		if err := pio.WriteParquet(filepath.Join(dir, name+".parquet"), tab, schema); err != nil {
			t.Fatal(err)
		}
	}
}

// writeTreeScales writes the tree columns of the inputs as tree_scales.parquet.
func writeTreeScales(t *testing.T, file string, in fitInputs) {
	t.Helper()
	tab := pio.NewTable(len(in.Trees.Cells))
	tab.Str["cell"] = in.Trees.Cells
	schema := []pio.ColumnSpec{{Name: "cell", Type: pio.String}}
	for _, name := range in.Trees.Columns {
		col := make([]float32, len(in.Trees.Cells))
		for i, v := range in.Trees.Values[name] {
			col[i] = float32(v)
		}
		tab.F32[name] = col
		schema = append(schema, pio.ColumnSpec{Name: name, Type: pio.Float32})
	}
	if err := pio.WriteParquet(file, tab, schema); err != nil {
		t.Fatal(err)
	}
}

// fixtureChain is the real chain with the weather and occurrence steps
// replaced by the synthetic inputs, which need no DWD or GBIF files.
type fixtureChain struct {
	*runner.Chain
	records []occ.Record
}

func (c fixtureChain) Weather(context.Context, *runner.Job) error { return nil }

func (c fixtureChain) Occurrences(_ context.Context, j *runner.Job) error {
	j.Records = c.records
	return nil
}

func TestTrainingRunOnTheSyntheticFixtureInstallsAModel(t *testing.T) {
	if testing.Short() {
		t.Skip("trains LightGBM models")
	}
	var in fitInputs
	readGz(t, "../model/fit/testdata/inputs.json.gz", &in)
	var golden fitGolden
	readGz(t, "../model/fit/testdata/golden.json.gz", &golden)

	f := newFixture(t, 1)
	weekly := filepath.Join(f.data, "interim", "weekly")
	if err := os.MkdirAll(weekly, 0o755); err != nil {
		t.Fatal(err)
	}
	writeCheckpoints(t, weekly, in)
	scales := filepath.Join(t.TempDir(), "tree_scales.parquet")
	writeTreeScales(t, scales, in)
	if _, err := f.sources.Install(context.Background(), sources.Install{Kind: sources.KindTreeScales,
		Origin: sources.OriginUpload, From: scales, Artifact: "tree_scales", Activate: true}); err != nil {
		t.Fatal(err)
	}
	taxa, _ := json.Marshal(in.Taxa)
	f.exec(`UPDATE species_forecast SET taxa = ? WHERE species_id IN (SELECT id FROM species WHERE forecast_enabled = 1)`, string(taxa))

	grid := train.WithThreads(train.Grid(), 1)
	for i, s := range grid {
		grid[i].Params = s.Params.With("deterministic", true).With("force_col_wise", true)
	}
	maps := t.TempDir()
	chain := &runner.Chain{DB: f.env.DB, Sources: f.sources, Data: f.data, Maps: maps,
		Fit: fit.Config{Horizons: []int{0, 2}, Grid: grid}}
	f.runner = runner.New(runner.Config{DB: f.env.DB, Runs: f.runs, Sources: f.sources,
		Stages: fixtureChain{Chain: chain, records: records(t, in)}, Logs: f.env.Settings.RunLogs})
	run := f.queue(enums.RunKindTraining)
	f.runNext()

	got := f.get(run.ID)
	want := golden.Horizons["0"].Brier[1]
	if got.State != enums.RunStateFinished || got.MetricBrier == nil || math.Abs(*got.MetricBrier-want) > 1e-4 {
		t.Fatalf("run = %+v, want h0 Brier %v\n%s", got, want, f.logOf(run.ID))
	}
	sp := f.species(run.ID)
	if sp[0].State != enums.RunStateFinished || sp[0].Records != golden.Visits {
		t.Errorf("species = %+v, want %d records", sp, golden.Visits)
	}
	var id db.ID
	if err := f.env.DB.QueryRow("SELECT species_id FROM pipeline_run_species WHERE run_id = ?", run.ID).Scan(&id); err != nil {
		t.Fatal(err)
	}
	v, err := f.sources.Resolver().Active(sources.KindModelBundle, id.String())
	if err != nil || v.Origin != sources.OriginTraining || v.Number != 1 {
		t.Fatalf("model version = %+v, %v", v, err)
	}
	if v.Dir != filepath.Join(f.data, "models", sp[0].Slug, "v1") || v.Metadata["runId"] != run.ID.String() {
		t.Errorf("model version at %s with metadata %v", v.Dir, v.Metadata)
	}
	b, err := bundle.Load(v.Dir)
	if err != nil {
		t.Fatal(err)
	}
	defer b.Close()
	if b.Slug != sp[0].Slug || len(b.Horizons) != 2 || b.Visits != golden.Visits {
		t.Errorf("bundle = %s, %d horizons, %d visits", b.Slug, len(b.Horizons), b.Visits)
	}
	if _, err := os.Stat(filepath.Join(maps, "funde", sp[0].Slug+".json")); err != nil {
		t.Errorf("finds layer: %v", err)
	}
	if left, _ := filepath.Glob(filepath.Join(f.data, "tmp", "*")); len(left) != 0 {
		t.Errorf("staging left: %v", left)
	}
}
