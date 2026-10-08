package runner

import (
	"context"
	"errors"
	"time"

	"github.com/frederikbeimgraben/kinoko/backend/internal/pipeline/model/bundle"
	"github.com/frederikbeimgraben/kinoko/backend/internal/pipeline/occ"
	"github.com/frederikbeimgraben/kinoko/backend/internal/pipeline/weather"
)

// ErrNoRenderer tells that the service has no renderer for the render steps.
var ErrNoRenderer = errors.New("runner: the service has no map renderer")

// Assets are the active derived grids that the renderer reads.
type Assets struct {
	TreesGrid  string
	TreeScales string
	SiteGrid   string
}

// SpeciesRender is the input of the map of one species. The manifest goes
// to <Maps>/<Slug>.json, named by the catalogue slug (finding 1 of the plan).
type SpeciesRender struct {
	Slug      string
	ChainKey  string
	Bundle    *bundle.Bundle
	MinForest float64
	// SharedHorizon is the forecast cap: the largest horizon that each active model has.
	SharedHorizon int
	Cube          *weather.Cube
	Records       []occ.Record
	Assets        Assets
	Maps          string
	// Today is the date of the automatic forecast: the start of the run.
	Today time.Time
	Log   func(format string, args ...any)
}

// LayersRender is the input of the weekly input layers.
type LayersRender struct {
	Cube   *weather.Cube
	Assets Assets
	Maps   string
	Log    func(format string, args ...any)
}

// Renderer draws the maps and the weekly layers, and removes the week
// folders that no manifest names. Package render implements it.
type Renderer interface {
	RenderSpecies(ctx context.Context, in SpeciesRender) error
	RenderLayers(ctx context.Context, in LayersRender) error
}
