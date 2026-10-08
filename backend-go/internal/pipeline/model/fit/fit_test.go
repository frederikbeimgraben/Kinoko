package fit

import (
	"context"
	"os"
	"path/filepath"
	"slices"
	"testing"

	"github.com/frederikbeimgraben/kinoko/backend/internal/pipeline/model/bundle"
	"github.com/frederikbeimgraben/kinoko/backend/internal/pipeline/model/lgbm"
	"github.com/frederikbeimgraben/kinoko/backend/internal/pipeline/model/train"
)

// golden is testdata/golden.json.gz. gen_golden.py writes it with the Python functions in its "source":
// visit_model.main --quick --save-prepared (the table), final_model.feature_list, design and prior_columns
// (the design matrix), final_model.main (the printed tables, the pickled bundle) and final_model.write_finds.
type golden struct {
	Keys   []string `json:"keys"`
	Label  []int8   `json:"label"`
	Blocks struct {
		Detection []string `json:"detection"`
		Season    []string `json:"season"`
		Weather   []string `json:"weather"`
		Trees     []string `json:"trees"`
		Activity  []string `json:"activity"`
	} `json:"blocks"`
	Design map[string]struct {
		Features []string   `json:"features"`
		X        []*float64 `json:"x"`
	} `json:"design"`
	Horizons map[string]struct {
		Candidates [][5]float64 `json:"candidates"`
		Settings   [][5]any     `json:"settings"`
		Brier      [2]float64   `json:"brier"`
		AUC        float64      `json:"auc"`
		Features   []string     `json:"features"`
		Setting    string       `json:"setting"`
		Rounds     int          `json:"rounds"`
		Ceiling    float64      `json:"ceiling"`
		IsoX       []float64    `json:"isoX"`
		IsoY       []float64    `json:"isoY"`
		Predict    []float64    `json:"predict"`
	} `json:"horizons"`
	Prior map[string]struct {
		Keys []string   `json:"keys"`
		Rate []*float64 `json:"rate"`
		N    []float64  `json:"n"`
	} `json:"prior"`
	Finds     string `json:"finds"`
	Visits    int    `json:"visits"`
	Positives int    `json:"positives"`
}

func loadGolden(t *testing.T) golden {
	t.Helper()
	var g golden
	readGz(t, "testdata/golden.json.gz", &g)
	return g
}

func TestTableAndDesignMatchPython(t *testing.T) {
	in, taxa := loadInputs(t)
	g := loadGolden(t)
	tab, stats, err := BuildTable(context.Background(), in, testConfig(taxa))
	if err != nil {
		t.Fatal(err)
	}
	if !slices.Equal(tab.Keys, g.Keys) || !slices.Equal(tab.Label, g.Label) || stats.WithWeather != g.Visits {
		t.Fatalf("table: %d rows, want %d; the keys or labels differ", tab.N, len(g.Keys))
	}
	b := tab.Blocks
	if !slices.Equal(b.Weather, g.Blocks.Weather) || !slices.Equal(b.Trees, g.Blocks.Trees) ||
		!slices.Equal(b.Activity[0], g.Blocks.Activity) || !slices.Equal(b.Season, g.Blocks.Season) {
		t.Fatalf("blocks differ: %+v", b)
	}
	prior := train.Prior(tab.PriorRows(), allRows(tab.N), nil)
	for h, want := range g.Design {
		features, err := FeatureList(b, tab, atoi(t, h))
		if err != nil || !slices.Equal(features, want.Features) {
			t.Fatalf("h%s: FeatureList = %v, %v", h, features, err)
		}
		x, err := tab.Design(features, prior, allRows(tab.N))
		if err != nil {
			t.Fatal(err)
		}
		wx := nullable(want.X)
		for k := range x {
			// The float32 weather rolling columns of Go stay within float32 rounding of pandas' float64.
			if !near(x[k], wx[k], 1e-6) {
				t.Fatalf("h%s: row %d column %s = %v, want %v", h, k/len(features), features[k%len(features)], x[k], wx[k])
			}
		}
	}
}

func TestTrainSpeciesMatchesPython(t *testing.T) {
	in, taxa := loadInputs(t)
	g := loadGolden(t)
	cfg := testConfig(taxa)
	cfg.FindsDir = t.TempDir()
	cfg.Log = t.Logf
	b, report, err := TrainSpecies(context.Background(), in, cfg)
	if err != nil {
		t.Fatal(err)
	}
	defer b.Close()
	finds, err := os.ReadFile(filepath.Join(cfg.FindsDir, "testus-chain.json"))
	if err != nil || string(finds) != g.Finds {
		t.Errorf("finds layer differs from write_finds: %v", err)
	}
	if b.Visits != g.Visits || b.Positives != g.Positives || b.Slug != "testus-chain" {
		t.Errorf("bundle counts %d/%d, want %d/%d", b.Visits, b.Positives, g.Visits, g.Positives)
	}
	samePrior(t, "cell", b.Prior.Cell, g.Prior["cell"])
	samePrior(t, "block", b.Prior.Block, g.Prior["block"])
	for _, hr := range report.Horizons {
		want := g.Horizons[itoa(hr.Horizon)]
		hz := b.Horizons[hr.Horizon]
		if !slices.Equal(hr.Features, want.Features) || hr.Setting != want.Setting || hz.Rounds != want.Rounds {
			t.Fatalf("h%d: chose %s %v, want %s %v", hr.Horizon, hr.Setting, hr.Features, want.Setting, want.Features)
		}
		sameScores(t, hr, want.Candidates, want.Settings)
		s := hr.OOF.Scores
		if !near(s.BrierRaw, want.Brier[0], 1e-4) || !near(s.BrierCalibrated, want.Brier[1], 1e-4) || !near(s.AUC, want.AUC, 1e-4) {
			t.Errorf("h%d: OOF %+v, want Brier %v AUC %v", hr.Horizon, s, want.Brier, want.AUC)
		}
		if !near(hz.Ceiling, want.Ceiling, 1e-12) || !nearAll(hz.Isotonic.X, want.IsoX, 1e-9) || !nearAll(hz.Isotonic.Y, want.IsoY, 1e-9) {
			t.Errorf("h%d: calibration differs: ceiling %v, want %v", hr.Horizon, hz.Ceiling, want.Ceiling)
		}
		samePredictions(t, b, hr.Horizon, want.Predict)
	}
	sameAfterSave(t, b)
}

func samePrior(t *testing.T, name string, got bundle.PriorTable, want struct {
	Keys []string   `json:"keys"`
	Rate []*float64 `json:"rate"`
	N    []float64  `json:"n"`
}) {
	t.Helper()
	if !slices.Equal(got.Keys, want.Keys) || !slices.Equal(got.N, want.N) || !nearAll(got.Rate, nullable(want.Rate), 0) {
		t.Errorf("prior table %s differs", name)
	}
}

// sameScores compares the scores with the 4 decimals that final_model.py prints.
func sameScores(t *testing.T, hr HorizonReport, cands [][5]float64, settings [][5]any) {
	t.Helper()
	if len(hr.Candidates) != len(cands) || len(hr.Settings) != len(settings) {
		t.Fatalf("h%d: %d candidates and %d settings, want %d and %d", hr.Horizon, len(hr.Candidates), len(hr.Settings), len(cands), len(settings))
	}
	const tol = 6e-5
	for i, c := range hr.Candidates {
		w := cands[i]
		if len(c.Features) != int(w[0]) || !near(c.YearAUC, w[1], tol) || !near(c.YearAP, w[2], tol) ||
			!near(c.SpaceAUC, w[3], tol) || !near(c.SpaceAP, w[4], tol) {
			t.Errorf("h%d candidate %d: %d %+v, want %v", hr.Horizon, i, len(c.Features), c.Score, w)
		}
	}
	for i, s := range hr.Settings {
		w := settings[i]
		if s.Name != w[0] || !near(s.YearAUC, w[1].(float64), tol) || !near(s.YearAP, w[2].(float64), tol) ||
			!near(s.SpaceAUC, w[3].(float64), tol) || !near(s.SpaceAP, w[4].(float64), tol) {
			t.Errorf("h%d setting %s: %+v, want %v", hr.Horizon, s.Name, s.Score, w)
		}
	}
}

func samePredictions(t *testing.T, b *bundle.Bundle, h int, want []float64) {
	t.Helper()
	in, taxa := loadInputs(t)
	tab, _, err := BuildTable(context.Background(), in, testConfig(taxa))
	if err != nil {
		t.Fatal(err)
	}
	hz := b.Horizons[h]
	x, err := tab.Design(hz.Features, train.Prior(tab.PriorRows(), allRows(tab.N), nil), allRows(tab.N))
	if err != nil {
		t.Fatal(err)
	}
	p, err := lgbm.Predict(hz.Booster, x, tab.N, len(hz.Features), 1)
	if err != nil || !nearAll(p, want, 1e-9) {
		t.Errorf("h%d: the final model predicts differently from Python: %v", h, err)
	}
}

func sameAfterSave(t *testing.T, b *bundle.Bundle) {
	t.Helper()
	dir := t.TempDir()
	if err := b.Save(dir); err != nil {
		t.Fatal(err)
	}
	back, err := bundle.Load(dir)
	if err != nil {
		t.Fatal(err)
	}
	defer back.Close()
	for _, h := range b.HorizonKeys() {
		a, c := b.Horizons[h], back.Horizons[h]
		ta, _ := a.Booster.Text()
		tc, _ := c.Booster.Text()
		if ta != tc || !slices.Equal(a.Features, c.Features) || a.Ceiling != c.Ceiling || a.Metrics == nil {
			t.Errorf("h%d differs after Save and Load", h)
		}
	}
}

func TestTrainingIsDeterministic(t *testing.T) {
	in, taxa := loadInputs(t)
	cfg := testConfig(taxa)
	cfg.Horizons = []int{1}
	cfg.Grid = []train.Setting{{Name: "short", Params: testGrid()[0].Params, Rounds: 40}}
	tab, _, err := BuildTable(context.Background(), in, cfg)
	if err != nil {
		t.Fatal(err)
	}
	var texts []string
	for range 2 {
		b, _, err := Train(context.Background(), tab, cfg, Report{})
		if err != nil {
			t.Fatal(err)
		}
		text, err := b.Horizons[1].Booster.Text()
		b.Close()
		if err != nil {
			t.Fatal(err)
		}
		texts = append(texts, text)
	}
	if texts[0] != texts[1] {
		t.Error("two runs on the same input give different model text")
	}
}

func TestTrainStopsWithoutFolds(t *testing.T) {
	in, taxa := loadInputs(t)
	cfg := testConfig(taxa)
	tab, _, err := BuildTable(context.Background(), in, cfg)
	if err != nil {
		t.Fatal(err)
	}
	keep := []int{}
	for i, y := range tab.ISOYear {
		if y == 2021 {
			keep = append(keep, i)
		}
	}
	small := subTable(tab, keep)
	if _, _, err := Train(context.Background(), small, cfg, Report{}); err == nil {
		t.Error("Train runs with one year only")
	}
	ctx, cancel := context.WithCancel(context.Background())
	cancel()
	if _, _, err := Train(ctx, tab, cfg, Report{}); err == nil {
		t.Error("Train runs with a cancelled context")
	}
}

func TestFindsNeedPlainSlug(t *testing.T) {
	if _, err := WriteFinds(t.TempDir(), "../x", &Table{}); err == nil {
		t.Error("WriteFinds accepts a path as slug")
	}
}
