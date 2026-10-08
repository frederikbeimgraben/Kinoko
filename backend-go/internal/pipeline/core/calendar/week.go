// Package calendar holds the ISO week of the chain: the join key, the tile
// key and the distance between two weeks over the calendar.
package calendar

import (
	"fmt"
	"time"
)

// Week is one ISO week, as date.isocalendar gives it.
type Week struct{ Year, Week int }

const day = 24 * time.Hour

// WeekOf returns the ISO week of the date of t, in the location of t.
func WeekOf(t time.Time) Week {
	year, week := t.ISOWeek()
	return Week{Year: year, Week: week}
}

// Monday returns the Monday of the week at 00:00 UTC, as date.fromisocalendar(y, w, 1).
// It does not check the week. Use Valid for that.
func (w Week) Monday() time.Time {
	jan4 := time.Date(w.Year, time.January, 4, 0, 0, 0, 0, time.UTC)
	isoWeekday := (int(jan4.Weekday())+6)%7 + 1
	first := jan4.AddDate(0, 0, 1-isoWeekday)
	return first.AddDate(0, 0, 7*(w.Week-1))
}

// Day returns the day of the week with the ISO weekday isoWd (1 is Monday, 7 is Sunday).
func (w Week) Day(isoWd int) time.Time {
	return w.Monday().AddDate(0, 0, isoWd-1)
}

// Valid tells if the week exists. Week 53 exists only in a year with 53 ISO weeks.
func (w Week) Valid() bool {
	return w.Week >= 1 && w.Week <= 53 && WeekOf(w.Monday()) == w
}

// ID returns year*53 + week, as build_dataset.week_number. Use it as a join key only.
// It is not a distance: a year with 52 weeks leaves a gap. Use Distance for that.
func (w Week) ID() int { return w.Year*53 + w.Week }

// Key returns the week key of tile paths and layers, for example "2026W07".
func (w Week) Key() string { return fmt.Sprintf("%dW%02d", w.Year, w.Week) }

// String returns Key.
func (w Week) String() string { return w.Key() }

// AddWeeks returns the week n weeks after w. A negative n goes back.
func (w Week) AddWeeks(n int) Week { return WeekOf(w.Monday().AddDate(0, 0, 7*n)) }

// Before tells if w comes before o.
func (w Week) Before(o Week) bool { return w.ID() < o.ID() }

// Distance returns the whole weeks from a to b over the calendar, as
// horizons._week_distance. It is negative when b comes before a.
func Distance(a, b Week) int {
	days := int(b.Monday().Sub(a.Monday()) / day)
	return floorDiv(days, 7)
}

// ParseKey reads a week key such as "2026W07". It refuses a week that does not exist.
func ParseKey(key string) (Week, error) {
	var w Week
	n, _ := fmt.Sscanf(key, "%dW%d", &w.Year, &w.Week)
	if n != 2 || w.Key() != key || !w.Valid() {
		return Week{}, fmt.Errorf("calendar: bad week key %q", key)
	}
	return w, nil
}

func floorDiv(a, b int) int {
	q := a / b
	if (a%b != 0) && ((a < 0) != (b < 0)) {
		q--
	}
	return q
}
