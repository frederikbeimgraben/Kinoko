package dwd

import (
	"context"
	"errors"
	"os"
	"path"
	"path/filepath"
	"strings"
)

// Status returns the state of the HYRAS and the soil moisture source, from the cache rows.
func (f *Fetcher) Status(ctx context.Context) ([]RemoteStatus, error) {
	out := []RemoteStatus{}
	for _, src := range []string{SourceHyras, SourceSoil} {
		var recs []CacheRecord
		if f.Cache != nil {
			var err error
			if recs, err = f.Cache.List(ctx, src); err != nil {
				return nil, err
			}
		}
		out = append(out, Summarize(src, recs))
	}
	return out, nil
}

// PruneBefore removes the cached .nc files of each year before year (setting
// dwd_keep_raw_years). Call it only when the weekly checkpoints hold those years.
// It marks their rows as pruned and returns the removed keys.
func (f *Fetcher) PruneBefore(ctx context.Context, year int) ([]string, error) {
	removed := []string{}
	var errs []error
	for _, src := range []struct{ source, dir string }{{SourceHyras, "hyras"}, {SourceSoil, "soil_moisture"}} {
		root := filepath.Join(f.Dir, src.dir)
		err := filepath.WalkDir(root, func(p string, d os.DirEntry, err error) error {
			if err != nil || d.IsDir() || !strings.HasSuffix(p, ".nc") {
				return nil
			}
			y, ok := YearOf(p)
			if !ok || y >= year {
				return nil
			}
			rel, err := filepath.Rel(f.Dir, p)
			if err != nil {
				return err
			}
			key := path.Join("dwd", filepath.ToSlash(rel))
			if err := os.Remove(p); err != nil {
				errs = append(errs, err)
				return nil
			}
			removed = append(removed, key)
			errs = append(errs, f.markPruned(ctx, src.source, key))
			return nil
		})
		if err != nil && !errors.Is(err, os.ErrNotExist) {
			errs = append(errs, err)
		}
	}
	return removed, errors.Join(errs...)
}

func (f *Fetcher) markPruned(ctx context.Context, source, key string) error {
	rec, ok, err := f.get(ctx, source, key)
	if err != nil || !ok {
		return err
	}
	rec.State, rec.Error = StatePruned, ""
	return f.put(ctx, rec)
}
