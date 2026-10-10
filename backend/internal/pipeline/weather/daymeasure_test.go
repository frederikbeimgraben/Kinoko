package weather

import (
	"math"
	"slices"
	"testing"
)

// The test cases of the day measures. A field is [day][cell].

func f32s(v ...float64) []float32 {
	out := make([]float32, len(v))
	for i, x := range v {
		out[i] = float32(x)
	}
	return out
}

func TestFrostDays(t *testing.T) {
	got := ThresholdDays(0, false)(f32s(-3, 0, 1.5, -0.1, 8, -9, 2), 1)
	if want := f32s(1, 0, 0, 1, 0, 1, 0); !slices.Equal(got, want) {
		t.Errorf("got %v, want %v", got, want)
	}
}

func TestHeatDays(t *testing.T) {
	got := ThresholdDays(25, true)(f32s(25, 25.1, 30, 24.9), 1)
	if want := f32s(0, 1, 1, 0); !slices.Equal(got, want) {
		t.Errorf("got %v, want %v", got, want)
	}
}

func TestThresholdDaysKeepsNaN(t *testing.T) {
	nan := math.NaN()
	got := ThresholdDays(0, false)(f32s(-1, nan, 5, nan), 2)
	if got[0] != 1 || got[2] != 0 || !isNaN32(got[1]) || !isNaN32(got[3]) {
		t.Errorf("got %v", got)
	}
}

func TestDaysSince(t *testing.T) {
	nan := math.NaN()
	cases := []struct {
		name  string
		limit float32
		calls [][]float32
		cells int
		want  []float32
	}{
		{"starts at the cap", 60, [][]float32{f32s(0)}, 1, f32s(60)},
		{"resets and counts", 60, [][]float32{f32s(9, 0, 1, 4.9, 5.1, 0)}, 1, f32s(0, 1, 2, 3, 0, 1)},
		{"carries across files", 60, [][]float32{f32s(9), f32s(0, 0)}, 1, f32s(1, 2)},
		{"each cell on its own", 60, [][]float32{f32s(9, 0, 0, 9)}, 2, f32s(0, 60, 1, 0)},
		{"day without value", 60, [][]float32{f32s(9, nan, 0)}, 1, f32s(0, nan, 2)},
	}
	for _, c := range cases {
		m := DaysSince(5, c.limit)
		var got []float32
		for _, call := range c.calls {
			got = m(call, c.cells)
		}
		for i := range c.want {
			if got[i] != c.want[i] && !(isNaN32(got[i]) && isNaN32(c.want[i])) {
				t.Errorf("%s: got %v, want %v", c.name, got, c.want)
				break
			}
		}
	}
	long := DaysSince(5, 10)(make([]float32, 30), 1)
	if long[9] != 10 || long[29] != 10 {
		t.Errorf("cap: got %v", long)
	}
}
