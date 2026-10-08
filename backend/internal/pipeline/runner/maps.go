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

// RenderSpecies draws the map of one species on the tables and the weather of the run.
func (m *Maps) RenderSpecies(ctx context.Context, in SpeciesRender) error {
	cfg := render.DefaultConfig(in.Slug, in.Maps)
	cfg.MinForest, cfg.SharedHorizon, cfg.Threads, cfg.Log = in.MinForest, in.SharedHorizon, m.Threads, logFunc(in.Log)
	if !in.Today.IsZero() {
		cfg.Today = in.Today
	}
	_, err := render.Species(ctx, render.Inputs{
		Tables: in.Tables, Weather: in.Cube, Records: in.Records, Bundle: in.Bundle, Warper: m.Warper,
	}, cfg)
	return err
}

// RenderLayers draws the weekly layers, then removes the week folders that no manifest names.
func (m *Maps) RenderLayers(ctx context.Context, in LayersRender) error {
	cfg := render.DefaultLayerConfig(in.Maps)
	cfg.Log = logFunc(in.Log)
	tables := render.Tables{Trees: in.Tables.Trees, Site: in.Tables.Site}
	if _, err := render.Layers(ctx, render.LayerInputs{Tables: tables, Weather: in.Cube, Warper: m.Warper}, cfg); err != nil {
		return err
	}
	return render.Cleanup(in.Maps)
}
