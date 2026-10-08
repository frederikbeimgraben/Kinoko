package numeric

import (
	"encoding/json"
	"math"
	"os"
	"path/filepath"
	"testing"
)

// floats decodes a JSON number list in which null stands for NaN.
type floats []float64

func (f *floats) UnmarshalJSON(b []byte) error {
	var raw []*float64
	if err := json.Unmarshal(b, &raw); err != nil {
		return err
	}
	*f = make(floats, len(raw))
	for i, p := range raw {
		(*f)[i] = math.NaN()
		if p != nil {
			(*f)[i] = *p
		}
	}
	return nil
}

func (f floats) f32() []float32 {
	out := make([]float32, len(f))
	for i, v := range f {
		out[i] = float32(v)
	}
	return out
}

func load(t *testing.T, name string, v any) {
	t.Helper()
	b, err := os.ReadFile(filepath.Join("testdata", name))
	if err != nil {
		t.Fatal(err)
	}
	if err := json.Unmarshal(b, v); err != nil {
		t.Fatal(err)
	}
}

// near tells if got equals want within rel relative and abs absolute error.
// Two NaN values are equal.
func near(got, want, rel, abs float64) bool {
	if math.IsNaN(got) || math.IsNaN(want) {
		return math.IsNaN(got) && math.IsNaN(want)
	}
	return math.Abs(got-want) <= abs+rel*math.Abs(want)
}

// checkAll compares two slices and reports the count of inexact values.
func checkAll[T Float](t *testing.T, label string, got []T, want floats, rel, abs float64) {
	t.Helper()
	if len(got) != len(want) {
		t.Fatalf("%s: %d values, want %d", label, len(got), len(want))
	}
	inexact := 0
	for i := range got {
		g := float64(got[i])
		if !near(g, want[i], rel, abs) {
			t.Fatalf("%s[%d] = %v, want %v", label, i, g, want[i])
		}
		if g != want[i] && !(math.IsNaN(g) && math.IsNaN(want[i])) {
			inexact++
		}
	}
	if inexact > 0 {
		t.Logf("%s: %d of %d values not bit-equal", label, inexact, len(got))
	}
}
