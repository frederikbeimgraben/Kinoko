// Package render draws the weekly maps of the forecast chain: the species
// maps of region_map.py, the weekly input layers of input_layers.py, the
// static layer merge and the week cleanup of update.sh. It writes value
// tiles and Python-compatible manifests into PILZE_MAPS.
package render

import (
	"time"

	"github.com/frederikbeimgraben/kinoko/backend/internal/pipeline/core/geo"
	"github.com/frederikbeimgraben/kinoko/backend/internal/pipeline/model/bundle"
	"github.com/frederikbeimgraben/kinoko/backend/internal/pipeline/occ"
	"github.com/frederikbeimgraben/kinoko/backend/internal/pipeline/occ/activity"
	"github.com/frederikbeimgraben/kinoko/backend/internal/pipeline/tiles"
	"github.com/frederikbeimgraben/kinoko/backend/internal/pipeline/weather"
)

// Logger receives progress lines.
type Logger interface {
	Printf(format string, args ...any)
}

type nopLogger struct{}

func (nopLogger) Printf(string, ...any) {}

func logOf(l Logger) Logger {
	if l == nil {
		return nopLogger{}
	}
	return l
}

// Constants of region_map.py and input_layers.py.
const (
	// TrainCell is the cell of the weather raster and of the training, in metres.
	TrainCell = weather.CellSize
	// DefaultStep is the edge of a map cell in metres.
	DefaultStep = 500
	// DefaultWeeks is the number of rendered weeks (--weeks 90).
	DefaultWeeks = 90
	// LeadWeeks is the number of weeks before the rendered ones that the lags and windows read.
	LeadWeeks = 20
	// DefaultSmooth is the Gaussian sigma of the map field, in cells.
	DefaultSmooth = 1.2
	// DefaultMinForest is the forest share under which a cell stays empty.
	DefaultMinForest = 0.03
	// ChunkRows is the number of rows that one LightGBM call predicts.
	ChunkRows = 200_000
	// smoothNorm is the filter weight under which a smoothed cell stays empty.
	smoothNorm = float32(0.08)
)

// RegionDE is REGIONEN["de"] of region_map.py: west, south, east, north in degrees.
var RegionDE = [4]float64{5.75, 47.15, 15.15, 55.15}

// Inputs are the data of one species map. The runner loads them; Species only reads them.
type Inputs struct {
	// Tables holds the trees grid, the tree scales and the site grid.
	Tables Tables
	// Weather holds the observed weeks of pr, tas and tasmin over the full record.
	// The normals of the anomalies need each year.
	Weather *weather.Cube
	// Records are the occurrences. Species keeps occ.TrainingSet of them (finding 5).
	Records []occ.Record
	// Activity replaces the fields built from Records when it is not nil.
	Activity *activity.Fields
	// Bundle is the model of the species with loaded boosters.
	Bundle *bundle.Bundle
	// Warper warps the fields onto the tile grid.
	Warper tiles.Warper
}

// Config holds the settings of one species map.
type Config struct {
	// Slug is the catalogue slug. It names the manifest and the tile folder (bug 1).
	Slug string
	// Maps is the output folder PILZE_MAPS.
	Maps string
	// Region is the extent west, south, east, north in degrees.
	Region [4]float64
	// Step is the edge of a map cell in metres.
	Step int
	// Weeks is the number of rendered weeks, forecast weeks included.
	Weeks int
	// Forecast is the number of weeks past the last observed week. Below 0 the
	// run computes it from Today and the horizons, as horizons.forecast_weeks.
	Forecast int
	// SharedHorizon caps the automatic forecast. 0 takes the largest horizon of the bundle.
	SharedHorizon int
	// Today is the date of the automatic forecast.
	Today time.Time
	// MinForest is the forest share under which a cell stays empty.
	MinForest float64
	// Smooth is the Gaussian sigma in cells. 0 turns the smoothing off.
	Smooth float64
	// Spill keeps smoothed values in masked cells, as region_map.py (finding 10).
	Spill bool
	// ReferenceSpecies and ReferenceRecords are the constant detection columns.
	ReferenceSpecies, ReferenceRecords float64
	// ChunkRows is the number of rows per prediction call.
	ChunkRows int
	// Threads is the LightGBM thread count; 0 uses the library default.
	Threads int
	// ZoomCap is the finest zoom a run may write.
	ZoomCap int
	// Log receives progress lines. Nil drops them.
	Log Logger
}

// DefaultConfig returns the settings of update.sh for one species.
func DefaultConfig(slug, maps string) Config {
	return Config{
		Slug: slug, Maps: maps, Region: RegionDE, Step: DefaultStep, Weeks: DefaultWeeks,
		Forecast: -1, Today: time.Now(), MinForest: DefaultMinForest, Smooth: DefaultSmooth,
		ReferenceSpecies: 4, ReferenceRecords: 5, ChunkRows: ChunkRows, ZoomCap: geo.ZoomCap,
	}
}
