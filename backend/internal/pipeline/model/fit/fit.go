package fit

import (
	"context"
	"errors"
	"fmt"
	"time"

	"github.com/frederikbeimgraben/kinoko/backend/internal/pipeline/model/bundle"
	"github.com/frederikbeimgraben/kinoko/backend/internal/pipeline/model/train"
)

// ErrNoFolds tells that the year scheme or the space scheme gives no fold.
var ErrNoFolds = errors.New("fit: no blocked fold with enough rows and positives")

// HorizonReport is the training report of one horizon.
type HorizonReport struct {
	Horizon    int
	Candidates []CandidateScore
	Features   []string
	Settings   []SettingScore
	Setting    string
	Ceiling    float64
	OOF        OOF
}

// Report describes a training run.
type Report struct {
	Table      TableStats
	YearFolds  int
	SpaceFolds int
	FindsPath  string
	Horizons   []HorizonReport
}

// TrainSpecies builds the visit table and trains a calibrated model for each horizon of cfg.
// The caller owns the bundle: save it with Save and free it with Close.
func TrainSpecies(ctx context.Context, in Inputs, cfg Config) (*bundle.Bundle, Report, error) {
	cfg = cfg.withDefaults()
	t, stats, err := BuildTable(ctx, in, cfg)
	report := Report{Table: stats}
	if err != nil {
		return nil, report, err
	}
	cfg.Log("visits with weather: %d   positive: %d", t.N, countPositives(t.Label))
	return Train(ctx, t, cfg, report)
}

// Train ranks the features, tunes the settings, calibrates and trains the final model on a prepared visit table.
func Train(ctx context.Context, t *Table, cfg Config, report Report) (*bundle.Bundle, Report, error) {
	cfg = cfg.withDefaults()
	f := folds{
		year:  train.BlockedFolds(train.YearKeys(t.ISOYear), t.Label),
		space: train.BlockedFolds(train.SpaceKeys(t.X), t.Label),
	}
	report.YearFolds, report.SpaceFolds = len(f.year), len(f.space)
	if len(f.year) == 0 || len(f.space) == 0 {
		return nil, report, fmt.Errorf("%w: %d year folds, %d space folds", ErrNoFolds, len(f.year), len(f.space))
	}
	if cfg.FindsDir != "" {
		path, err := WriteFinds(cfg.FindsDir, cfg.Slug, t)
		if err != nil {
			return nil, report, err
		}
		report.FindsPath = path
	}
	b := &bundle.Bundle{
		Format: bundle.Format, Label: cfg.Label, Species: cfg.Species, Slug: cfg.Slug,
		Horizons: map[int]*bundle.Horizon{}, Prior: train.PriorTables(t.PriorRows(), allRows(t.N)),
		TrainedAt: cfg.Now().UTC().Format(time.RFC3339), Visits: t.N, Positives: countPositives(t.Label),
	}
	tr := newTrainer(ctx, t, cfg.Log)
	for _, h := range cfg.Horizons {
		hz, hr, err := tr.horizon(h, cfg.Grid, f)
		if err != nil {
			b.Close()
			return nil, report, fmt.Errorf("fit: horizon %d: %w", h, err)
		}
		b.Horizons[h] = hz
		report.Horizons = append(report.Horizons, hr)
	}
	return b, report, nil
}

// horizon prunes, tunes, calibrates out of fold and fits the final model of horizon h.
func (tr *trainer) horizon(h int, grid []train.Setting, f folds) (*bundle.Horizon, HorizonReport, error) {
	hr := HorizonReport{Horizon: h}
	features, err := FeatureList(tr.t.Blocks, tr.t, h)
	if err != nil {
		return nil, hr, err
	}
	tr.logf("horizon %d weeks: %d candidate features", h, len(features))
	hr.Features, hr.Candidates, err = tr.prune(features, grid[0], f)
	if err != nil {
		return nil, hr, err
	}
	tr.logf("chosen: %d features", len(hr.Features))
	setting, scores, err := tr.tune(hr.Features, grid, f)
	if err != nil {
		return nil, hr, err
	}
	hr.Setting, hr.Settings = setting.Name, scores
	if hr.OOF, err = tr.outOfFold(hr.Features, setting, f.year); err != nil {
		return nil, hr, err
	}
	s := hr.OOF.Scores
	tr.logf("Brier score   raw %.5f   calibrated %.5f   AUC %.4f", s.BrierRaw, s.BrierCalibrated, s.AUC)
	c, err := tr.final(hr.Features, setting)
	if err != nil {
		return nil, hr, err
	}
	hz := c.horizon
	hz.Metrics = &bundle.Metrics{BrierRaw: s.BrierRaw, BrierCalibrated: s.BrierCalibrated, AUCOOF: s.AUC}
	hr.Ceiling = hz.Ceiling
	tr.logf("calibration ceiling from the top calibration visits: %.3f", hz.Ceiling)
	return &hz, hr, nil
}

func countPositives(label []int8) int {
	n := 0
	for _, y := range label {
		n += int(y)
	}
	return n
}
