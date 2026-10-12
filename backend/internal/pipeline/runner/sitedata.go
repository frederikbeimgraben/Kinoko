package runner

import (
	"context"
	"errors"
	"fmt"
	"path/filepath"

	"github.com/frederikbeimgraben/kinoko/backend/internal/fn"
	"github.com/frederikbeimgraben/kinoko/backend/internal/modules/sources"
	"github.com/frederikbeimgraben/kinoko/backend/internal/pipeline/sitedata"
)

// siteSource is one kind of site data that the service fetches itself.
type siteSource struct {
	kind  sources.Kind
	file  string
	fetch func(*sitedata.Fetcher, context.Context) (string, error)
}

// siteSources are in the order of their processing: the tree map renders its
// fine layers inside the outline, and the soil joins the terrain columns of the DEM.
var siteSources = []siteSource{
	{sources.KindGermanyOutline, sitedata.OutlineFile, (*sitedata.Fetcher).Outline},
	{sources.KindTreeSpeciesMap, sitedata.TreesFile, (*sitedata.Fetcher).Trees},
	{sources.KindDEM, sitedata.DEMFile, (*sitedata.Fetcher).DEM},
	{sources.KindSoilGrids, sitedata.SoilFile, (*sitedata.Fetcher).Soil},
}

func (c *Chain) siteDir() string { return filepath.Join(c.Data, "cache", "sitedata") }

// FetchSiteData fetches each kind of site data that has no version yet and
// installs it as a new active version. The run holds sources.JobLock, so the
// processing runs here, in order. A failed kind does not stop the next one.
func (c *Chain) FetchSiteData(ctx context.Context, j *Job) error {
	f := &sitedata.Fetcher{HTTP: c.HTTP, Dir: c.siteDir(), Log: j.Printf}
	var errs []error
	for _, s := range siteSources {
		wanted, err := c.Sources.Wanted(ctx, s.kind)
		if err != nil {
			return err
		}
		if !wanted {
			j.Printf("%s: a version is active or in processing", s.kind)
			continue
		}
		j.Printf("%s: fetching", s.kind)
		path, err := s.fetch(f, ctx)
		if err != nil {
			errs = append(errs, err)
			j.Printf("%s: %v", s.kind, err)
			continue
		}
		j.Printf("%s: processing %s", s.kind, filepath.Base(path))
		v, err := c.Sources.AddFile(ctx, s.kind, path, s.file)
		if err != nil {
			errs = append(errs, fmt.Errorf("%s: %w", s.kind, err))
			continue
		}
		if v.State == sources.StateFailed {
			errs = append(errs, fmt.Errorf("%s version %d failed: %s: %s", s.kind, v.Number,
				fn.Deref(v.ErrorCode, ""), fn.Deref(v.ErrorDetail, "")))
			continue
		}
		j.Printf("%s: version %d is active", s.kind, v.Number)
	}
	return errors.Join(errs...)
}
