package runner

import (
	"context"
	"math"
	"os"
	"path/filepath"
	"strconv"

	"github.com/frederikbeimgraben/kinoko/backend/internal/fn"
	"github.com/frederikbeimgraben/kinoko/backend/internal/modules/sources"
	"github.com/frederikbeimgraben/kinoko/backend/internal/pipeline/model/bundle"
	"github.com/frederikbeimgraben/kinoko/backend/internal/pipeline/model/fit"
)

// Artifact names of the active grids.
const (
	artTreesGrid  = "trees_de_500m"
	artTreeScales = "tree_scales"
	artSiteGrid   = "site_500m"
	artBundle     = "bundle"
)

// treeScales reads the tree scales of the active tree-scales version once per run.
func (c *Chain) treeScales(j *Job) (fit.TreeScales, error) {
	if j.trees != nil {
		return *j.trees, nil
	}
	path, err := c.Sources.Resolver().Path(sources.KindTreeScales, artTreeScales)
	if err != nil {
		return fit.TreeScales{}, err
	}
	ts, err := fit.ReadTreeScales(path)
	if err != nil {
		return fit.TreeScales{}, err
	}
	j.trees = &ts
	return ts, nil
}

// h0Brier gives the calibrated out-of-fold Brier score of horizon 0. The
// run reports this score and not the last horizon (finding 7 of the plan).
func h0Brier(report fit.Report) *float64 {
	hr, ok := fn.Find(report.Horizons, func(h fit.HorizonReport) bool { return h.Horizon == 0 })
	if !ok {
		return nil
	}
	s := hr.OOF.Scores.BrierCalibrated
	if math.IsNaN(s) || math.IsInf(s, 0) {
		return nil
	}
	return &s
}

// Train trains the model of one species, saves the bundle and installs it as
// the new active model-bundle version of the species (origin training).
// It always trains, also when a model exists (finding 6 of the plan).
func (c *Chain) Train(ctx context.Context, j *Job, sp Species) (Trained, error) {
	if j.Records == nil {
		return Trained{}, errNoRecords
	}
	trees, err := c.treeScales(j)
	if err != nil {
		return Trained{}, err
	}
	cfg := c.Fit
	cfg.Label, cfg.Slug, cfg.Species = sp.Chain.Key, sp.Slug, sp.Chain.Taxa
	cfg.FindsDir = filepath.Join(c.Maps, "funde")
	cfg.Now, cfg.Log = c.now, j.Printf
	in := fit.Inputs{Records: j.Records, Weather: fit.CheckpointWeather{Dir: c.weeklyDir()}, TreeScales: trees}
	b, report, err := fit.TrainSpecies(ctx, in, cfg)
	if err != nil {
		return Trained{Records: report.Table.WithWeather}, err
	}
	defer b.Close()
	staging := filepath.Join(c.Data, "tmp", "run-"+j.Run.ID.String(), sp.Slug)
	if err := os.RemoveAll(staging); err != nil {
		return Trained{}, err
	}
	// A failed removal leaves only temporary files, so the step does not fail.
	defer func() { _ = os.RemoveAll(filepath.Dir(staging)) }()
	if err := b.Save(staging); err != nil {
		return Trained{}, err
	}
	brier := h0Brier(report)
	v, err := c.Sources.Install(ctx, sources.Install{
		Kind: sources.KindModelBundle, SpeciesID: &sp.ID, Origin: sources.OriginTraining, From: staging,
		Metadata: modelMetadata(j, b, brier), Artifact: artBundle, Activate: true,
	})
	if err != nil {
		return Trained{}, err
	}
	j.Printf("%s: model version %d, %d visits with weather, h0 Brier %v", sp.Slug, v.Number, report.Table.WithWeather, fn.Deref(brier, math.NaN()))
	return Trained{Records: report.Table.WithWeather, Brier: brier, VersionID: v.ID}, nil
}

// modelMetadata is the report of a trained version: the run, the counts and the scores of each horizon.
func modelMetadata(j *Job, b *bundle.Bundle, brier *float64) map[string]any {
	scores := map[string]any{}
	for _, h := range b.HorizonKeys() {
		if m := b.Horizons[h].Metrics; m != nil {
			scores["h"+strconv.Itoa(h)] = *m
		}
	}
	return map[string]any{
		"runId": j.Run.ID.String(), "visits": b.Visits, "positives": b.Positives,
		"brier": brier, "horizons": scores, "trainedAt": b.TrainedAt,
	}
}
