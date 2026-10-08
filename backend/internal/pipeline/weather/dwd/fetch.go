package dwd

import (
	"context"
	"errors"
	"fmt"
	"net/http"
	"os"
	"path"
	"path/filepath"
	"regexp"
	"slices"
	"strings"
	"time"
)

// Logger takes progress lines. *log.Logger satisfies it.
type Logger interface {
	Printf(format string, v ...any)
}

// Fetcher downloads DWD grids into Dir (PILZE_DATA/cache/dwd) and records each
// file in Cache. The zero values of the optional fields give the defaults.
type Fetcher struct {
	HTTP      *http.Client                    // http.DefaultClient when nil
	Base      string                          // BaseURL when empty
	Dir       string                          // the cache root of the DWD files
	Cache     CacheStore                      // no bookkeeping when nil
	UserAgent string                          // DefaultUserAgent when empty
	Attempts  int                             // 4 when 0, as dwd_fetch.download
	Backoff   func(attempt int) time.Duration // the wait before the next attempt
	Now       func() time.Time                // time.Now when nil
	Log       Logger                          // no log when nil
}

// DefaultUserAgent names the service to the DWD server.
const DefaultUserAgent = "kinoko-pipeline/1 (fungal fruiting phenology)"

// Outcome tells what a fetch did with one file.
type Outcome string

// Outcomes of FileResult.
const (
	Downloaded Outcome = "downloaded" // A new or changed file is in the cache.
	Unchanged  Outcome = "unchanged"  // The conditional GET found no change.
	Cached     Outcome = "cached"     // A closed year with a file in the cache: no request.
	Missing    Outcome = "missing"    // The server has no file for the year.
	Failed     Outcome = "failed"     // The listing or the download failed.
)

// FileResult is the outcome for one variable (or stand) and year.
type FileResult struct {
	Source  string
	Key     string
	Year    int
	Outcome Outcome
	Err     error
}

// Result lists the outcome of each file of one fetch.
type Result struct{ Files []FileResult }

// Changed tells if a file was downloaded. Then the weekly checkpoints need an extraction.
func (r Result) Changed() bool {
	return slices.ContainsFunc(r.Files, func(f FileResult) bool { return f.Outcome == Downloaded })
}

// Err joins the errors of the failed files.
func (r Result) Err() error {
	var errs []error
	for _, f := range r.Files {
		if f.Err != nil {
			errs = append(errs, f.Err)
		}
	}
	return errors.Join(errs...)
}

// Hyras fetches the HYRAS files of the years in req for each folder of HyrasFolders.
// One listing per folder gives the names. The error joins the failures of all files.
func (f *Fetcher) Hyras(ctx context.Context, req Request) (Result, error) {
	var res Result
	for _, hv := range HyrasFolders {
		dir := path.Join("hyras", hv.Folder)
		names, err := f.listing(ctx, f.base()+"/hyras_de/"+hv.Folder+"/")
		if err != nil {
			res.Files = append(res.Files, FileResult{Source: SourceHyras, Key: path.Join("dwd", dir),
				Outcome: Failed, Err: fmt.Errorf("dwd: listing of %s: %w", hv.Folder, err)})
			continue
		}
		for _, year := range req.Years {
			if err := ctx.Err(); err != nil {
				return res, err
			}
			pattern := HyrasPattern(hv.Short, year)
			name := NewestVersion(names, pattern)
			res.Files = append(res.Files, f.fetchYear(ctx, SourceHyras, f.base()+"/hyras_de/"+hv.Folder+"/",
				dir, name, pattern, year, req.refreshes(year)))
		}
	}
	return res, res.Err()
}

// Soil fetches the soil moisture files of depth (DefaultDepth) for each stand
// of TreeSpecies. Each year has its own directory on the server.
func (f *Fetcher) Soil(ctx context.Context, req Request, depth string) (Result, error) {
	var res Result
	for _, tree := range TreeSpecies {
		dir := path.Join("soil_moisture", tree)
		for _, year := range req.Years {
			if err := ctx.Err(); err != nil {
				return res, err
			}
			url := fmt.Sprintf("%s/soil_moisture/%s/%d/", f.base(), tree, year)
			pattern := SoilPattern(tree, year, depth)
			names, err := f.listing(ctx, url)
			var status *statusError
			switch {
			case errors.As(err, &status) && status.code == http.StatusNotFound:
				names = nil
			case err != nil:
				res.Files = append(res.Files, FileResult{Source: SourceSoil, Key: path.Join("dwd", dir),
					Year: year, Outcome: Failed, Err: fmt.Errorf("dwd: listing of %s %d: %w", tree, year, err)})
				continue
			}
			name := NewestVersion(names, pattern)
			res.Files = append(res.Files, f.fetchYear(ctx, SourceSoil, url, dir, name, pattern, year, req.refreshes(year)))
		}
	}
	return res, res.Err()
}

// fetchYear brings the file name of one year into the cache directory dir.
// A new version replaces the older versions of the same year.
func (f *Fetcher) fetchYear(ctx context.Context, source, dirURL, dir, name string,
	pattern *regexp.Regexp, year int, refresh bool) FileResult {
	res := FileResult{Source: source, Key: path.Join("dwd", dir, name), Year: year}
	if name == "" {
		res.Key, res.Outcome = path.Join("dwd", dir), Missing
		f.logf("  none  %s %d", dir, year)
		return res
	}
	local := filepath.Join(f.Dir, filepath.FromSlash(dir))
	versions := localVersions(local, pattern)
	if !refresh && len(versions) > 0 {
		res.Outcome = Cached
		res.Err = f.adopt(ctx, source, path.Join("dwd", dir, versions[len(versions)-1]), dirURL+versions[len(versions)-1],
			filepath.Join(local, versions[len(versions)-1]))
		return res
	}
	prev, _, err := f.get(ctx, source, res.Key)
	if err != nil {
		res.Outcome, res.Err = Failed, err
		return res
	}
	target := filepath.Join(local, name)
	var cond *validators
	if slices.Contains(versions, name) {
		cond = validatorsOf(prev, target)
	}
	got, err := f.download(ctx, dirURL+name, target, cond)
	now := f.now()
	rec := prev
	rec.Source, rec.Key, rec.URL, rec.CheckedAt = source, res.Key, dirURL+name, now
	if err != nil {
		rec.State, rec.Error = StateFailed, err.Error()
		res.Outcome, res.Err = Failed, errors.Join(fmt.Errorf("dwd: %s: %w", res.Key, err), f.put(ctx, rec))
		f.logf("  FAIL  %s: %v", res.Key, err)
		return res
	}
	rec.State, rec.Error = StateOK, ""
	rec.ETag, rec.LastModified = orElse(got.etag, rec.ETag), orElse(got.lastModified, rec.LastModified)
	if got.unchanged {
		res.Outcome = Unchanged
		if rec.SizeBytes == 0 {
			rec.SizeBytes = got.size
		}
		f.logf("  same  %s", res.Key)
		res.Err = f.put(ctx, rec)
		return res
	}
	rec.SizeBytes, rec.SHA256, rec.FetchedAt = got.size, got.sha256, now
	res.Outcome = Downloaded
	f.logf("  ok    %s  %.0f MB", res.Key, float64(got.size)/1e6)
	res.Err = errors.Join(f.put(ctx, rec), f.dropOthers(ctx, source, local, dir, name, versions))
	return res
}

// adopt registers a file that is in the cache but has no row, for example after a migration.
func (f *Fetcher) adopt(ctx context.Context, source, key, url, file string) error {
	if f.Cache == nil {
		return nil
	}
	if _, ok, err := f.Cache.Get(ctx, source, key); err != nil || ok {
		return err
	}
	info, err := os.Stat(file)
	if err != nil {
		return fmt.Errorf("dwd: %w", err)
	}
	return f.put(ctx, CacheRecord{Source: source, Key: key, URL: url, SizeBytes: info.Size(),
		LastModified: info.ModTime().UTC().Format(http.TimeFormat), State: StateOK})
}

// dropOthers removes the older versions of a year after a new version arrived.
func (f *Fetcher) dropOthers(ctx context.Context, source, local, dir, keep string, versions []string) error {
	var errs []error
	for _, v := range versions {
		if v == keep {
			continue
		}
		if err := os.Remove(filepath.Join(local, v)); err != nil && !errors.Is(err, os.ErrNotExist) {
			errs = append(errs, err)
		}
		if f.Cache != nil {
			errs = append(errs, f.Cache.Delete(ctx, source, path.Join("dwd", dir, v)))
		}
	}
	return errors.Join(errs...)
}

// localVersions lists the cached files of dir that pattern matches, oldest version first.
func localVersions(dir string, pattern *regexp.Regexp) []string {
	entries, _ := os.ReadDir(dir)
	out := []string{}
	for _, e := range entries {
		if !e.IsDir() && fullMatch(pattern, e.Name()) {
			out = append(out, e.Name())
		}
	}
	slices.SortStableFunc(out, func(a, b string) int {
		ka, kb := VersionKey(a), VersionKey(b)
		if ka[0] != kb[0] {
			return ka[0] - kb[0]
		}
		return ka[1] - kb[1]
	})
	return out
}

func (f *Fetcher) get(ctx context.Context, source, key string) (CacheRecord, bool, error) {
	if f.Cache == nil {
		return CacheRecord{}, false, nil
	}
	return f.Cache.Get(ctx, source, key)
}

func (f *Fetcher) put(ctx context.Context, rec CacheRecord) error {
	if f.Cache == nil {
		return nil
	}
	return f.Cache.Put(ctx, rec)
}

func (f *Fetcher) base() string {
	if f.Base == "" {
		return BaseURL
	}
	return strings.TrimRight(f.Base, "/")
}

func (f *Fetcher) now() time.Time {
	if f.Now == nil {
		return time.Now().UTC()
	}
	return f.Now().UTC()
}

func (f *Fetcher) logf(format string, v ...any) {
	if f.Log != nil {
		f.Log.Printf(format, v...)
	}
}

func orElse(a, b string) string {
	if a != "" {
		return a
	}
	return b
}
