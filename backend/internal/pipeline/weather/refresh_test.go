package weather

import (
	"context"
	"os"
	"path/filepath"
	"slices"
	"strconv"
	"strings"
	"testing"
)

// copyYear copies the raw files of year from src to a new folder.
func copyYear(t *testing.T, src string, year int) string {
	t.Helper()
	all := t.TempDir()
	copyTree(t, src, all)
	err := filepath.Walk(all, func(p string, info os.FileInfo, err error) error {
		if err != nil || info.IsDir() || strings.Contains(info.Name(), "_"+strconv.Itoa(year)+"_") {
			return err
		}
		return os.Remove(p)
	})
	if err != nil {
		t.Fatal(err)
	}
	return all
}

// TestExtractRefreshReplacesPartialCrossYearWeek checks that a refresh from
// 2021 recomputes 2020-W53, which a run with only the 2020 file cut short.
func TestExtractRefreshReplacesPartialCrossYearWeek(t *testing.T) {
	g := loadExtractGolden(t)
	out := t.TempDir()
	extract(t, copyYear(t, "testdata/raw", 2020), out, nil)
	year := 2021
	extract(t, "testdata/raw", out, &year)
	for _, job := range Jobs {
		compareRows(t, job.Name, readRows(t, out, job.Name), goldenRows(g.Fixed[job.Name]), nil)
	}
}

// TestExtractRefreshWithoutPreviousYearKeepsWarmUp checks that a refresh
// without the file of the year before keeps the complete old rows.
func TestExtractRefreshWithoutPreviousYearKeepsWarmUp(t *testing.T) {
	jobs := append(slices.Clone(Jobs), Job{Name: "day_count", Dir: referenceDir, Var: "pr", How: Last,
		Measure: func() DayMeasure { return dayCount() }})
	run := func(raw, out string, refresh *int) {
		cfg := ExtractConfig{Start: 2020, End: 2021, RefreshFrom: refresh, RawDir: raw, CheckpointDir: out, Jobs: jobs}
		if err := Extract(context.Background(), cfg, nil); err != nil {
			t.Fatal(err)
		}
	}
	out := t.TempDir()
	run("testdata/raw", out, nil)
	want := map[string][]weekRow{}
	for _, job := range jobs {
		want[job.Name] = readRows(t, out, job.Name)
	}
	year := 2021
	run(copyYear(t, "testdata/raw", 2021), out, &year)
	for _, job := range jobs {
		compareRows(t, job.Name, knownCells(readRows(t, out, job.Name), want[job.Name]), want[job.Name], nil)
	}
}

// dayCount counts the days of each cell. Like days_since_rain, its value
// depends on the days of the year before.
func dayCount() DayMeasure {
	var n float32
	return func(daily []float32, nCells int) []float32 {
		out := make([]float32, len(daily))
		for i := range out {
			if i%nCells == 0 {
				n++
			}
			out[i] = n
		}
		return out
	}
}

// knownCells drops the rows of cells that want does not have. The 2021 file
// alone gives one more land cell than the 2020 file.
func knownCells(got, want []weekRow) []weekRow {
	cells := map[string]bool{}
	for _, r := range want {
		cells[r.key.cell] = true
	}
	return slices.DeleteFunc(got, func(r weekRow) bool { return !cells[r.key.cell] })
}
