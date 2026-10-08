package train

import (
	"encoding/json"
	"math"
	"os"
	"slices"
	"testing"

	"github.com/frederikbeimgraben/kinoko/backend/internal/pipeline/model/lgbm"
)

// golden is testdata/golden.json, written by ../testdata/gen_golden.py with the Python functions in "source":
// final_model.blocked_folds, prior_columns, prior_tables, block_key, the ranking lines of final_model.main,
// the ceiling lines of fit_calibrated, sklearn brier_score_loss and numpy.mean.
type golden struct {
	X, Y       []float64
	IsoYear    []int
	Label      []int8
	Cell       []string
	Block      []string
	YearFolds  [][]int
	SpaceFolds [][]int
	PriorFold  map[string][]*float64
	PriorAll   map[string][]*float64
	Tables     map[string]struct {
		Keys []string
		Rate []float64
		N    []float64
	}
	GainNames  []string
	Gains      []float64
	Order      []string
	Earned     []string
	Total      float64
	Candidates [][]string
	CeilingRaw []float64
	CeilingY   []int8
	Ceiling    float64
	BrierP     []float64
	BrierY     []int8
	Brier      float64
	MeanArrays map[string][]float64
	Means      map[string]float64
	FloorDiv   [][3]float64
	Grid       [][3]json.RawMessage
}

func loadGolden(t *testing.T) golden {
	t.Helper()
	data, err := os.ReadFile("testdata/golden.json")
	if err != nil {
		t.Fatal(err)
	}
	var g golden
	if err := json.Unmarshal(data, &g); err != nil {
		t.Fatal(err)
	}
	return g
}

func (g golden) rows() Rows { return Rows{g.Cell, g.Block, g.IsoYear, g.Label} }

func TestFoldsMatchPython(t *testing.T) {
	g := loadGolden(t)
	for name, c := range map[string]struct {
		keys []int64
		want [][]int
	}{"year": {YearKeys(g.IsoYear), g.YearFolds}, "space": {SpaceKeys(g.X), g.SpaceFolds}} {
		folds := BlockedFolds(c.keys, g.Label)
		if len(folds) != len(c.want) {
			t.Fatalf("%s: %d folds, want %d", name, len(folds), len(c.want))
		}
		for i, f := range folds {
			if !slices.Equal(f.Test, c.want[i]) || len(f.Train)+len(f.Test) != len(g.Label) {
				t.Errorf("%s fold %d differs", name, i)
			}
		}
	}
	for i := range g.X {
		if BlockKey(g.X[i], g.Y[i]) != g.Block[i] {
			t.Fatalf("BlockKey(%v, %v) = %s, want %s", g.X[i], g.Y[i], BlockKey(g.X[i], g.Y[i]), g.Block[i])
		}
	}
	for _, c := range g.FloorDiv {
		if got := FloorDiv(c[0], c[1]); got != c[2] || math.Signbit(got) != math.Signbit(c[2]) {
			t.Errorf("FloorDiv(%v, %v) = %v, want %v", c[0], c[1], got, c[2])
		}
	}
}

func samePrior(t *testing.T, what string, got PriorColumns, want map[string][]*float64) {
	t.Helper()
	for _, name := range PriorNames {
		col, _ := got.Column(name)
		for i, w := range want[name] {
			v := float64(col[i])
			if (w == nil) != math.IsNaN(v) || (w != nil && v != *w) {
				t.Fatalf("%s %s[%d] = %v, want %v", what, name, i, v, w)
			}
		}
	}
}

func TestPriorMatchesPython(t *testing.T) {
	g := loadGolden(t)
	folds := BlockedFolds(YearKeys(g.IsoYear), g.Label)
	samePrior(t, "fold", Prior(g.rows(), folds[0].Train, folds[0].Test), g.PriorFold)
	all := make([]int, len(g.Label))
	for i := range all {
		all[i] = i
	}
	samePrior(t, "all", Prior(g.rows(), all, nil), g.PriorAll)
	tables := PriorTables(g.rows(), all)
	for key, got := range map[string][]string{"cell": tables.Cell.Keys, "block": tables.Block.Keys} {
		if !slices.Equal(got, g.Tables[key].Keys) {
			t.Errorf("%s keys differ", key)
		}
	}
	if !slices.Equal([]float64(tables.Cell.Rate), g.Tables["cell"].Rate) || !slices.Equal(tables.Cell.N, g.Tables["cell"].N) {
		t.Error("cell table differs")
	}
	if !slices.Equal([]float64(tables.Block.Rate), g.Tables["block"].Rate) || !slices.Equal(tables.Block.N, g.Tables["block"].N) {
		t.Error("block table differs")
	}
}

func TestSelectionMatchesPython(t *testing.T) {
	g := loadGolden(t)
	r := Rank(g.GainNames, g.Gains)
	if !slices.Equal(r.Order, g.Order) || !slices.Equal(r.Earned, g.Earned) || r.Total != g.Total {
		t.Fatalf("Rank = %+v", r)
	}
	got := Candidates(r, len(g.GainNames))
	if !slices.EqualFunc(got, g.Candidates, slices.Equal) {
		t.Fatalf("Candidates = %v, want %v", got, g.Candidates)
	}
	if i := ChooseList([]float64{0.50, 0.512, 0.515, 0.5101}); i != 1 {
		t.Errorf("ChooseList = %d, want 1", i)
	}
	if i := PickSetting([]float64{0.4, 0.5, 0.5, 0.45}); i != 1 {
		t.Errorf("PickSetting = %d, want 1", i)
	}
	if i := PickSetting([]float64{math.NaN(), math.NaN()}); i != 0 {
		t.Errorf("PickSetting of NaN = %d, want 0", i)
	}
}

func TestScoresMatchPython(t *testing.T) {
	g := loadGolden(t)
	if c := Ceiling(g.CeilingRaw, g.CeilingY); c != g.Ceiling {
		t.Errorf("Ceiling = %v, want %v", c, g.Ceiling)
	}
	if b := Brier(g.BrierY, g.BrierP); b != g.Brier {
		t.Errorf("Brier = %.17g, want %.17g", b, g.Brier)
	}
	for k, a := range g.MeanArrays {
		if m := Mean(a); m != g.Means[k] {
			t.Errorf("Mean of %s values = %.17g, want %.17g", k, m, g.Means[k])
		}
	}
	if !math.IsNaN(Mean(nil)) {
		t.Error("Mean of no values is not NaN")
	}
}

func TestGridMatchesPython(t *testing.T) {
	g := loadGolden(t)
	grid := Grid()
	if len(grid) != len(g.Grid) {
		t.Fatalf("%d settings, want %d", len(grid), len(g.Grid))
	}
	for i, s := range grid {
		var name string
		var params lgbm.Params
		var rounds int
		if json.Unmarshal(g.Grid[i][0], &name) != nil || json.Unmarshal(g.Grid[i][1], &params) != nil ||
			json.Unmarshal(g.Grid[i][2], &rounds) != nil {
			t.Fatal("bad grid golden")
		}
		if s.Name != name || s.Rounds != rounds || s.Params.String() != params.String() {
			t.Errorf("setting %d = %s %q %d, want %s %q %d", i, s.Name, s.Params, s.Rounds, name, params, rounds)
		}
	}
	if v, _ := WithThreads(grid, 2)[3].Params.Get("num_threads"); v != 2 {
		t.Errorf("WithThreads gives num_threads %v", v)
	}
}

func TestEvaluateAndOOF(t *testing.T) {
	label := []int8{0, 1, 0, 1, 1, 1}
	folds := []Fold{{Test: []int{0, 1, 2}}, {Test: []int{3, 4, 5}}}
	fit := func(f Fold) ([]float64, error) { return make([]float64, len(f.Test)), nil }
	count := func(y []int8, _ []float64) float64 { return float64(len(y)) }
	auc, ap, err := Evaluate(label, folds, fit, count, count)
	if err != nil || auc != 3 || ap != 3 {
		t.Errorf("Evaluate = %v, %v, %v; want the first fold only", auc, ap, err)
	}
	nan := math.NaN()
	s := OOF(label, []float64{0.5, 0.5, nan, 1, 1, 1}, []float64{0, 1, nan, 1, nan, 1}, count)
	if s.Rows != 4 || s.BrierCalibrated != 0 || s.BrierRaw != 0.125 || s.AUC != 4 {
		t.Errorf("OOF = %+v", s)
	}
}
