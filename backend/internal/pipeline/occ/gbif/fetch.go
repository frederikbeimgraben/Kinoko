package gbif

import (
	"context"
	"fmt"
	"net/http"
	"os"
	"path/filepath"
	"strconv"
	"time"

	"github.com/frederikbeimgraben/kinoko/backend/internal/pipeline/pio"
)

// Fetcher pages the GBIF search API into the cache directory, one file per year
// or per month. The zero value of each optional field takes the default.
type Fetcher struct {
	HTTP           *http.Client  // nil: http.DefaultClient
	Idle           time.Duration // 0: pio.IdleTimeout. A transfer without bytes fails after it.
	BaseURL        string        // "": API
	Dir            string        // the cache, $PILZE_DATA/cache/gbif
	Country        string        // "": DE
	Pause          time.Duration
	MonthThreshold int
	Attempts       int
	// Sleep waits between pages and before a retry. nil: a timer that stops with ctx.
	Sleep func(ctx context.Context, d time.Duration) error
	// Log takes the progress lines. nil: no log.
	Log func(format string, args ...any)
	// Now gives the time of the written chunks. nil: time.Now.
	Now func() time.Time
}

// Chunk tells what the fetcher did with one cache file, for the fetch_cache table.
type Chunk struct {
	Key       string // gbif:2026 or gbif:2026-05
	URL       string
	Path      string
	Year      int
	Month     int // 0 for a year file
	Expected  int // the count of the API
	Records   int
	Skipped   bool // present and not refreshed
	FetchedAt time.Time
	SizeBytes int64
}

// Short tells that the chunk got fewer records than the API counted.
func (c Chunk) Short() bool { return !c.Skipped && c.Records < c.Expected }

func (f *Fetcher) base() string         { return or(f.BaseURL, API) }
func (f *Fetcher) country() string      { return or(f.Country, "DE") }
func (f *Fetcher) pause() time.Duration { return orZero(f.Pause, Pause) }
func (f *Fetcher) threshold() int       { return orZero(f.MonthThreshold, MonthThreshold) }
func (f *Fetcher) attempts() int        { return orZero(f.Attempts, Attempts) }

func (f *Fetcher) client() *http.Client { return pio.Watched(f.HTTP, orZero(f.Idle, pio.IdleTimeout)) }

func (f *Fetcher) now() time.Time {
	if f.Now == nil {
		return time.Now()
	}
	return f.Now()
}

func (f *Fetcher) logf(format string, args ...any) {
	if f.Log != nil {
		f.Log(format, args...)
	}
}

func (f *Fetcher) sleep(ctx context.Context, d time.Duration) error {
	if f.Sleep != nil {
		return f.Sleep(ctx, d)
	}
	t := time.NewTimer(d)
	defer t.Stop()
	select {
	case <-ctx.Done():
		return ctx.Err()
	case <-t.C:
		return nil
	}
}

func or(s, fallback string) string {
	if s == "" {
		return fallback
	}
	return s
}

func orZero[T comparable](v, fallback T) T {
	var zero T
	if v == zero {
		return fallback
	}
	return v
}

// Filter gives the record filter of a fetch as key and value pairs, in request order.
// The fetch uses FungiTaxonKey. tools/gbifcount uses the key of one species.
func Filter(country string, taxonKey int) [][2]string {
	return [][2]string{
		{"country", country},
		{"taxonKey", strconv.Itoa(taxonKey)},
		{"hasCoordinate", "true"},
		{"hasGeospatialIssue", "false"},
		{"basisOfRecord", "HUMAN_OBSERVATION"},
		{"occurrenceStatus", "PRESENT"},
	}
}

// baseParams gives the base query parameters followed by extra.
func (f *Fetcher) baseParams(extra ...param) []param {
	filter := Filter(f.country(), FungiTaxonKey)
	out := make([]param, 0, len(filter)+len(extra))
	for _, kv := range filter {
		out = append(out, param{kv[0], kv[1]})
	}
	return append(out, extra...)
}

func timeParams(year, month int) []param {
	p := []param{{"year", strconv.Itoa(year)}}
	if month != 0 {
		p = append(p, param{"month", strconv.Itoa(month)})
	}
	return p
}

// count asks the API for the number of records of a year or of one month.
func (f *Fetcher) count(ctx context.Context, year, month int) (int, error) {
	p, err := f.get(ctx, f.baseParams(append([]param{{"limit", "0"}}, timeParams(year, month)...)...))
	return p.Count, err
}

// fetchChunk is fetch_chunk without the presence check: it pages one year or
// month into a partial file and leaves the commit to the caller.
func (f *Fetcher) fetchChunk(ctx context.Context, year, month, expected int) (*chunkWriter, Chunk, error) {
	path := filepath.Join(f.Dir, ChunkName(f.country(), year, month))
	c := Chunk{Key: chunkKey(year, month), Path: path, Year: year, Month: month, Expected: expected,
		URL: f.base() + "?" + encode(f.baseParams(timeParams(year, month)...))}
	w, err := newChunkWriter(path)
	if err != nil {
		return nil, c, err
	}
	for offset := 0; offset < MaxOffset; offset += PageLimit {
		extra := append([]param{{"limit", strconv.Itoa(PageLimit)}, {"offset", strconv.Itoa(offset)}},
			timeParams(year, month)...)
		p, err := f.get(ctx, f.baseParams(extra...))
		if err != nil {
			w.abort()
			return nil, c, err
		}
		for _, r := range p.Results {
			if err := w.write(Line(Slim(r))); err != nil {
				w.abort()
				return nil, c, err
			}
		}
		if p.EndOfRecords || len(p.Results) == 0 {
			break
		}
		if err := f.sleep(ctx, f.pause()); err != nil {
			w.abort()
			return nil, c, err
		}
	}
	if err := w.finish(); err != nil {
		w.abort()
		return nil, c, err
	}
	c.Records = w.records
	c.FetchedAt = f.now()
	if st, err := os.Stat(path + PartialSuffix); err == nil {
		c.SizeBytes = st.Size()
	}
	flag := ""
	if c.Short() {
		flag = fmt.Sprintf("  << SHORT, expected %d", expected)
	}
	f.logf("  %s: %d records%s", filepath.Base(path), c.Records, flag)
	return w, c, nil
}

func chunkKey(year, month int) string {
	if month == 0 {
		return fmt.Sprintf("gbif:%d", year)
	}
	return fmt.Sprintf("gbif:%d-%02d", year, month)
}
