package runner

import (
	"context"
	"fmt"
	"os"
	"path"
	"path/filepath"
	"slices"
	"time"

	"github.com/frederikbeimgraben/kinoko/backend/internal/fn"
	"github.com/frederikbeimgraben/kinoko/backend/internal/modules/sources"
	"github.com/frederikbeimgraben/kinoko/backend/internal/pipeline/occ/gbif"
	"github.com/frederikbeimgraben/kinoko/backend/internal/pipeline/weather/dwd"
)

// span gives the years of a request range. A missing end takes the first year or the current year.
func span(req *sources.FetchRequest, first int, now time.Time) []int {
	from, to := fn.Deref(req.FromYear, first), fn.Deref(req.ToYear, now.Year())
	years := []int{}
	for y := from; y <= to; y++ {
		years = append(years, y)
	}
	return years
}

func ranged(req *sources.FetchRequest) bool {
	return req != nil && (req.FromYear != nil || req.ToYear != nil)
}

// WeatherRequest gives the DWD years of a fetch. A year range of the request
// wins. Without a range, an empty cache gets the bootstrap from dwd.FirstYear
// and a filled cache gets the weekly years. Force checks each year again.
func WeatherRequest(req *sources.FetchRequest, filled bool, now time.Time) dwd.Request {
	weekly := dwd.Weekly(now)
	var out dwd.Request
	switch {
	case ranged(req):
		years := span(req, dwd.FirstYear, now)
		out = dwd.Request{Years: years, Refresh: fn.Filter(weekly.Refresh, func(y int) bool { return slices.Contains(years, y) })}
	case !filled:
		out = dwd.Bootstrap(now, dwd.FirstYear)
	default:
		out = weekly
	}
	if req != nil && req.Force {
		out.Refresh = slices.Clone(out.Years)
	}
	return out
}

// OccurrencePlan gives the GBIF years of a fetch, by the rules of WeatherRequest.
// An active gbif-archive upload counts as a filled cache for the closed years.
func OccurrencePlan(req *sources.FetchRequest, filled bool, now time.Time) gbif.Plan {
	var out gbif.Plan
	switch {
	case ranged(req):
		years := span(req, gbif.BootstrapFrom, now)
		open := gbif.RefreshYears(now)
		out = gbif.Plan{Years: years, Refresh: fn.Reduce(years, map[int]bool{}, func(acc map[int]bool, y int) map[int]bool {
			acc[y] = slices.Contains(open, y)
			return acc
		})}
	case !filled:
		out = gbif.BootstrapPlan(gbif.BootstrapFrom, now)
	default:
		out = gbif.WeeklyPlan(now)
	}
	if req != nil && req.Force {
		out.Refresh = fn.Reduce(out.Years, map[int]bool{}, func(acc map[int]bool, y int) map[int]bool {
			acc[y] = true
			return acc
		})
	}
	return out
}

// cacheKey is the path of a cache file under PILZE_DATA/cache, as the DWD rows use it.
func cacheKey(file string) string { return path.Join("gbif", filepath.Base(file)) }

// recordChunks writes a remote_cache_file row for each chunk that the fetch
// wrote, and for each present chunk that has no row yet.
func (c *Chain) recordChunks(ctx context.Context, chunks []gbif.Chunk) error {
	store := c.cache()
	for _, ch := range chunks {
		rec := dwd.CacheRecord{Source: SourceOccurrences, Key: cacheKey(ch.Path), URL: ch.URL, State: dwd.StateOK,
			SizeBytes: ch.SizeBytes, FetchedAt: ch.FetchedAt, CheckedAt: ch.FetchedAt}
		if ch.Short() {
			rec.Error = fmt.Sprintf("%d of %d records", ch.Records, ch.Expected)
		}
		if ch.Skipped {
			_, known, err := store.Get(ctx, SourceOccurrences, rec.Key)
			if err != nil || known {
				return err
			}
			info, err := os.Stat(ch.Path)
			if err != nil {
				return err
			}
			rec.SizeBytes, rec.FetchedAt, rec.CheckedAt = info.Size(), info.ModTime(), c.now()
		}
		if err := store.Put(ctx, rec); err != nil {
			return err
		}
	}
	return nil
}

// dropGone removes the rows of GBIF files that a refresh replaced, for example
// a year file that the refresh split into months.
func (c *Chain) dropGone(ctx context.Context) error {
	store := c.cache()
	rows, err := store.List(ctx, SourceOccurrences)
	if err != nil {
		return err
	}
	for _, rec := range rows {
		if rec.State == dwd.StatePruned {
			continue
		}
		if _, err := os.Stat(filepath.Join(c.Data, "cache", filepath.FromSlash(rec.Key))); os.IsNotExist(err) {
			if err := store.Delete(ctx, rec.Source, rec.Key); err != nil {
				return err
			}
		}
	}
	return nil
}
