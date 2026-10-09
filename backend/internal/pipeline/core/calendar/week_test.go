package calendar

import (
	"encoding/json"
	"os"
	"testing"
	"time"
)

// weeks.json is the golden file of the ISO calendar in both directions, the
// week number and the week distance.
type weeksGolden struct {
	Days []struct {
		Date, Monday   string
		Year, Week, ID int
	}
	Distances []struct {
		A, B     [2]int
		Distance int
	}
	Has53 map[string]bool
}

func loadWeeks(t *testing.T) weeksGolden {
	t.Helper()
	raw, err := os.ReadFile("testdata/weeks.json")
	if err != nil {
		t.Fatal(err)
	}
	var g weeksGolden
	if err := json.Unmarshal(raw, &g); err != nil {
		t.Fatal(err)
	}
	return g
}

func mustDate(t *testing.T, s string) time.Time {
	t.Helper()
	d, err := time.Parse(time.DateOnly, s)
	if err != nil {
		t.Fatal(err)
	}
	return d
}

func TestWeekOfMatchesGolden(t *testing.T) {
	g := loadWeeks(t)
	for _, d := range g.Days {
		w := WeekOf(mustDate(t, d.Date))
		if w != (Week{d.Year, d.Week}) || w.ID() != d.ID {
			t.Fatalf("%s: got %v id %d, want %dW%d id %d", d.Date, w, w.ID(), d.Year, d.Week, d.ID)
		}
		if got := w.Monday().Format(time.DateOnly); got != d.Monday {
			t.Fatalf("%v: Monday %s, want %s", w, got, d.Monday)
		}
		if !w.Valid() {
			t.Fatalf("%v: not valid", w)
		}
	}
}

func TestDistanceMatchesGolden(t *testing.T) {
	for _, p := range loadWeeks(t).Distances {
		a, b := Week{p.A[0], p.A[1]}, Week{p.B[0], p.B[1]}
		if got := Distance(a, b); got != p.Distance {
			t.Fatalf("Distance(%v, %v) = %d, want %d", a, b, got, p.Distance)
		}
		if got := a.AddWeeks(p.Distance); got != b {
			t.Fatalf("%v.AddWeeks(%d) = %v, want %v", a, p.Distance, got, b)
		}
	}
}

func TestWeek53(t *testing.T) {
	for year, has := range loadWeeks(t).Has53 {
		var y int
		if err := json.Unmarshal([]byte(year), &y); err != nil {
			t.Fatal(err)
		}
		if got := (Week{y, 53}).Valid(); got != has {
			t.Errorf("%d: week 53 valid %v, want %v", y, got, has)
		}
	}
}

func TestEdgeWeeks(t *testing.T) {
	cases := []struct {
		date string
		want Week
	}{
		{"2020-12-31", Week{2020, 53}},
		{"2021-01-03", Week{2020, 53}},
		{"2025-12-29", Week{2026, 1}},
		{"2026-01-01", Week{2026, 1}},
	}
	for _, c := range cases {
		if got := WeekOf(mustDate(t, c.date)); got != c.want {
			t.Errorf("WeekOf(%s) = %v, want %v", c.date, got, c.want)
		}
	}
	if got := (Week{2026, 1}).Monday().Format(time.DateOnly); got != "2025-12-29" {
		t.Errorf("2026W01 Monday = %s", got)
	}
	if got := (Week{2020, 53}).Day(7).Format(time.DateOnly); got != "2021-01-03" {
		t.Errorf("2020W53 Sunday = %s", got)
	}
	// Across a year with 52 weeks the ID difference is 2, the calendar distance 1.
	a, b := Week{2025, 52}, Week{2026, 1}
	if b.ID()-a.ID() != 2 || Distance(a, b) != 1 || Distance(b, a) != -1 {
		t.Errorf("distance across New Year: ids %d, distance %d", b.ID()-a.ID(), Distance(a, b))
	}
	if got := (Week{2020, 52}).AddWeeks(2); got != (Week{2021, 1}) {
		t.Errorf("2020W52 + 2 = %v", got)
	}
}

func TestKey(t *testing.T) {
	w := Week{2026, 7}
	if w.Key() != "2026W07" {
		t.Fatalf("Key = %s", w.Key())
	}
	if got, err := ParseKey("2026W07"); err != nil || got != w {
		t.Fatalf("ParseKey = %v, %v", got, err)
	}
	for _, bad := range []string{"2026W7", "2026W00", "2025W53", "2026-07", "2026W07x", "2026W 7"} {
		if _, err := ParseKey(bad); err == nil {
			t.Errorf("ParseKey(%q) gives no error", bad)
		}
	}
}
