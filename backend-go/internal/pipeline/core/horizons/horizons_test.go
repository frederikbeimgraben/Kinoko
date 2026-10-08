package horizons

import (
	"encoding/json"
	"os"
	"slices"
	"testing"
	"time"

	"github.com/frederikbeimgraben/kinoko/backend/internal/pipeline/core/calendar"
)

// horizons.json comes from testdata/golden.py (horizons_golden): horizons.knowable,
// activity_names, forecast_weeks, horizon_for (one year only) and shared_horizon.
type golden struct {
	Knowable []struct {
		Name  string
		H     int
		Known bool
	}
	Activity map[string][]string
	Forecast []struct {
		Today     string
		Observed  [2]int
		Cap, Lead int
		Weeks     int
	}
	Horizon []struct {
		Year, Last, Week int
		Available        []int
		Horizon          *int
	}
	Shared []struct {
		Sets   [][]int
		Shared int
	}
}

func load(t *testing.T) golden {
	t.Helper()
	raw, err := os.ReadFile("testdata/horizons.json")
	if err != nil {
		t.Fatal(err)
	}
	var g golden
	if err := json.Unmarshal(raw, &g); err != nil {
		t.Fatal(err)
	}
	return g
}

func TestKnowableMatchesPython(t *testing.T) {
	for _, c := range load(t).Knowable {
		if got := Knowable(c.Name, c.H); got != c.Known {
			t.Errorf("Knowable(%q, %d) = %v, want %v", c.Name, c.H, got, c.Known)
		}
	}
}

func TestKnowableCountFallsWithHorizon(t *testing.T) {
	var cols []string
	for _, v := range []string{"pr", "tas", "tasmin"} {
		for _, k := range []int{0, 1, 2, 3, 4, 6, 8} {
			cols = append(cols, v+"_lag"+string(rune('0'+k)))
		}
	}
	var counts []int
	for _, h := range Horizons {
		n := 0
		for _, c := range cols {
			if Knowable(c, h) {
				n++
			}
		}
		counts = append(counts, n)
	}
	if !slices.Equal(counts, []int{21, 18, 15, 12, 9}) {
		t.Errorf("counts = %v", counts)
	}
}

func TestActivityNamesMatchPython(t *testing.T) {
	for key, want := range load(t).Activity {
		h := int(key[0] - '0')
		if got := ActivityNames(h); !slices.Equal(got, want) {
			t.Errorf("ActivityNames(%d) = %v, want %v", h, got, want)
		}
	}
}

func TestForecastWeeksMatchesPython(t *testing.T) {
	for _, c := range load(t).Forecast {
		today, err := time.Parse(time.DateOnly, c.Today)
		if err != nil {
			t.Fatal(err)
		}
		obs := calendar.Week{Year: c.Observed[0], Week: c.Observed[1]}
		if got := ForecastWeeks(today, &obs, c.Cap, c.Lead); got != c.Weeks {
			t.Errorf("ForecastWeeks(%s, %v, %d, %d) = %d, want %d", c.Today, obs, c.Cap, c.Lead, got, c.Weeks)
		}
	}
	if ForecastWeeks(time.Now(), nil, MaxHorizon, Lead) != 0 {
		t.Error("no observed week must give 0")
	}
}

func TestHorizonForMatchesPythonInOneYear(t *testing.T) {
	for _, c := range load(t).Horizon {
		last := calendar.Week{Year: c.Year, Week: c.Last}
		got, err := HorizonFor(calendar.Week{Year: c.Year, Week: c.Week}, &last, c.Available)
		switch {
		case c.Horizon == nil && err == nil:
			t.Errorf("%+v: no error, got %d", c, got)
		case c.Horizon != nil && (err != nil || got != *c.Horizon):
			t.Errorf("%+v: got %d, %v", c, got, err)
		}
	}
}

func TestHorizonForUsesTheCalendar(t *testing.T) {
	// Bug 4: horizon_for gives a distance of 2 here, because 2025 has 52 weeks.
	last := calendar.Week{Year: 2025, Week: 52}
	got, err := HorizonFor(calendar.Week{Year: 2026, Week: 1}, &last, []int{0, 1, 2})
	if err != nil || got != 1 {
		t.Errorf("got %d, %v; want 1", got, err)
	}
	if _, err := HorizonFor(calendar.Week{Year: 2026, Week: 2}, &last, []int{0, 1}); err == nil {
		t.Error("distance 2 with horizons 0 and 1 must fail")
	}
	if got, _ := HorizonFor(calendar.Week{Year: 2026, Week: 2}, nil, []int{0}); got != 0 {
		t.Error("no observed week must give 0")
	}
	// 2020 has 53 weeks: there the ID difference and the calendar agree.
	last = calendar.Week{Year: 2020, Week: 53}
	if got, _ := HorizonFor(calendar.Week{Year: 2021, Week: 1}, &last, Horizons); got != 1 {
		t.Errorf("2020W53 to 2021W01: got %d", got)
	}
}

func TestSharedHorizonMatchesPython(t *testing.T) {
	for _, c := range load(t).Shared {
		if got := SharedHorizon(c.Sets); got != c.Shared {
			t.Errorf("SharedHorizon(%v) = %d, want %d", c.Sets, got, c.Shared)
		}
	}
	if SharedHorizon([][]int{{0, 2}, {0, 1, 2, 3}}) != 2 || SharedHorizon(nil) != 0 {
		t.Error("hand cases of test_horizons.py fail")
	}
}
