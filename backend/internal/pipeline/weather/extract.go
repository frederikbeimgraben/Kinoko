package weather

import (
	"context"
	"errors"
	"fmt"
	"os"
	"path/filepath"
	"slices"
	"strings"
	"sync"
	"time"

	"github.com/frederikbeimgraben/kinoko/backend/internal/pipeline/core/calendar"
	"github.com/frederikbeimgraben/kinoko/backend/internal/pipeline/core/geo"
	"github.com/frederikbeimgraben/kinoko/backend/internal/pipeline/pio"
	"github.com/frederikbeimgraben/kinoko/backend/internal/pipeline/weather/dwd"
)

// Logger takes progress lines. *log.Logger satisfies it.
type Logger interface {
	Printf(format string, v ...any)
}

// ExtractConfig configures Extract. RawDir is the DWD cache (PILZE_DATA/cache/dwd)
// with hyras/<folder>/ and soil_moisture/<tree>/. CheckpointDir gets weekly/<name>.parquet.
type ExtractConfig struct {
	Start, End    int
	RefreshFrom   *int // recompute only from this ISO year; keep the older rows of each checkpoint
	RawDir        string
	CheckpointDir string
	Workers       int            // checkpoints computed at the same time; 1 when 0
	SoilTransform PointTransform // GDALTransform(SoilEPSG, ModelEPSG) when nil
	Jobs          []Job          // Jobs when nil
}

// Extract writes the weekly checkpoint of each job. A checkpoint that exists is kept when RefreshFrom is nil.
// One worker holds about one year of daily cell means and its output rows.
func Extract(ctx context.Context, cfg ExtractConfig, log Logger) error {
	if log == nil {
		log = nopLogger{}
	}
	g, err := buildGrid(cfg, log)
	if err != nil {
		return err
	}
	if err := os.MkdirAll(cfg.CheckpointDir, 0o755); err != nil {
		return fmt.Errorf("weather: %w", err)
	}
	names := cellNames(g.cells)
	jobs := cfg.Jobs
	if jobs == nil {
		jobs = Jobs
	}
	sem := make(chan struct{}, max(cfg.Workers, 1))
	errs := make([]error, len(jobs))
	var wg sync.WaitGroup
	for i, job := range jobs {
		wg.Add(1)
		sem <- struct{}{}
		go func() {
			defer func() { <-sem; wg.Done() }()
			errs[i] = runJob(ctx, cfg, g, names, job, log)
		}()
	}
	wg.Wait()
	return errors.Join(errs...)
}

type nopLogger struct{}

func (nopLogger) Printf(string, ...any) {}

// buildGrid defines the model cells from the land mask of the precipitation
// file of the year Start (build_cell_index). Without that file it takes the
// first later year, so that a pruned cache can still refresh.
func buildGrid(cfg ExtractConfig, log Logger) (*grid, error) {
	dir := filepath.Join(cfg.RawDir, referenceDir)
	ref := ""
	for y := cfg.Start; y <= cfg.End && ref == ""; y++ {
		ref = YearFile(dir, y)
	}
	if ref == "" {
		return nil, fmt.Errorf("weather: no precipitation file for %d..%d in %s", cfg.Start, cfg.End, dir)
	}
	f, err := pio.OpenNC(ref)
	if err != nil {
		return nil, err
	}
	defer func() { _ = f.Close() }()
	x, y, _, err := f.Coords()
	if err != nil {
		return nil, err
	}
	first := make([]float32, len(x)*len(y))
	if err := f.ReadDays("pr", 0, 1, first); err != nil {
		return nil, err
	}
	keys, valid, err := pixelCells(x, y, nil)
	if err != nil {
		return nil, err
	}
	land := make([]bool, len(first))
	for i, v := range first {
		land[i] = !isNaN32(v) && v-v == 0
	}
	cells := landCells(keys, valid, land)
	log.Printf("model cells over land: %d (from %s)", len(cells), filepath.Base(ref))
	tr := cfg.SoilTransform
	if tr == nil {
		tr = lazyTransform(SoilEPSG, ModelEPSG)
	}
	return &grid{cells: cells, lookup: indexOf(cells), soil: tr, maps: map[uint64][]int32{}}, nil
}

// lazyTransform opens PROJ only when a soil file needs it.
func lazyTransform(src, dst int) PointTransform {
	var once sync.Once
	var tr PointTransform
	var err error
	return func(x, y []float64) ([]float64, []float64, error) {
		once.Do(func() { tr, err = GDALTransform(src, dst) })
		if err != nil {
			return nil, nil, err
		}
		return tr(x, y)
	}
}

func cellNames(cells []geo.CellKey) []string {
	out := make([]string, len(cells))
	for i, c := range cells {
		out[i] = c.String()
	}
	return out
}

// YearFile returns the file of year in dir (pattern *_<year>_*.nc) with the newest
// version, or "".
func YearFile(dir string, year int) string {
	found, _ := filepath.Glob(filepath.Join(dir, fmt.Sprintf("*_%d_*.nc", year)))
	if len(found) == 0 {
		return ""
	}
	slices.SortStableFunc(found, func(a, b string) int {
		ka, kb := dwd.VersionKey(filepath.Base(a)), dwd.VersionKey(filepath.Base(b))
		if ka != kb {
			if ka[0] != kb[0] {
				return ka[0] - kb[0]
			}
			return ka[1] - kb[1]
		}
		return strings.Compare(a, b)
	})
	return found[len(found)-1]
}

func runJob(ctx context.Context, cfg ExtractConfig, g *grid, names []string, job Job, log Logger) error {
	path := CheckpointPath(cfg.CheckpointDir, job.Name)
	_, statErr := os.Stat(path)
	exists := statErr == nil
	if exists && cfg.RefreshFrom == nil {
		log.Printf("%s: from cache", job.Name)
		return nil
	}
	dir := filepath.Join(cfg.RawDir, filepath.FromSlash(job.Dir))
	var old rows
	from := cfg.Start
	keepOld := func(calendar.Week) bool { return false }
	if exists {
		from = max(cfg.Start, *cfg.RefreshFrom-1)
		keepOld = refreshCut(*cfg.RefreshFrom, from, firstFileYear(dir, from, cfg.End))
		var err error
		if old, err = readCheckpoint(path, job.Name, keepOld); err != nil {
			return err
		}
	}
	var measure DayMeasure
	if job.Measure != nil {
		measure = job.Measure()
	}
	acc := newWeekly(job.How, len(g.cells))
	files := 0
	for year := from; year <= cfg.End; year++ {
		if err := ctx.Err(); err != nil {
			return err
		}
		file := YearFile(dir, year)
		if file == "" {
			continue
		}
		daily, days, err := g.dailyCellMeans(file, job.Var, job.Soil)
		if err != nil {
			return err
		}
		if measure != nil {
			daily = measure(daily, len(g.cells))
		}
		acc.addFile(daily, days)
		files++
	}
	if files == 0 {
		log.Printf("%s: no files, skipped", job.Name)
		return nil
	}
	out := old
	oldWeeks := map[calendar.Week]bool{}
	for _, w := range old.weeks {
		oldWeeks[w] = true
	}
	fresh := toRows(acc.result(), names, func(w calendar.Week) bool { return !keepOld(w) || !oldWeeks[w] })
	out.weeks, out.cells, out.vals = append(out.weeks, fresh.weeks...), append(out.cells, fresh.cells...), append(out.vals, fresh.vals...)
	if err := writeCheckpoint(path, job.Name, out.sorted()); err != nil {
		return err
	}
	log.Printf("%s: %d old plus %d new cell-weeks", job.Name, len(old.vals), len(fresh.vals))
	return nil
}

// refreshWarmUp is the span after the first raw file of a refresh in which
// the old rows stay: the cross-year week and the 60-day days_since_rain counter.
const refreshWarmUp = 9 * 7

// refreshCut tells which old weeks a refresh from the ISO year rf keeps. It
// keeps a week that ends before Jan 1 of rf: each later week starts on or
// after Dec 26 of rf-1, so the files from rf-1 cover it.
func refreshCut(rf, from, first int) func(calendar.Week) bool {
	cut := time.Date(rf, time.January, 1, 0, 0, 0, 0, time.UTC)
	if first > from {
		// Without the file of from, the first weeks of a later file are incomplete.
		if warm := time.Date(first, time.January, 1, 0, 0, 0, 0, time.UTC).AddDate(0, 0, refreshWarmUp); warm.After(cut) {
			cut = warm
		}
	}
	return func(w calendar.Week) bool { return w.Day(7).Before(cut) }
}

// firstFileYear gives the first year in from..end with a file in dir, or 0.
func firstFileYear(dir string, from, end int) int {
	for year := from; year <= end; year++ {
		if YearFile(dir, year) != "" {
			return year
		}
	}
	return 0
}

// toRows gives the weeks that keep accepts in long form, each week with every cell.
func toRows(weeks map[calendar.Week][]float32, names []string, keep func(calendar.Week) bool) rows {
	var out rows
	for _, w := range sortedWeeks(weeks) {
		if !keep(w) {
			continue
		}
		for c, v := range weeks[w] {
			out.add(w, names[c], v)
		}
	}
	return out
}

func sortedWeeks[T any](m map[calendar.Week]T) []calendar.Week {
	out := make([]calendar.Week, 0, len(m))
	for w := range m {
		out = append(out, w)
	}
	slices.SortFunc(out, func(a, b calendar.Week) int { return a.ID() - b.ID() })
	return out
}
