package runner

import (
	"context"

	"github.com/frederikbeimgraben/kinoko/backend/internal/pipeline/render"
	"github.com/frederikbeimgraben/kinoko/backend/internal/pipeline/tiles"
)

// logFunc lets a log function serve as render.Logger.
type logFunc func(format string, args ...any)

func (f logFunc) Printf(format string, args ...any) {
	if f != nil {
		f(format, args...)
	}
}

// Maps is the Renderer of the service on package render with the GDAL warper.
type Maps struct {
	Warper tiles.Warper
	// Threads is the LightGBM thread count of the prediction; 0 uses the library default.
	Threads int
}

// NewMaps gives the renderer with the GDAL warper.
func NewMaps() *Maps { return &Maps{Warper: tiles.NewGDALWarper()} }

// RenderSpecies reads the grids with the tree-scale columns of the model and draws the map.
func (m *Maps) RenderSpecies(ctx context.Context, in SpeciesRender) error {
	tables, err := render.LoadTables(in.Assets.TreesGrid, in.Assets.TreeScales, in.Assets.SiteGrid,
		render.ScaleColumns(in.Bundle))
	if err != nil {
		return err
	}
	cfg := render.DefaultConfig(in.Slug, in.Maps)
	cfg.MinForest, cfg.SharedHorizon, cfg.Threads, cfg.Log = in.MinForest, in.SharedHorizon, m.Threads, logFunc(in.Log)
	if !in.Today.IsZero() {
		cfg.Today = in.Today
	}
	_, err = render.Species(ctx, render.Inputs{
		Tables: tables, Weather: in.Cube, Records: in.Records, Bundle: in.Bundle, Warper: m.Warper,
	}, cfg)
	return err
}

// RenderLayers draws the weekly layers, then removes the week folders that no manifest names.
func (m *Maps) RenderLayers(ctx context.Context, in LayersRender) error {
	tables, err := render.LoadTables(in.Assets.TreesGrid, "", in.Assets.SiteGrid, nil)
	if err != nil {
		return err
	}
	cfg := render.DefaultLayerConfig(in.Maps)
	cfg.Log = logFunc(in.Log)
	if _, err := render.Layers(ctx, render.LayerInputs{Tables: tables, Weather: in.Cube, Warper: m.Warper}, cfg); err != nil {
		return err
	}
	return render.Cleanup(in.Maps)
}
