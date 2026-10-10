package dwd

import (
	"path"
	"regexp"
	"slices"
	"strconv"
	"time"
)

// FirstYear is the first year of the weather record.
const FirstYear = 2014

// Request names the years to fetch. A year in Refresh is checked again with a
// conditional GET. Each other year is immutable once a file of it is in the cache.
type Request struct {
	Years   []int
	Refresh []int
}

// Bootstrap returns the request of the first fetch: each year from start to the
// year of current. The fetch checks the open years again.
func Bootstrap(current time.Time, start int) Request {
	years := []int{}
	for y := start; y <= current.Year(); y++ {
		years = append(years, y)
	}
	return Request{Years: years, Refresh: openYears(current)}
}

// Resume returns the request that completes an interrupted bootstrap: the
// missing closed years and the years of Weekly. No missing year gives Weekly.
func Resume(now time.Time, missing []int) Request {
	weekly := Weekly(now)
	years := slices.Sorted(slices.Values(append(slices.Clone(missing), weekly.Years...)))
	return Request{Years: slices.Compact(years), Refresh: weekly.Refresh}
}

// MissingYears gives each year from start to end that lacks a usable row
// (StateOK or StatePruned) in a folder of source. rows are the rows of source.
func MissingYears(rows []CacheRecord, source string, start, end int) []int {
	have := map[string]bool{}
	for _, r := range rows {
		if year, ok := YearOf(r.Key); ok && (r.State == StateOK || r.State == StatePruned) {
			have[path.Dir(r.Key)+"/"+strconv.Itoa(year)] = true
		}
	}
	folders := Folders(source)
	var out []int
	for y := start; y <= end; y++ {
		if slices.ContainsFunc(folders, func(dir string) bool { return !have[dir+"/"+strconv.Itoa(y)] }) {
			out = append(out, y)
		}
	}
	return out
}

// Folders gives the cache folders of source, as the keys of its rows hold them.
func Folders(source string) []string {
	var out []string
	switch source {
	case SourceHyras:
		for _, hv := range HyrasFolders {
			out = append(out, path.Join("dwd", "hyras", hv.Folder))
		}
	case SourceSoil:
		for _, tree := range TreeSpecies {
			out = append(out, path.Join("dwd", "soil_moisture", tree))
		}
	}
	return out
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
