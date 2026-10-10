package activity

import (
	"encoding/json"
	"errors"
	"math"
	"os"
	"testing"
	"time"

	"github.com/frederikbeimgraben/kinoko/backend/internal/pipeline/occ"
	"github.com/frederikbeimgraben/kinoko/backend/internal/pipeline/occ/internal/occtest"
)

type golden struct {
	X0       int                              `json:"x0"`
	Y0       int                              `json:"y0"`
	Day0     string                           `json:"day0"`
	NDays    int                              `json:"n_days"`
	Xs       []float64                        `json:"xs"`
	Ys       []float64                        `json:"ys"`
	Dates    []*string                        `json:"dates"`
	Horizons map[string]map[string][]*float64 `json:"horizons"`
}

// Golden: the activity fields of "Boletus edulis", sampled for
// h = 0..4 at the visits and at probes before the first day, past the last day, outside the blocks and at NaT.
func TestSampleMatchesGolden(t *testing.T) {
	records, err := occtest.Records("../testdata/occurrences.json")
	if err != nil {
		t.Fatal(err)
	}
	raw, err := os.ReadFile("testdata/activity.json")
	if err != nil {
		t.Fatal(err)
	}
	var g golden
	if err := json.Unmarshal(raw, &g); err != nil {
		t.Fatal(err)
	}
	f, err := New(occ.TrainingSet(records, 2015, 500), []string{"Boletus edulis"}, BlockM)
	if err != nil {
		t.Fatal(err)
	}
	if f.x0 != g.X0 || f.y0 != g.Y0 || f.Day0().Format(time.DateOnly) != g.Day0 || f.Days() != g.NDays {
		t.Fatalf("grid x0 %d y0 %d day0 %s days %d, want %d %d %s %d", f.x0, f.y0, f.Day0().Format(time.DateOnly), f.Days(), g.X0, g.Y0, g.Day0, g.NDays)
	}
	dates := make([]time.Time, len(g.Dates))
	for i, d := range g.Dates {
		if d != nil {
			if dates[i], err = time.Parse(time.DateOnly, *d); err != nil {
				t.Fatal(err)
			}
		}
	}
	for h := range 5 {
		want := g.Horizons[string(rune('0'+h))]
		for _, col := range f.Sample(g.Xs, g.Ys, dates, h) {
			exp, ok := want[col.Name]
			if !ok {
				t.Fatalf("h%d: column %s is not in the golden file", h, col.Name)
			}
			for i, v := range col.Values {
				switch {
				case exp[i] == nil && !math.IsNaN(float64(v)):
					t.Errorf("h%d %s[%d] = %v, want NaN", h, col.Name, i, v)
				case exp[i] != nil && math.Abs(float64(v)-*exp[i]) > 1e-6:
					t.Errorf("h%d %s[%d] = %v, want %v", h, col.Name, i, v, *exp[i])
				}
			}
		}
	}
}

// A window ends the day before the date, so a find on the date itself does not count.
func TestWindowLeavesTheDayOut(t *testing.T) {
	d := func(day int) time.Time { return time.Date(2024, 9, day, 0, 0, 0, 0, time.UTC) }
	recs := []occ.Record{
		{Observer: "a", Species: "T", X: 12_500, Y: 12_500, Date: d(1)},
		{Observer: "b", Species: "O", X: 12_500, Y: 12_500, Date: d(10)},
		{Observer: "c", Species: "T", X: 12_500, Y: 12_500, Date: d(10)},
	}
	f, err := New(recs, []string{"T"}, BlockM)
	if err != nil {
		t.Fatal(err)
	}
	at := func(day int) float32 { return f.SampleAt([]float64{12_500}, []float64{12_500}, d(day), 0)[0].Values[0] }
	if v := at(1); v != 0 {
		t.Errorf("day 1: %v, want 0", v)
	}
	if v := at(2); v != 1 {
		t.Errorf("day 2: %v, want 1", v)
	}
	if v := at(10); v != 0 {
		t.Errorf("day 10: the 7-day window holds no visit, got %v", v)
	}
	if v := at(30); v != at(10) {
		t.Errorf("past the end: reads the last day, got %v, want %v", v, at(10))
	}
	if v := at(9); v != 0 {
		t.Errorf("day 9: the 7-day window starts on day 2, got %v", v)
	}
	if v := f.SampleAt([]float64{12_500}, []float64{12_500}, d(7), 1)[0]; v.Name != "activity_rate_7d_h1" || !math.IsNaN(float64(v.Values[0])) {
		t.Errorf("a horizon before the first day gives NaN: %s %v", v.Name, v.Values[0])
	}
	if _, err := New(nil, nil, BlockM); !errors.Is(err, ErrNoRecords) {
		t.Errorf("no records: %v", err)
	}
}
