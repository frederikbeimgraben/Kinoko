package runner

import (
	"context"
	"database/sql"
	"errors"
	"fmt"
	"net/http"
	"path/filepath"
	"time"

	"github.com/frederikbeimgraben/kinoko/backend/internal/modules/sources"
	"github.com/frederikbeimgraben/kinoko/backend/internal/pipeline/model/fit"
	"github.com/frederikbeimgraben/kinoko/backend/internal/pipeline/occ/gbif"
	"github.com/frederikbeimgraben/kinoko/backend/internal/pipeline/weather/dwd"
)

// Chain is the work of the steps in the service. Data is the absolute data
// folder (PILZE_DATA); Maps is the output folder of manifests and tiles.
type Chain struct {
	DB      *sql.DB
	Sources *sources.Module
	Data    string
	Maps    string
	HTTP    *http.Client
	Now     func() time.Time
	// Renderer draws the maps and layers. Nil fails the render steps with ErrNoRenderer.
	Renderer Renderer
	// Fit holds the training settings (Horizons, Grid, Threads). The chain sets the species fields.
	Fit fit.Config
	// DWDBase and GBIFBase replace the public addresses in tests. Empty means the public ones.
	DWDBase  string
	GBIFBase string
	// GBIFPause replaces the pause between GBIF pages. Zero means the pause of gbif_fetch.py.
	GBIFPause time.Duration
}

func (c *Chain) dwdDir() string      { return filepath.Join(c.Data, "cache", "dwd") }
func (c *Chain) gbifDir() string     { return gbif.CacheDir(c.Data) }
func (c *Chain) weeklyDir() string   { return filepath.Join(c.Data, "interim", "weekly") }
func (c *Chain) occurrences() string { return filepath.Join(c.Data, "interim", "occurrences.parquet") }
func (c *Chain) seasonFile() string  { return filepath.Join(c.Data, "derived", "saison.json") }

func (c *Chain) now() time.Time {
	if c.Now == nil {
		return time.Now()
	}
	return c.Now()
}

func (c *Chain) cache() dwd.SQLStore { return dwd.SQLStore{DB: c.DB} }

// hasActive tells if a kind has an active, ready version.
func (c *Chain) hasActive(kind sources.Kind) (bool, error) {
	_, err := c.Sources.Resolver().Active(kind, "")
	if errors.Is(err, sources.ErrMissing) {
		return false, nil
	}
	return err == nil, err
}

// FetchWeather brings the HYRAS and soil moisture files into the cache. The
// fetcher records each file in remote_cache_file and uses conditional GETs.
func (c *Chain) FetchWeather(ctx context.Context, j *Job) error {
	f := &dwd.Fetcher{HTTP: c.HTTP, Base: c.DWDBase, Dir: c.dwdDir(), Cache: c.cache(), Now: c.Now, Log: j}
	checkpoints, err := c.hasActive(sources.KindWeatherCheckpoints)
	if err != nil {
		return err
	}
	var errs []error
	for _, source := range []string{dwd.SourceHyras, dwd.SourceSoil} {
		if j.Request != nil && j.Request.Source != source {
			continue
		}
		cached, err := c.cache().List(ctx, source)
		if err != nil {
			return err
		}
		req := WeatherRequest(j.Request, len(cached) > 0 || checkpoints, j.Now)
		j.Printf("%s: years %v, refresh %v", source, req.Years, req.Refresh)
		var res dwd.Result
		if source == dwd.SourceHyras {
			res, err = f.Hyras(ctx, req)
		} else {
			res, err = f.Soil(ctx, req, dwd.DefaultDepth)
		}
		j.Printf("%s: %s", source, outcomes(res))
		errs = append(errs, err)
	}
	return errors.Join(errs...)
}

// outcomes counts the files of a fetch by outcome.
func outcomes(res dwd.Result) string {
	counts := map[dwd.Outcome]int{}
	for _, f := range res.Files {
		counts[f.Outcome]++
	}
	return fmt.Sprintf("%d downloaded, %d unchanged, %d cached, %d missing, %d failed",
		counts[dwd.Downloaded], counts[dwd.Unchanged], counts[dwd.Cached], counts[dwd.Missing], counts[dwd.Failed])
}

// FetchOccurrences pages the GBIF records of the open years into the cache
// and records each written chunk in remote_cache_file.
func (c *Chain) FetchOccurrences(ctx context.Context, j *Job) error {
	files, err := filepath.Glob(filepath.Join(c.gbifDir(), "*.jsonl.gz"))
	if err != nil {
		return err
	}
	archive, err := c.hasActive(sources.KindGBIFArchive)
	if err != nil {
		return err
	}
	plan := OccurrencePlan(j.Request, len(files) > 0 || archive, j.Now)
	j.Printf("%s: years %v", SourceOccurrences, plan.Years)
	f := &gbif.Fetcher{HTTP: c.HTTP, BaseURL: c.GBIFBase, Dir: c.gbifDir(), Pause: c.GBIFPause, Log: j.Printf, Now: c.Now}
	chunks, fetchErr := f.Fetch(ctx, plan)
	record := context.WithoutCancel(ctx)
	if err := c.recordChunks(record, chunks); err != nil {
		return errors.Join(fetchErr, err)
	}
	return errors.Join(fetchErr, c.dropGone(record))
}
