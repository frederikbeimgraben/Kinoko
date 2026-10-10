package lgbm

import (
	"encoding/json"
	"errors"
	"math"
	"os"
	"runtime"
	"strings"
	"sync"
	"testing"
)

// golden is the golden files testdata/golden.json and testdata/golden_model.txt: a LightGBM model trained
// with the base settings, its predictions, its feature importance and its model text.
type golden struct {
	Params       Params     `json:"params"`
	Rounds       int        `json:"rounds"`
	Names        []string   `json:"names"`
	TrainX       []*float64 `json:"trainX"`
	TrainY       []float32  `json:"trainY"`
	TestX        []*float64 `json:"testX"`
	Predict64    []float64  `json:"predict64"`
	Predict32    []float64  `json:"predict32"`
	PredictTrain []float64  `json:"predictTrain"`
	Gain         []float64  `json:"gain"`
	Iterations   int        `json:"iterations"`
	model        string
}

func loadGolden(t *testing.T) golden {
	t.Helper()
	var g golden
	data, err := os.ReadFile("testdata/golden.json")
	if err != nil {
		t.Fatal(err)
	}
	if err := json.Unmarshal(data, &g); err != nil {
		t.Fatal(err)
	}
	text, err := os.ReadFile("testdata/golden_model.txt")
	if err != nil {
		t.Fatal(err)
	}
	g.model = string(text)
	return g
}

func floats(v []*float64) []float64 {
	out := make([]float64, len(v))
	for i, p := range v {
		out[i] = math.NaN()
		if p != nil {
			out[i] = *p
		}
	}
	return out
}

func floats32(v []float64) []float32 {
	out := make([]float32, len(v))
	for i, x := range v {
		out[i] = float32(x)
	}
	return out
}

func assertClose(t *testing.T, what string, got, want []float64, tol float64) {
	t.Helper()
	if len(got) != len(want) {
		t.Fatalf("%s: %d values, want %d", what, len(got), len(want))
	}
	worst := 0.0
	for i := range got {
		d := math.Abs(got[i] - want[i])
		worst = max(worst, d)
		if !(d <= tol) {
			t.Errorf("%s[%d] = %.17g, want %.17g (diff %g)", what, i, got[i], want[i], d)
		}
	}
	t.Logf("%s: largest difference %g", what, worst)
}

func trainGo(t *testing.T, g golden) *Booster {
	t.Helper()
	params := g.Params.ForTrain(g.Rounds).String()
	ds, err := NewDataset(floats(g.TrainX), len(g.TrainY), len(g.Names), g.TrainY, g.Names, params)
	if err != nil {
		t.Fatal(err)
	}
	defer ds.Close()
	b, err := Train(ds, params, g.Rounds)
	if err != nil {
		t.Fatal(err)
	}
	return b
}

func TestLoadModelPredictsAsGolden(t *testing.T) {
	g := loadGolden(t)
	b, err := Load(g.model)
	if err != nil {
		t.Fatal(err)
	}
	defer b.Close()
	names, err := b.FeatureNames()
	if err != nil || strings.Join(names, ",") != strings.Join(g.Names, ",") {
		t.Fatalf("FeatureNames = %v, %v; want %v", names, err, g.Names)
	}
	if n, err := b.Iterations(); err != nil || n != g.Iterations {
		t.Fatalf("Iterations = %d, %v; want %d", n, err, g.Iterations)
	}
	x := floats(g.TestX)
	nrow := len(x) / len(g.Names)
	p64, err := Predict(b, x, nrow, len(g.Names), 1)
	if err != nil {
		t.Fatal(err)
	}
	assertClose(t, "predict float64", p64, g.Predict64, 1e-12)
	p32, err := b.Predict(floats32(x), nrow, len(g.Names), 2)
	if err != nil {
		t.Fatal(err)
	}
	assertClose(t, "predict float32", p32, g.Predict32, 1e-12)
	gain, err := b.GainImportance()
	if err != nil {
		t.Fatal(err)
	}
	assertClose(t, "gain", gain, g.Gain, 1e-9*max(1, g.Gain[0]))
}

func TestTrainMatchesGolden(t *testing.T) {
	g := loadGolden(t)
	b := trainGo(t, g)
	defer b.Close()
	x := floats(g.TestX)
	got, err := Predict(b, x, len(x)/len(g.Names), len(g.Names), 1)
	if err != nil {
		t.Fatal(err)
	}
	assertClose(t, "test rows", got, g.Predict64, 1e-4)
	train, err := Predict(b, floats(g.TrainX), len(g.TrainY), len(g.Names), 1)
	if err != nil {
		t.Fatal(err)
	}
	assertClose(t, "training rows", train, g.PredictTrain, 1e-4)
	text, err := b.Text()
	if err != nil {
		t.Fatal(err)
	}
	if trees(text) != trees(g.model) {
		t.Log("the tree section of the model text differs from the golden model text")
	}
}

// trees returns the model text up to the parameters, which hold the bookkeeping of the caller.
func trees(text string) string {
	i := strings.Index(text, "\nparameters:")
	if i < 0 {
		return text
	}
	return text[:i]
}

func TestTextRoundTripAndDeterminism(t *testing.T) {
	g := loadGolden(t)
	first, second := trainGo(t, g), trainGo(t, g)
	defer first.Close()
	defer second.Close()
	a, err := first.Text()
	if err != nil {
		t.Fatal(err)
	}
	b, err := second.Text()
	if err != nil {
		t.Fatal(err)
	}
	if a != b {
		t.Fatal("two trainings on the same input give different model text")
	}
	loaded, err := Load(a)
	if err != nil {
		t.Fatal(err)
	}
	defer loaded.Close()
	x := floats(g.TestX)
	nrow := len(x) / len(g.Names)
	want, _ := Predict(first, x, nrow, len(g.Names), 1)
	got, err := Predict(loaded, x, nrow, len(g.Names), 1)
	if err != nil {
		t.Fatal(err)
	}
	assertClose(t, "loaded model", got, want, 0)
}

func TestBoosterOutlivesDataset(t *testing.T) {
	g := loadGolden(t)
	params := g.Params.ForTrain(5).String()
	ds, err := NewDataset(floats32(floats(g.TrainX)), len(g.TrainY), len(g.Names), g.TrainY, nil, params)
	if err != nil {
		t.Fatal(err)
	}
	b, err := Train(ds, params, 5)
	if err != nil {
		t.Fatal(err)
	}
	ds.Close()
	ds.Close()
	if _, err := Train(ds, params, 1); !errors.Is(err, ErrClosed) {
		t.Fatalf("Train on a closed dataset: %v", err)
	}
	names, err := b.FeatureNames()
	if err != nil || names[0] != "Column_0" {
		t.Fatalf("FeatureNames without names = %v, %v", names, err)
	}
	if _, err := b.Text(); err != nil {
		t.Fatal(err)
	}
	b.Close()
	b.Close()
	if _, err := b.Predict(make([]float32, 6), 1, 6, 1); !errors.Is(err, ErrClosed) {
		t.Fatalf("Predict on a closed booster: %v", err)
	}
}

func TestErrors(t *testing.T) {
	if _, err := Load("not a model"); err == nil {
		t.Fatal("Load accepts a bad model text")
	}
	if _, err := NewDataset([]float64{1, 2, 3}, 2, 2, []float32{0, 1}, nil, ""); err == nil {
		t.Fatal("NewDataset accepts a wrong shape")
	}
	if _, err := NewDataset([]float64{1, 2, 3, 4}, 2, 2, []float32{0}, nil, ""); err == nil {
		t.Fatal("NewDataset accepts a short label")
	}
	if _, err := NewDataset([]float64{1, 2, 3, 4}, 2, 2, []float32{0, 1}, nil, "max_bin=1"); err == nil {
		t.Fatal("NewDataset accepts a bad parameter")
	}
	g := loadGolden(t)
	b, err := Load(g.model)
	if err != nil {
		t.Fatal(err)
	}
	defer b.Close()
	if _, err := b.Predict(make([]float32, 4), 1, 4, 1); err == nil || !strings.Contains(err.Error(), "lgbm:") {
		t.Fatalf("Predict with too few columns: %v", err)
	}
}

func TestParams(t *testing.T) {
	base := Params{{"objective", "binary"}, {"learning_rate", 0.05}, {"num_leaves", 31}, {"verbosity", -1}}
	p := base.With("num_leaves", 15).With("lambda_l2", 10.0).With("deterministic", true)
	if got, want := p.String(), "objective=binary learning_rate=0.05 num_leaves=15 verbosity=-1 lambda_l2=10.0 deterministic=true"; got != want {
		t.Fatalf("String = %q, want %q", got, want)
	}
	if base.String() != "objective=binary learning_rate=0.05 num_leaves=31 verbosity=-1" {
		t.Fatal("With changes its receiver")
	}
	data, err := json.Marshal(p)
	if err != nil {
		t.Fatal(err)
	}
	if want := `{"objective":"binary","learning_rate":0.05,"num_leaves":15,"verbosity":-1,"lambda_l2":10.0,"deterministic":true}`; string(data) != want {
		t.Fatalf("JSON = %s, want %s", data, want)
	}
	var back Params
	if err := json.Unmarshal(data, &back); err != nil {
		t.Fatal(err)
	}
	if back.String() != p.String() {
		t.Fatalf("JSON round trip = %q, want %q", back.String(), p.String())
	}
	if got := p.ForTrain(300).String(); !strings.HasSuffix(got, " num_iterations=300") {
		t.Fatalf("ForTrain = %q", got)
	}
}

func TestCleanupAndConcurrentPredict(t *testing.T) {
	g := loadGolden(t)
	for range 20 {
		if _, err := Load(g.model); err != nil {
			t.Fatal(err)
		}
	}
	runtime.GC()
	b, err := Load(g.model)
	if err != nil {
		t.Fatal(err)
	}
	defer b.Close()
	x := floats32(floats(g.TestX))
	nrow := len(x) / len(g.Names)
	var wg sync.WaitGroup
	for range 8 {
		wg.Go(func() {
			p, err := b.Predict(x, nrow, len(g.Names), 1)
			if err != nil {
				t.Error(err)
				return
			}
			for i := range p {
				if p[i] != g.Predict32[i] {
					t.Errorf("row %d: %g, want %g", i, p[i], g.Predict32[i])
					return
				}
			}
		})
	}
	wg.Wait()
	runtime.GC()
}
