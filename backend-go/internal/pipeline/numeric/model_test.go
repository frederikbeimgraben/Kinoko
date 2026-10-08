package numeric

import (
	"math"
	"slices"
	"testing"

	"github.com/frederikbeimgraben/kinoko/backend/internal/pipeline/core/geo"
)

// Golden values: pilze.coarse_inputs.CoarseSampler.sample (testdata/gen_golden.py).
func TestCoarseSampler(t *testing.T) {
	var g struct {
		Cells   [][2]int32
		X, Y    floats
		Columns []struct{ Values, Out floats }
	}
	load(t, "coarse.json", &g)
	cells := make([]geo.CellKey, len(g.Cells))
	for i, c := range g.Cells {
		cells[i] = geo.CellKey{X: c[0], Y: c[1]}
	}
	s := NewCoarseSampler(cells, g.X, g.Y, 5000)
	for _, c := range g.Columns {
		got, err := s.Sample(c.Values.f32())
		if err != nil {
			t.Fatal(err)
		}
		checkAll(t, "coarse", got, c.Out, 1e-6, 1e-7)
	}
	if _, err := s.Sample(make([]float32, 3)); err == nil {
		t.Fatal("want a length error")
	}
}

// Golden values: sklearn IsotonicRegression(out_of_bounds="clip").fit and
// predict (testdata/gen_golden.py).
func TestIsotonic(t *testing.T) {
	var cases []struct {
		X    floats  `json:"x"`
		Y    floats  `json:"y"`
		BigX floats  `json:"X"`
		BigY floats  `json:"Y"`
		T    floats  `json:"t"`
		Pred floats  `json:"pred"`
		XMin float64 `json:"xmin"`
		XMax float64 `json:"xmax"`
	}
	load(t, "isotonic.json", &cases)
	for _, c := range cases {
		iso := FitIsotonic(c.X, c.Y)
		checkAll(t, "X", iso.X, c.BigX, 0, 0)
		checkAll(t, "Y", iso.Y, c.BigY, 0, 0)
		if iso.XMin != c.XMin || iso.XMax != c.XMax {
			t.Fatalf("range %v %v, want %v %v", iso.XMin, iso.XMax, c.XMin, c.XMax)
		}
		checkAll(t, "pred", iso.PredictAll(c.T), c.Pred, 0, 0)
	}
}

// Golden values: sklearn roc_auc_score, average_precision_score and
// brier_score_loss (testdata/gen_golden.py).
func TestMetrics(t *testing.T) {
	var cases []struct {
		Y              []int8
		P              floats
		Auc, Ap, Brier float64
	}
	load(t, "metrics.json", &cases)
	for _, c := range cases {
		checkAll(t, "auc", []float64{RocAUC(c.Y, c.P)}, floats{c.Auc}, 1e-15, 0)
		checkAll(t, "ap", []float64{AveragePrecision(c.Y, c.P)}, floats{c.Ap}, 1e-15, 0)
		checkAll(t, "brier", []float64{Brier(c.Y, c.P)}, floats{c.Brier}, 1e-15, 0)
	}
	if !math.IsNaN(RocAUC([]int8{1, 1}, []float64{0.2, 0.3})) {
		t.Fatal("want NaN for one class")
	}
}

// Golden values: numpy RandomState(seed).permutation(n) and sklearn
// train_test_split(idx, test_size=0.25, random_state=0, stratify=y).
func TestRandom(t *testing.T) {
	var g struct {
		Perms []struct {
			Seed uint32
			N    int
			Perm []int
		}
		Splits []struct {
			Idx, Train, Test []int
			Y                []int8
		}
	}
	load(t, "random.json", &g)
	for _, p := range g.Perms {
		if got := NewRandomState(p.Seed).Permutation(p.N); !slices.Equal(got, p.Perm) {
			t.Fatalf("seed %d n %d: %v, want %v", p.Seed, p.N, got, p.Perm)
		}
	}
	for _, s := range g.Splits {
		train, test, err := StratifiedSplit(s.Idx, s.Y, 0.25, 0)
		if err != nil {
			t.Fatal(err)
		}
		if !slices.Equal(train, s.Train) || !slices.Equal(test, s.Test) {
			t.Fatalf("n %d: split differs\n%v\n%v", len(s.Idx), test, s.Test)
		}
	}
	if _, _, err := StratifiedSplit([]int{0, 1, 2}, []int8{0, 0, 1}, 0.25, 0); err == nil {
		t.Fatal("want an error for a class with one member")
	}
}

// Golden values: np.nanpercentile(v, list) and np.sum (testdata/gen_golden.py).
func TestStats(t *testing.T) {
	var g struct {
		Percentile []struct{ V, Q, F32, F64 floats }
		Sum        []struct {
			V        floats
			F64, F32 float64
		}
	}
	load(t, "stats.json", &g)
	for _, c := range g.Percentile {
		v32 := c.V.f32()
		for k, q := range c.Q {
			checkAll(t, "p32", []float64{NanPercentile(v32, q)}, floats{c.F32[k]}, 0, 0)
			checkAll(t, "p64", []float64{NanPercentile64(c.V, q)}, floats{c.F64[k]}, 0, 0)
		}
	}
	for _, c := range g.Sum {
		checkAll(t, "sum64", []float64{Sum(c.V)}, floats{c.F64}, 0, 0)
		checkAll(t, "sum32", []float32{Sum(c.V.f32())}, floats{c.F32}, 0, 0)
	}
}

// Golden values: pilze.final_model.blocked_folds for the year and space schemes.
func TestBlockedFolds(t *testing.T) {
	var g struct {
		YearKey  []int64 `json:"year_key"`
		SpaceKey []int64 `json:"space_key"`
		Label    []int8
		X        floats
		Year     []struct{ Train, Test []int }
		Space    []struct{ Train, Test []int }
	}
	load(t, "folds.json", &g)
	for i, x := range g.X {
		if k := int64(geo.FloorDiv(x, 100_000)); k != g.SpaceKey[i] {
			t.Fatalf("space key %d, want %d", k, g.SpaceKey[i])
		}
	}
	for _, scheme := range []struct {
		keys []int64
		want []struct{ Train, Test []int }
	}{{g.YearKey, g.Year}, {g.SpaceKey, g.Space}} {
		got := BlockedFolds(scheme.keys, g.Label)
		if len(got) != len(scheme.want) {
			t.Fatalf("%d folds, want %d", len(got), len(scheme.want))
		}
		for i, f := range got {
			if !slices.Equal(f.Train, scheme.want[i].Train) || !slices.Equal(f.Test, scheme.want[i].Test) {
				t.Fatalf("fold %d differs", i)
			}
		}
	}
}
