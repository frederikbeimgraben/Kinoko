package runner

import (
	"context"
	"encoding/json"
	"errors"
	"os"
	"path/filepath"
	"slices"

	"github.com/frederikbeimgraben/kinoko/backend/internal/modules/sources"
	"github.com/frederikbeimgraben/kinoko/backend/internal/pipeline/core/horizons"
	"github.com/frederikbeimgraben/kinoko/backend/internal/pipeline/model/bundle"
	"github.com/frederikbeimgraben/kinoko/backend/internal/pipeline/render"
	"github.com/frederikbeimgraben/kinoko/backend/internal/pipeline/weather"
)

// runModels is what the render steps need to know of the active models of the run species.
type runModels struct {
	// shared is the forecast cap: the largest horizon that each active model has.
	shared int
	// features is the union of the features of each horizon of each model, sorted.
	features []string
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

// bundleHead is the part of bundle.json that the run reads without the models.
type bundleHead struct {
	Horizons map[int]struct {
		Features []string `json:"features"`
	} `json:"horizons"`
}

// readHead reads the horizons and the features of a bundle from bundle.json.
func readHead(dir string) (bundleHead, error) {
	data, err := os.ReadFile(filepath.Join(dir, bundle.FileName))
	if err != nil {
		return bundleHead{}, err
	}
	var head bundleHead
	return head, json.Unmarshal(data, &head)
}

// models reads the heads of the active models of the run species once per run.
// A species without a model does not count.
func (c *Chain) models(j *Job) (runModels, error) {
	if j.models != nil {
		return *j.models, nil
	}
	var sets [][]int
	var features []string
	for _, sp := range j.Species {
		dir, err := c.bundleDir(sp)
		if errors.Is(err, sources.ErrMissing) {
			continue
		}
		if err != nil {
			return runModels{}, err
		}
		head, err := readHead(dir)
		if err != nil {
			return runModels{}, err
		}
		keys := make([]int, 0, len(head.Horizons))
		for h, hz := range head.Horizons {
			keys = append(keys, h)
			features = append(features, hz.Features...)
		}
		slices.Sort(keys)
		sets = append(sets, keys)
	}
	slices.Sort(features)
	m := runModels{shared: horizons.SharedHorizon(sets), features: slices.Compact(features)}
	j.models = &m
	return m, nil
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

// grids reads the trees grid and the site grid once per run. The maps and the layers share them.
func (c *Chain) grids(j *Job, a Assets) (render.Tables, error) {
	if j.grids != nil {
		return *j.grids, nil
	}
	t, err := render.LoadGrids(a.TreesGrid, a.SiteGrid)
	if err != nil {
		return render.Tables{}, err
	}
	j.grids = &t
	return t, nil
}

// mapTables gives the grids and the tree scales of the run. The scales hold the
// columns of each model of the run, so the run reads them once and not per species.
func (c *Chain) mapTables(j *Job) (render.Tables, error) {
	a, err := c.assets()
	if err != nil {
		return render.Tables{}, err
	}
	t, err := c.grids(j, a)
	if err != nil {
		return render.Tables{}, err
	}
	if j.scales == nil {
		m, err := c.models(j)
		if err != nil {
			return render.Tables{}, err
		}
		if j.scales, err = render.LoadScales(a.TreeScales, render.ScaleColumnsOf(m.features)); err != nil {
			return render.Tables{}, err
		}
	}
	t.Scales = j.scales
	return t, nil
}

// weatherCube reads the weather checkpoints vars once per run. A cube without
// one of vars is dropped before the next read, so two cubes are never in memory.
func (c *Chain) weatherCube(j *Job, vars []string) (*weather.Cube, error) {
	if j.cube != nil && !slices.ContainsFunc(vars, func(v string) bool { return !slices.Contains(j.cubeVars, v) }) {
		return j.cube, nil
	}
	j.cube, j.cubeVars = nil, nil
	cube, err := weather.LoadCube(c.weeklyDir(), vars, weather.KeysOfAll())
	if err != nil {
		return nil, err
	}
	j.cube, j.cubeVars = cube, slices.Clone(vars)
	j.Printf("weather: %d checkpoints in memory: %v", len(vars), vars)
	return cube, nil
}

// RenderSpecies draws the map of one species with its active model.
func (c *Chain) RenderSpecies(ctx context.Context, j *Job, sp Species) error {
	if c.Renderer == nil {
		return ErrNoRenderer
	}
	// The training of the run is done, so its tree scales can go.
	j.trees = nil
	dir, err := c.bundleDir(sp)
	if err != nil {
		return err
	}
	m, err := c.models(j)
	if err != nil {
		return err
	}
	tables, err := c.mapTables(j)
	if err != nil {
		return err
	}
	cube, err := c.weatherCube(j, render.WeatherInputs(m.features))
	if err != nil {
		return err
	}
	b, err := bundle.Load(dir)
	if err != nil {
		return err
	}
	defer b.Close()
	return c.Renderer.RenderSpecies(ctx, SpeciesRender{
		Slug: sp.Slug, ChainKey: sp.Chain.Key, Bundle: b, MinForest: sp.Chain.MinForest, SharedHorizon: m.shared,
		Tables: tables, Cube: cube, Records: j.Records, Maps: c.Maps, Today: j.Now, Log: j.Printf,
	})
}

// RenderLayers publishes the static layers, then draws the weekly input layers.
func (c *Chain) RenderLayers(ctx context.Context, j *Job) error {
	if c.Renderer == nil {
		return ErrNoRenderer
	}
	if err := c.PublishStatic(j.Printf); err != nil {
		return err
	}
	// The maps of the run are done, so the tree scales can go.
	j.trees, j.scales = nil, nil
	a, err := c.assets()
	if err != nil {
		return err
	}
	tables, err := c.grids(j, a)
	if err != nil {
		return err
	}
	cube, err := c.weatherCube(j, render.LayerWeather())
	if err != nil {
		return err
	}
	return c.Renderer.RenderLayers(ctx, LayersRender{Tables: tables, Cube: cube, Maps: c.Maps, Log: j.Printf})
}
