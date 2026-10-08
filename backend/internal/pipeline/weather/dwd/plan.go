package dwd

import (
	"path"
	"regexp"
	"slices"
	"strconv"
	"time"
)

// FirstYear is the first year of the weather record (extract_grids.py --start).
const FirstYear = 2014

// Request names the years to fetch. A year in Refresh is checked again with a
// conditional GET. Each other year is immutable once a file of it is in the cache.
type Request struct {
	Years   []int
	Refresh []int
}

// Bootstrap returns the request of the first fetch: each year from start to the
// year of now. The open years are checked again.
func Bootstrap(now time.Time, start int) Request {
	years := []int{}
	for y := start; y <= now.Year(); y++ {
		years = append(years, y)
	}
	return Request{Years: years, Refresh: openYears(now)}
}

// Weekly returns the request of the weekly run: the previous and the current
// year. The previous year is fetched only when it is missing, except in January.
func Weekly(now time.Time) Request {
	return Request{Years: []int{now.Year() - 1, now.Year()}, Refresh: openYears(now)}
}

// openYears are the years whose files can still change. In January the DWD
// can still add the last days of December, and an ISO week spans the turn of the year.
func openYears(now time.Time) []int {
	if now.Month() == time.January {
		return []int{now.Year() - 1, now.Year()}
	}
	return []int{now.Year()}
}

func (r Request) refreshes(year int) bool { return slices.Contains(r.Refresh, year) }

var fileYearRe = regexp.MustCompile(`_((?:19|20)\d\d)_`)

// YearOf returns the data year in the name of a HYRAS or soil moisture file (or a key that ends in one).
func YearOf(key string) (int, bool) {
	m := fileYearRe.FindStringSubmatch(path.Base(key))
	if m == nil {
		return 0, false
	}
	y, err := strconv.Atoi(m[1])
	return y, err == nil
}
