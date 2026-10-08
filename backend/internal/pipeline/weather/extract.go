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

// Extract writes the weekly checkpoint of each job, as extract_grids.py does
// without --cells-from. A checkpoint that exists is kept when RefreshFrom is nil.
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
// version, or "". extract_grids.py takes the last name in text order; for one version per year that is the same file.
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
	var old rows
	from := cfg.Start
	if exists {
		rf := *cfg.RefreshFrom
		var err error
		if old, err = readCheckpoint(path, job.Name, func(w calendar.Week) bool { return w.Year < rf }); err != nil {
			return err
		}
		// An ISO week can span the turn of the year, so the refresh starts one year early and keeps none of it.
		from = max(cfg.Start, rf-1)
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
		file := YearFile(filepath.Join(cfg.RawDir, filepath.FromSlash(job.Dir)), year)
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
	fresh := toRows(acc.result(), names, func(w calendar.Week) bool { return !exists || w.Year >= *cfg.RefreshFrom })
	out.weeks, out.cells, out.vals = append(out.weeks, fresh.weeks...), append(out.cells, fresh.cells...), append(out.vals, fresh.vals...)
	if err := writeCheckpoint(path, job.Name, out.sorted()); err != nil {
		return err
	}
	log.Printf("%s: %d old plus %d new cell-weeks", job.Name, len(old.vals), len(fresh.vals))
	return nil
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
