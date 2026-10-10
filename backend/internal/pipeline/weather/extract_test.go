package weather

import (
	"context"
	"encoding/json"
	"fmt"
	"io"
	"math"
	"os"
	"path/filepath"
	"testing"

	"github.com/frederikbeimgraben/kinoko/backend/internal/pipeline/pio"
)

// extractGolden is the golden file testdata/extract.json. main and refreshMain are the checkpoints of a full
// run and of a refresh from 2021. fixed and refreshFixed are the weekly values over the days of both files,
// with NaN for a sum without a value (findings 8 and 9).
type extractGolden struct {
	Main         map[string][][4]any `json:"main"`
	Fixed        map[string][][4]any `json:"fixed"`
	RefreshMain  map[string][][4]any `json:"refreshMain"`
	RefreshFixed map[string][][4]any `json:"refreshFixed"`
}

type cellWeek struct {
	year, week int
	cell       string
}

type weekRow struct {
	key cellWeek
	val float64
}

func goldenRows(raw [][4]any) []weekRow {
	out := make([]weekRow, len(raw))
	for i, r := range raw {
		v := math.NaN()
		if r[3] != nil {
			v = r[3].(float64)
		}
		out[i] = weekRow{cellWeek{int(r[0].(float64)), int(r[1].(float64)), r[2].(string)}, v}
	}
	return out
}

func readRows(t *testing.T, dir, name string) []weekRow {
	t.Helper()
	tab, err := pio.ReadParquet(CheckpointPath(dir, name), nil)
	if err != nil {
		t.Fatal(err)
	}
	out := make([]weekRow, tab.N)
	for i := range out {
		out[i] = weekRow{cellWeek{int(tab.I64["iso_year"][i]), int(tab.I64["iso_week"][i]), tab.Str["cell"][i]},
			float64(tab.F32[name][i])}
	}
	return out
}

func loadExtractGolden(t *testing.T) extractGolden {
	t.Helper()
	var g extractGolden
	readJSON(t, "testdata/extract.json", &g)
	return g
}

func readJSON(t *testing.T, path string, v any) {
	t.Helper()
	b, err := os.ReadFile(path)
	if err != nil {
		t.Fatal(err)
	}
	if err := json.Unmarshal(b, v); err != nil {
		t.Fatal(err)
	}
}

func close32(a, b float64) bool {
	if math.IsNaN(a) || math.IsNaN(b) {
		return math.IsNaN(a) && math.IsNaN(b)
	}
	return math.Abs(a-b) <= 1e-5*math.Max(1, math.Abs(b))
}

// compareRows checks got against want row by row. skip names rows that may differ.
func compareRows(t *testing.T, label string, got, want []weekRow, skip func(weekRow) bool) {
	t.Helper()
	if len(got) != len(want) {
		t.Fatalf("%s: %d rows, want %d", label, len(got), len(want))
	}
	for i := range want {
		if got[i].key != want[i].key {
			t.Fatalf("%s: row %d is %v, want %v", label, i, got[i].key, want[i].key)
		}
		if skip != nil && skip(want[i]) {
			continue
		}
		if !close32(got[i].val, want[i].val) {
			t.Errorf("%s: %v = %v, want %v", label, want[i].key, got[i].val, want[i].val)
		}
	}
}

func extract(t *testing.T, raw, out string, refresh *int) {
	t.Helper()
	cfg := ExtractConfig{Start: 2020, End: 2021, RefreshFrom: refresh, RawDir: raw, CheckpointDir: out, Workers: 3}
	if err := Extract(context.Background(), cfg, nil); err != nil {
		t.Fatal(err)
	}
}

func TestExtractMatchesGolden(t *testing.T) {
	g := loadExtractGolden(t)
	out := t.TempDir()
	extract(t, "testdata/raw", out, nil)
	for _, job := range Jobs {
		got := readRows(t, out, job.Name)
		fixed := goldenRows(g.Fixed[job.Name])
		compareRows(t, job.Name+" (fixed)", got, fixed, nil)
		// The golden main run differs only where findings 8 and 9 apply.
		main := goldenRows(g.Main[job.Name])
		compareRows(t, job.Name+" (main)", got, main, func(r weekRow) bool {
			straddle := r.key.year == 2020 && r.key.week == 53 && job.How == Mean
			emptySum := job.How == Sum && r.val == 0 && math.IsNaN(valueOf(fixed, r.key))
			return straddle || emptySum
		})
	}
}

func valueOf(rows []weekRow, k cellWeek) float64 {
	for _, r := range rows {
		if r.key == k {
			return r.val
		}
	}
	return math.NaN()
}

func TestExtractRefresh(t *testing.T) {
	g := loadExtractGolden(t)
	out := t.TempDir()
	extract(t, "testdata/raw", out, nil)
	raw := t.TempDir()
	copyTree(t, "testdata/raw", raw)
	copyTree(t, "testdata/raw2", raw)
	year := 2021
	extract(t, raw, out, &year)
	full := t.TempDir()
	extract(t, raw, full, nil)
	for _, job := range Jobs {
		got := readRows(t, out, job.Name)
		// The golden refresh keeps the old 2020-W53, although it holds days of 2021; the refresh here computes it again.
		straddle := func(r weekRow) bool { return r.key.year == 2020 && r.key.week == 53 }
		compareRows(t, job.Name, got, goldenRows(g.RefreshFixed[job.Name]), straddle)
		compareRows(t, job.Name+" (full)", got, readRows(t, full, job.Name), nil)
	}
}

func TestExtractKeepsCheckpointWithoutRefresh(t *testing.T) {
	out := t.TempDir()
	path := CheckpointPath(out, "pr")
	if err := os.WriteFile(path, []byte("keep"), 0o644); err != nil {
		t.Fatal(err)
	}
	cfg := ExtractConfig{Start: 2020, End: 2021, RawDir: "testdata/raw", CheckpointDir: out, Jobs: Jobs[:1]}
	if err := Extract(context.Background(), cfg, nil); err != nil {
		t.Fatal(err)
	}
	if b, _ := os.ReadFile(path); string(b) != "keep" {
		t.Errorf("checkpoint was written again")
	}
}

func TestExtractWithoutReferenceFails(t *testing.T) {
	cfg := ExtractConfig{Start: 2020, End: 2021, RawDir: t.TempDir(), CheckpointDir: t.TempDir()}
	if err := Extract(context.Background(), cfg, nil); err == nil {
		t.Error("no error without a precipitation file")
	}
}

func TestYearFileTakesNewestVersion(t *testing.T) {
	dir := t.TempDir()
	for _, n := range []string{"pr_hyras_1_2024_v6-0_de.nc", "pr_hyras_1_2024_v10-0_de.nc",
		"pr_hyras_1_2024_v6-1_de.nc", "pr_hyras_1_2025_v6-0_de.nc.partial"} {
		if err := os.WriteFile(filepath.Join(dir, n), nil, 0o644); err != nil {
			t.Fatal(err)
		}
	}
	if got := filepath.Base(YearFile(dir, 2024)); got != "pr_hyras_1_2024_v10-0_de.nc" {
		t.Errorf("got %s", got)
	}
	if got := YearFile(dir, 2025); got != "" {
		t.Errorf("a partial file counts: %s", got)
	}
}

func copyTree(t *testing.T, src, dst string) {
	t.Helper()
	err := filepath.Walk(src, func(p string, info os.FileInfo, err error) error {
		if err != nil {
			return err
		}
		rel, _ := filepath.Rel(src, p)
		target := filepath.Join(dst, rel)
		if info.IsDir() {
			return os.MkdirAll(target, 0o755)
		}
		in, err := os.Open(p)
		if err != nil {
			return err
		}
		defer func() { _ = in.Close() }()
		out, err := os.Create(target)
		if err != nil {
			return err
		}
		if _, err := io.Copy(out, in); err != nil {
			return fmt.Errorf("copy %s: %w", p, err)
		}
		return out.Close()
	})
	if err != nil {
		t.Fatal(err)
	}
}
