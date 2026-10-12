package runner

import (
	"context"
	"fmt"
	"path/filepath"

	"github.com/frederikbeimgraben/kinoko/backend/internal/fn"
	"github.com/frederikbeimgraben/kinoko/backend/internal/modules/sources"
	"github.com/frederikbeimgraben/kinoko/backend/internal/pipeline/sitedata"
)

// siteSource is one kind of site data that the service fetches itself.
type siteSource struct {
	file  string
	fetch func(*sitedata.Fetcher, context.Context) (string, error)
}

// siteSources are the kinds of site data that the service fetches itself.
var siteSources = map[sources.Kind]siteSource{
	sources.KindGermanyOutline: {sitedata.OutlineFile, (*sitedata.Fetcher).Outline},
	sources.KindTreeSpeciesMap: {sitedata.TreesFile, (*sitedata.Fetcher).Trees},
	sources.KindDEM:            {sitedata.DEMFile, (*sitedata.Fetcher).DEM},
	sources.KindSoilGrids:      {sitedata.SoilFile, (*sitedata.Fetcher).Soil},
}

func (c *Chain) siteDir() string { return filepath.Join(c.Data, "cache", "sitedata") }

// FetchSiteData fetches one kind of site data when it has no version yet and
// installs it as the new active version. The run holds sources.JobLock, so
// the processing runs here.
func (c *Chain) FetchSiteData(ctx context.Context, j *Job, kind sources.Kind) error {
	s, ok := siteSources[kind]
	if !ok {
		return fmt.Errorf("the service does not fetch %s", kind)
	}
	wanted, err := c.Sources.Wanted(ctx, kind)
	if err != nil {
		return err
	}
	if !wanted {
		j.Printf("%s: a version is active or in processing", kind)
		return nil
	}
	f := &sitedata.Fetcher{HTTP: c.HTTP, Dir: c.siteDir(), Log: j.Printf}
	j.Printf("%s: fetching", kind)
	path, err := s.fetch(f, ctx)
	if err != nil {
		return err
	}
	j.Printf("%s: processing %s", kind, filepath.Base(path))
	v, err := c.Sources.AddFile(ctx, kind, path, s.file)
	if err != nil {
		return fmt.Errorf("%s: %w", kind, err)
	}
	if v.State == sources.StateFailed {
		return fmt.Errorf("%s version %d failed: %s: %s", kind, v.Number,
			fn.Deref(v.ErrorCode, ""), fn.Deref(v.ErrorDetail, ""))
	}
	j.Printf("%s: version %d is active", kind, v.Number)
	return nil
}
