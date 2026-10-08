// Package horizons holds the forecast horizons of the chain, as horizons.py.
// A horizon is the distance in weeks from the last week with weather to the
// week that a model answers for.
package horizons

import (
	"fmt"
	"regexp"
	"slices"
	"strconv"
	"strings"
	"time"

	"github.com/frederikbeimgraben/kinoko/backend/internal/fn"
	"github.com/frederikbeimgraben/kinoko/backend/internal/pipeline/core/calendar"
)

// Horizons are the horizons that the final model is built for, in weeks.
var Horizons = []int{0, 1, 2, 3, 4}

// Windows are the windows of the activity features, in days.
var Windows = []int{7, 14, 21}

// Lead is the number of weeks that a run reaches past the last week with weather.
const Lead = 2

// MaxHorizon is the largest value of Horizons, the default cap of ForecastWeeks.
const MaxHorizon = 4

var (
	lagPattern    = regexp.MustCompile(`_lag(\d+)$`)
	windowPattern = regexp.MustCompile(`_(sum|mean)\d+$`)
)

// ActivityNames returns the column names of the activity features for horizon h.
func ActivityNames(h int) []string {
	suffix := ""
	if h != 0 {
		suffix = fmt.Sprintf("_h%d", h)
	}
	return fn.Map(Windows, func(w int) string { return fmt.Sprintf("activity_rate_%dd%s", w, suffix) })
}

// Knowable tells if a weather column is known when the target week is h weeks away.
// A lag k is known when k >= h. A window, an anomaly or a temperature drop
// ends at the target week, so it is not known.
func Knowable(name string, h int) bool {
	if h == 0 {
		return true
	}
	if m := lagPattern.FindStringSubmatch(name); m != nil {
		lag, err := strconv.Atoi(m[1])
		// Only an overflow fails, and such a lag is larger than each horizon.
		return err != nil || lag >= h
	}
	if windowPattern.MatchString(name) || strings.HasSuffix(name, "_anom") || strings.HasSuffix(name, "_ratio") {
		return false
	}
	return !strings.HasPrefix(name, "tas_drop")
}

// HorizonFor returns the horizon that week w takes. A week up to observedLast
// takes 0. A later week takes the smallest available horizon that is at least
// its distance. It is an error when no such horizon is available.
func HorizonFor(w calendar.Week, observedLast *calendar.Week, available []int) (int, error) {
	if observedLast == nil {
		return 0, nil
	}
	// horizon_for uses the difference of week IDs, which is one too large across a
	// year with 52 weeks (bug 4). The calendar distance is correct.
	dist := calendar.Distance(*observedLast, w)
	if dist <= 0 {
		return 0, nil
	}
	sorted := slices.Sorted(slices.Values(available))
	idx := slices.IndexFunc(sorted, func(h int) bool { return h >= dist })
	if idx < 0 {
		return 0, fmt.Errorf("horizons: the bundle has no model for horizon %d; available are %v", dist, sorted)
	}
	return sorted[idx], nil
}

// SharedHorizon returns the largest horizon that each set contains, or 0
// when there is no set or no shared horizon.
func SharedHorizon(sets [][]int) int {
	if len(sets) == 0 {
		return 0
	}
	shared := fn.Filter(sets[0], func(h int) bool {
		return fn.All(sets[1:], func(set []int) bool { return slices.Contains(set, h) })
	})
	if len(shared) == 0 {
		return 0
	}
	return slices.Max(shared)
}

// ForecastWeeks returns how many weeks a run reaches past the last week with
// weather: the distance from observed to the week of today plus lead, in 0..cap.
func ForecastWeeks(today time.Time, observed *calendar.Week, cap, lead int) int {
	if observed == nil {
		return 0
	}
	dist := calendar.Distance(*observed, calendar.WeekOf(today))
	return max(0, min(dist+lead, cap))
}
