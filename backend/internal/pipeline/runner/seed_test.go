package runner_test

import (
	"context"
	"io/fs"
	"os"
	"path/filepath"
	"slices"
	"testing"
	"time"

	"github.com/frederikbeimgraben/kinoko/backend/internal/core/db"
	"github.com/frederikbeimgraben/kinoko/backend/internal/modules/sources"
	"github.com/frederikbeimgraben/kinoko/backend/internal/pipeline/pio"
	"github.com/frederikbeimgraben/kinoko/backend/internal/pipeline/runner"
	"github.com/frederikbeimgraben/kinoko/backend/internal/pipeline/weather"
	"github.com/frederikbeimgraben/kinoko/backend/internal/pipeline/weather/dwd"
)

// TestSeededCheckpointsTakeTheRawFilesOfTheCache checks that a raw file
// fetched before the seed of the checkpoints is still extracted.
func TestSeededCheckpointsTakeTheRawFilesOfTheCache(t *testing.T) {
	f := newFixture(t, 1)
	ctx := context.Background()
	staging := filepath.Join(f.data, "staging-"+db.NewID().String())
	writeWeekly(t, filepath.Join(staging, "weekly"))
	v, err := f.sources.Install(ctx, sources.Install{Kind: sources.KindWeatherCheckpoints, Origin: sources.OriginUpload,
		From: staging, Artifact: "folder", Activate: true})
	if err != nil {
		t.Fatal(err)
	}
	for _, job := range weather.Jobs {
		rel, err := filepath.Rel(f.data, weather.CheckpointPath(filepath.Join(v.Dir, "weekly"), job.Name))
		if err != nil {
			t.Fatal(err)
		}
		f.exec("INSERT INTO data_source_artifact (version_id, name, path, size_bytes) VALUES (?, ?, ?, 0)",
			v.ID, "weekly/"+job.Name, filepath.ToSlash(rel))
	}
	raw := filepath.Join(f.data, "cache", "dwd")
	copyDir(t, "../weather/testdata/raw", raw)
	fetched := time.Now().Add(-time.Hour)
	err = dwd.SQLStore{DB: f.env.DB}.Put(ctx, dwd.CacheRecord{Source: dwd.SourceHyras,
		Key: "dwd/hyras/precipitation/pr_hyras_1_2021_v6-0_de.nc", State: dwd.StateOK, FetchedAt: fetched, CheckedAt: fetched})
	if err != nil {
		t.Fatal(err)
	}
	chain := &runner.Chain{DB: f.env.DB, Sources: f.sources, Data: f.data}
	if err := chain.Weather(ctx, &runner.Job{Now: time.Now()}); err != nil {
		t.Fatal(err)
	}
	tab, err := pio.ReadParquet(weather.CheckpointPath(filepath.Join(f.data, "interim", "weekly"), "pr"), nil)
	if err != nil {
		t.Fatal(err)
	}
	if !slices.Contains(tab.I64["iso_year"], 2021) {
		t.Errorf("the checkpoint pr has no week of the raw file of 2021: years %v", slices.Compact(tab.I64["iso_year"]))
	}
}

// copyDir copies the files of src to dst.
func copyDir(t *testing.T, src, dst string) {
	t.Helper()
	err := filepath.WalkDir(src, func(p string, d fs.DirEntry, err error) error {
		if err != nil || d.IsDir() {
			return err
		}
		rel, err := filepath.Rel(src, p)
		if err != nil {
			return err
		}
		data, err := os.ReadFile(p)
		if err != nil {
			return err
		}
		target := filepath.Join(dst, rel)
		if err := os.MkdirAll(filepath.Dir(target), 0o755); err != nil {
			return err
		}
		return os.WriteFile(target, data, 0o644)
	})
	if err != nil {
		t.Fatal(err)
	}
}
