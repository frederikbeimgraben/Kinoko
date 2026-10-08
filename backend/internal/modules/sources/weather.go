package sources

import (
	"context"
	"fmt"
	"math"
	"os"
	"path"
	"path/filepath"
	"slices"
	"strings"
	"time"

	"github.com/frederikbeimgraben/kinoko/backend/internal/fn"
)

// weeklyNames are the checkpoints of extract_grids.py, one file per measure.
var weeklyNames = []string{
	"pr", "tas", "tasmin", "tasmax", "hurs",
	"paws_spruce", "paws_beech", "paws_oak", "paws_pine",
	"days_since_rain", "frost_days", "heat_days",
}

// weatherCheckpoints checks a zip of weekly/<name>.parquet files.
type weatherCheckpoints struct{}

// isoWeek is one ISO week.
type isoWeek struct{ year, week int }

func (w isoWeek) String() string { return fmt.Sprintf("%d-W%02d", w.year, w.week) }

func weeksIn(year int) int {
	_, week := time.Date(year, time.December, 28, 0, 0, 0, 0, time.UTC).ISOWeek()
	return week
}

func (w isoWeek) next() isoWeek {
	if w.week < weeksIn(w.year) {
		return isoWeek{w.year, w.week + 1}
	}
	return isoWeek{w.year + 1, 1}
}

func compareWeeks(a, b isoWeek) int {
	if a.year != b.year {
		return a.year - b.year
	}
	return a.week - b.week
}

// gap gives the first week that the sorted, distinct weeks leave out.
func gap(weeks []isoWeek) (isoWeek, bool) {
	for i := 1; i < len(weeks); i++ {
		if want := weeks[i-1].next(); weeks[i] != want {
			return want, true
		}
	}
	return isoWeek{}, false
}

// checkpointEntry finds weekly/<name>.parquet or <name>.parquet in the archive.
func checkpointEntry(names []string, name string) (string, bool) {
	return fn.Find(names, func(entry string) bool {
		return path.Base(entry) == name+".parquet" &&
			(path.Dir(entry) == "." || path.Base(path.Dir(entry)) == "weekly")
	})
}

func weeklyPath(v *Version, name string) string {
	return filepath.Join(v.DerivedDir(), "weekly", name+".parquet")
}

func (weatherCheckpoints) Validate(ctx context.Context, v *Version) (map[string]any, error) {
	z, err := openZip(v.Original())
	if err != nil {
		return nil, err
	}
	defer z.Close()
	entries, err := zipFiles(z)
	if err != nil {
		return nil, err
	}
	names := fn.SortedKeys(entries)
	missing := fn.Filter(weeklyNames, func(n string) bool { _, ok := checkpointEntry(names, n); return !ok })
	if len(missing) > 0 {
		return nil, Fail("missing_files", "the archive has no weekly file for: %s", strings.Join(missing, ", "))
	}
	if err := os.RemoveAll(v.DerivedDir()); err != nil {
		return nil, err
	}
	spans := map[string]any{}
	for _, name := range weeklyNames {
		if err := ctx.Err(); err != nil {
			return nil, err
		}
		entry, _ := checkpointEntry(names, name)
		target := weeklyPath(v, name)
		if err := extract(entries[entry], target); err != nil {
			return nil, err
		}
		span, err := checkWeekly(target, name)
		if err != nil {
			return nil, err
		}
		v.Logf("%s: %s", name, span["from"])
		spans[name] = span
	}
	return map[string]any{"files": len(weeklyNames), "weeks": spans}, nil
}

// checkWeekly checks the columns of one checkpoint and that its weeks have no gap.
func checkWeekly(file, name string) (map[string]any, error) {
	t, err := openTable(file)
	if err != nil {
		return nil, err
	}
	defer t.Close()
	if err := t.require([]string{"iso_year", "iso_week", "cell", name}); err != nil {
		_, detail := failureOf(err, "schema")
		return nil, Fail("schema", "%s: %s", name, detail)
	}
	years, err := t.numbers("iso_year")
	if err != nil {
		return nil, err
	}
	weeks, err := t.numbers("iso_week")
	if err != nil {
		return nil, err
	}
	pairs := fn.Zip(years, weeks)
	if fn.Any(pairs, func(p fn.Pair[float64, float64]) bool { return math.IsNaN(p.First) || math.IsNaN(p.Second) }) {
		return nil, Fail("weeks", "%s: iso_year or iso_week is empty", name)
	}
	distinct := slices.CompactFunc(slices.SortedFunc(slices.Values(fn.Map(pairs, func(p fn.Pair[float64, float64]) isoWeek {
		return isoWeek{int(p.First), int(p.Second)}
	})), compareWeeks), func(a, b isoWeek) bool { return a == b })
	if len(distinct) == 0 {
		return nil, Fail("weeks", "%s has no rows", name)
	}
	if missing, found := gap(distinct); found {
		return nil, Fail("weeks", "%s has no rows for the week %s", name, missing)
	}
	return map[string]any{
		"from": distinct[0].String(), "to": distinct[len(distinct)-1].String(), "rows": t.rows(),
	}, nil
}

func (weatherCheckpoints) Derive(_ context.Context, v *Version) ([]Artifact, error) {
	return fn.MapErr(weeklyNames, func(name string) (Artifact, error) {
		file := weeklyPath(v, name)
		info, err := os.Stat(file)
		if err != nil {
			return Artifact{}, err
		}
		return Artifact{Name: "weekly/" + name, Path: file, SizeBytes: info.Size()}, nil
	})
}
