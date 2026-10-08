package runner

import (
	"context"
	"encoding/json"
	"errors"
	"math"
	"os"
	"path/filepath"
	"slices"
	"strconv"

	"github.com/frederikbeimgraben/kinoko/backend/internal/fn"
	"github.com/frederikbeimgraben/kinoko/backend/internal/modules/sources"
	"github.com/frederikbeimgraben/kinoko/backend/internal/pipeline/core/horizons"
	"github.com/frederikbeimgraben/kinoko/backend/internal/pipeline/model/bundle"
	"github.com/frederikbeimgraben/kinoko/backend/internal/pipeline/model/fit"
	"github.com/frederikbeimgraben/kinoko/backend/internal/pipeline/weather"
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

// bundleDir gives the folder of the active model of a species.
func (c *Chain) bundleDir(sp Species) (string, error) {
	v, err := c.Sources.Resolver().Active(sources.KindModelBundle, sp.ID.String())
	if err != nil {
		return "", err
	}
	if a, ok := v.Artifact(artBundle); ok {
		return a.Path, nil
	}
	return v.Dir, nil
}

// horizonKeys reads the horizons of a bundle from bundle.json without the models.
func horizonKeys(dir string) ([]int, error) {
	data, err := os.ReadFile(filepath.Join(dir, bundle.FileName))
	if err != nil {
		return nil, err
	}
	var head struct {
		Horizons map[int]json.RawMessage `json:"horizons"`
	}
	if err := json.Unmarshal(data, &head); err != nil {
		return nil, err
	}
	keys := make([]int, 0, len(head.Horizons))
	for h := range head.Horizons {
		keys = append(keys, h)
	}
	slices.Sort(keys)
	return keys, nil
}

// sharedHorizon gives the forecast cap of the run: the shared horizon of the
// active models of the run species. A species without a model does not count.
func (c *Chain) sharedHorizon(j *Job) (int, error) {
	if j.shared != nil {
		return *j.shared, nil
	}
	var sets [][]int
	for _, sp := range j.Species {
		dir, err := c.bundleDir(sp)
		if errors.Is(err, sources.ErrMissing) {
			continue
		}
		if err != nil {
			return 0, err
		}
		keys, err := horizonKeys(dir)
		if err != nil {
			return 0, err
		}
		sets = append(sets, keys)
	}
	shared := horizons.SharedHorizon(sets)
	j.shared = &shared
	return shared, nil
}

// assets resolves the active grids of the render.
func (c *Chain) assets() (Assets, error) {
	resolve := c.Sources.Resolver()
	trees, err := resolve.Path(sources.KindTreesGrid, artTreesGrid)
	if err != nil {
		return Assets{}, err
	}
	scales, err := resolve.Path(sources.KindTreeScales, artTreeScales)
	if err != nil {
		return Assets{}, err
	}
	site, err := resolve.Path(sources.KindSiteGrid, artSiteGrid)
	if err != nil {
		return Assets{}, err
	}
	return Assets{TreesGrid: trees, TreeScales: scales, SiteGrid: site}, nil
}

// weatherCube reads all weekly checkpoints once per run.
func (c *Chain) weatherCube(j *Job) (*weather.Cube, error) {
	if j.cube != nil {
		return j.cube, nil
	}
	cube, err := weather.LoadCube(c.weeklyDir(), nil)
	if err != nil {
		return nil, err
	}
	j.cube = cube
	return cube, nil
}

// RenderSpecies draws the map of one species with its active model.
func (c *Chain) RenderSpecies(ctx context.Context, j *Job, sp Species) error {
	if c.Renderer == nil {
		return ErrNoRenderer
	}
	dir, err := c.bundleDir(sp)
	if err != nil {
		return err
	}
	shared, err := c.sharedHorizon(j)
	if err != nil {
		return err
	}
	assets, err := c.assets()
	if err != nil {
		return err
	}
	cube, err := c.weatherCube(j)
	if err != nil {
		return err
	}
	b, err := bundle.Load(dir)
	if err != nil {
		return err
	}
	defer b.Close()
	return c.Renderer.RenderSpecies(ctx, SpeciesRender{
		Slug: sp.Slug, ChainKey: sp.Chain.Key, Bundle: b, MinForest: sp.Chain.MinForest, SharedHorizon: shared,
		Cube: cube, Records: j.Records, Assets: assets, Maps: c.Maps, Today: j.Now, Log: j.Printf,
	})
}

// RenderLayers draws the weekly input layers.
func (c *Chain) RenderLayers(ctx context.Context, j *Job) error {
	if c.Renderer == nil {
		return ErrNoRenderer
	}
	assets, err := c.assets()
	if err != nil {
		return err
	}
	cube, err := c.weatherCube(j)
	if err != nil {
		return err
	}
	return c.Renderer.RenderLayers(ctx, LayersRender{Cube: cube, Assets: assets, Maps: c.Maps, Log: j.Printf})
}
