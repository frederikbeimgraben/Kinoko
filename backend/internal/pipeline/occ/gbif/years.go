package gbif

import (
	"context"
	"os"
	"path/filepath"
	"slices"
	"time"
)

// BootstrapFrom is the first year of the bootstrap fetch (plan section 7.1, A3).
const BootstrapFrom = 2000

// LateReportMonths is the number of months of a year in which the previous
// year still gets late reports and so is fetched again.
const LateReportMonths = 2

// Plan names the years to fetch. A year in Refresh is fetched again and replaces
// its files. Another year is skipped when its files are present.
type Plan struct {
	Years   []int
	Refresh map[int]bool
}

// RefreshYears gives the years whose records still change: the current year,
// and the previous year until the end of February.
func RefreshYears(now time.Time) []int {
	if int(now.Month()) <= LateReportMonths {
		return []int{now.Year() - 1, now.Year()}
	}
	return []int{now.Year()}
}

// WeeklyPlan fetches the refresh years again. This fixes finding 2 of the plan:
// gbif_fetch.py skipped present files, so the current year never changed after its first fetch.
func WeeklyPlan(now time.Time) Plan {
	years := RefreshYears(now)
	return Plan{Years: years, Refresh: setOf(years)}
}

// ResumePlan completes an interrupted bootstrap: it fetches the missing closed
// years and the refresh years. No missing year gives WeeklyPlan.
func ResumePlan(missing []int, now time.Time) Plan {
	refresh := RefreshYears(now)
	years := slices.Sorted(slices.Values(append(slices.Clone(missing), refresh...)))
	return Plan{Years: slices.Compact(years), Refresh: setOf(refresh)}
}

// MissingYears gives each year from start to end without a complete fetch:
// neither a year file nor the DoneName marker is in the cache.
func (f *Fetcher) MissingYears(start, end int) []int {
	var out []int
	for y := start; y <= end; y++ {
		if !exists(filepath.Join(f.Dir, ChunkName(f.country(), y, 0))) && !exists(filepath.Join(f.Dir, DoneName(f.country(), y))) {
			out = append(out, y)
		}
	}
	return out
}

// BootstrapPlan fetches each year from from to the current year. It skips the
// present files of closed years and fetches the refresh years again.
func BootstrapPlan(from int, now time.Time) Plan {
	var years []int
	for y := from; y <= now.Year(); y++ {
		years = append(years, y)
	}
	return Plan{Years: years, Refresh: setOf(RefreshYears(now))}
}

func setOf(years []int) map[int]bool {
	out := map[int]bool{}
	for _, y := range years {
		out[y] = true
	}
	return out
}

// Fetch runs the plan, one year after the other, as gbif_fetch.main. A year
// above MonthThreshold records is fetched by month. A refreshed year writes all
// its chunks first and then replaces its old files, so a failure keeps the old files.
func (f *Fetcher) Fetch(ctx context.Context, plan Plan) ([]Chunk, error) {
	var done []Chunk
	for _, year := range plan.Years {
		chunks, err := f.fetchYear(ctx, year, plan.Refresh[year])
		done = append(done, chunks...)
		if err == nil {
			err = f.markDone(year)
		}
		if err != nil {
			return done, err
		}
	}
	return done, nil
}

// markDone writes the DoneName marker of year. A year split into months or
// without records has no year file that tells this.
func (f *Fetcher) markDone(year int) error {
	if err := os.MkdirAll(f.Dir, 0o755); err != nil {
		return err
	}
	return os.WriteFile(filepath.Join(f.Dir, DoneName(f.country(), year)), nil, 0o644)
}

// pending is a written partial chunk that waits for its commit.
type pending struct {
	w     *chunkWriter
	chunk Chunk
}

func (f *Fetcher) fetchYear(ctx context.Context, year int, refresh bool) ([]Chunk, error) {
	yearPath := filepath.Join(f.Dir, ChunkName(f.country(), year, 0))
	if !refresh && exists(yearPath) {
		f.logf("  %s: present, skipped", filepath.Base(yearPath))
		return []Chunk{{Key: chunkKey(year, 0), Path: yearPath, Year: year, Skipped: true}}, nil
	}
	n, err := f.count(ctx, year, 0)
	if err != nil {
		return nil, err
	}
	f.logf("%d: %d records", year, n)
	var waiting []pending
	var done []Chunk
	run := func(month, expected int) error {
		path := filepath.Join(f.Dir, ChunkName(f.country(), year, month))
		if !refresh && exists(path) {
			f.logf("  %s: present, skipped", filepath.Base(path))
			done = append(done, Chunk{Key: chunkKey(year, month), Path: path, Year: year, Month: month, Skipped: true})
			return nil
		}
		w, c, err := f.fetchChunk(ctx, year, month, expected)
		if err != nil {
			return err
		}
		if refresh {
			waiting = append(waiting, pending{w, c})
			return nil
		}
		done = append(done, c)
		return w.commit()
	}
	err = f.fetchMonths(ctx, year, n, run)
	if err != nil {
		for _, p := range waiting {
			p.w.abort()
		}
		return done, err
	}
	if !refresh {
		return done, nil
	}
	return f.replaceYear(year, waiting)
}

// fetchMonths calls run for the whole year, or for each month with records when the year is too large.
func (f *Fetcher) fetchMonths(ctx context.Context, year, n int, run func(month, expected int) error) error {
	if n == 0 {
		return nil
	}
	if n <= f.threshold() {
		return run(0, n)
	}
	for month := 1; month <= 12; month++ {
		m, err := f.count(ctx, year, month)
		if err != nil {
			return err
		}
		if m == 0 {
			continue
		}
		if m > MaxOffset {
			f.logf("  WARNING %d-%02d: %d records exceed the API limit of %d; split it further", year, month, m, MaxOffset)
		}
		if err := run(month, m); err != nil {
			return err
		}
	}
	return nil
}

// replaceYear commits the new chunks of a year and removes its old files that the new set does not hold.
func (f *Fetcher) replaceYear(year int, waiting []pending) ([]Chunk, error) {
	old, err := YearFiles(f.Dir, f.country(), year)
	if err != nil {
		return nil, err
	}
	var done []Chunk
	var keep []string
	for i, p := range waiting {
		if err := p.w.commit(); err != nil {
			for _, rest := range waiting[i:] {
				rest.w.abort()
			}
			return done, err
		}
		done = append(done, p.chunk)
		keep = append(keep, p.chunk.Path)
	}
	for _, path := range old {
		if !slices.Contains(keep, path) {
			if err := os.Remove(path); err != nil && !os.IsNotExist(err) {
				return done, err
			}
			f.logf("  %s: removed, the refresh no longer has it", filepath.Base(path))
		}
	}
	return done, nil
}

func exists(path string) bool {
	_, err := os.Stat(path)
	return err == nil
}
