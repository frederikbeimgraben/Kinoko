// Package dwd fetches the DWD daily grids (HYRAS and soil moisture) into a
// local cache. It keeps one row per file in the table
// remote_cache_file through CacheStore.
package dwd

import (
	"fmt"
	"regexp"
	"strconv"
	"strings"
)

// BaseURL is the root of the DWD daily grids for Germany.
const BaseURL = "https://opendata.dwd.de/climate_environment/CDC/grids_germany/daily"

// Source names of the rows in remote_cache_file.
const (
	SourceHyras = "dwd-hyras"
	SourceSoil  = "dwd-soil-moisture"
)

// HyrasFolder maps a HYRAS server folder to the variable name in its files.
// radiation_global is not in the list: the extraction does not use it (5 km grid, ends 2020).
type HyrasFolder struct{ Folder, Short string }

// HyrasFolders are the HYRAS variables that the chain reads, in extraction order.
var HyrasFolders = []HyrasFolder{
	{"precipitation", "pr"},
	{"air_temperature_mean", "tas"},
	{"air_temperature_min", "tasmin"},
	{"air_temperature_max", "tasmax"},
	{"humidity", "hurs"},
}

// TreeSpecies are the stands of the soil moisture grids.
var TreeSpecies = []string{"spruce", "beech", "oak", "pine"}

// DefaultDepth is the soil layer in cm that the chain reads.
const DefaultDepth = "0-30"

var hrefRe = regexp.MustCompile(`href="([^"?][^"]*)"`)

// ParseListing returns the file and directory names of a server directory page.
// It drops the parent link "../".
func ParseListing(html string) []string {
	matches := hrefRe.FindAllStringSubmatch(html, -1)
	out := make([]string, 0, len(matches))
	for _, m := range matches {
		if !strings.HasPrefix(m[1], "../") {
			out = append(out, m[1])
		}
	}
	return out
}

// HyrasPattern matches the HYRAS file of one variable and year, for example pr_hyras_1_2020_v6-0_de.nc.
func HyrasPattern(short string, year int) *regexp.Regexp {
	return regexp.MustCompile(fmt.Sprintf(`^(?:%s_hyras_\d+_%d_v[\d-]+_de\.nc)$`, regexp.QuoteMeta(short), year))
}

// SoilPattern matches the soil moisture file of one stand, year and depth.
func SoilPattern(tree string, year int, depth string) *regexp.Regexp {
	return regexp.MustCompile(fmt.Sprintf(`^(?:grids_germany_daily_soil_moisture_%s_%d_%s_v[\d-]+\.nc)$`,
		regexp.QuoteMeta(tree), year, regexp.QuoteMeta(depth)))
}

// versionRe accepts a "_" or a "." after the version, so each soil file gets
// its real version key.
var versionRe = regexp.MustCompile(`_v(\d+)(?:-(\d+))?[_.]`)

// VersionKey returns the (major, minor) version of a DWD file name, or (0, 0).
func VersionKey(name string) [2]int {
	m := versionRe.FindStringSubmatch(name)
	if m == nil {
		return [2]int{}
	}
	major, _ := strconv.Atoi(m[1])
	minor, _ := strconv.Atoi(m[2])
	return [2]int{major, minor}
}

// NewestVersion returns the name with the highest version among the names
// that re matches in full, or "". On a tie the first name wins.
func NewestVersion(names []string, re *regexp.Regexp) string {
	best, bestKey := "", [2]int{-1, -1}
	for _, n := range names {
		if !fullMatch(re, n) {
			continue
		}
		k := VersionKey(n)
		if k[0] > bestKey[0] || (k[0] == bestKey[0] && k[1] > bestKey[1]) {
			best, bestKey = n, k
		}
	}
	return best
}

func fullMatch(re *regexp.Regexp, s string) bool {
	loc := re.FindStringIndex(s)
	return loc != nil && loc[0] == 0 && loc[1] == len(s)
}
