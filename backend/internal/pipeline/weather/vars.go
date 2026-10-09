// Package weather reduces the DWD daily grids and the day measures to weekly
// values per model cell, joins them into a Cube and derives the lag, rolling
// and anomaly features.
package weather

// CellSize is the edge of a model cell in metres (EPSG:3035).
const CellSize = 5000

// Block is the number of days read from a netCDF file at once.
const Block = 31

// EPSG codes of the grids. HYRAS uses the model CRS; the soil grid uses Gauss-Krueger zone 3.
const (
	ModelEPSG = 3035
	SoilEPSG  = 31467
)

// How is the reduction of the days of one ISO week.
type How int

// Weekly reductions, as pandas groupby methods.
const (
	Sum  How = iota // Sum of the days with a value.
	Mean            // Mean of the days with a value.
	Min
	Max
	Last // The last day with a value.
)

// Job is one weekly checkpoint: the source files, the netCDF variable and the
// reduction. Measure makes the day measure of the job, or is nil.
type Job struct {
	Name    string // the checkpoint name and column: weekly/<Name>.parquet
	Dir     string // the folder of the year files, relative to the raw root
	Var     string // the netCDF variable
	How     How
	Soil    bool // the grid is in SoilEPSG and needs a transform
	Measure func() DayMeasure
}

// Jobs are the weekly checkpoints, in this order: the HYRAS
// variables, the soil moisture per stand, then the day measures.
var Jobs = []Job{
	{Name: "pr", Dir: "hyras/precipitation", Var: "pr", How: Sum},
	{Name: "tas", Dir: "hyras/air_temperature_mean", Var: "tas", How: Mean},
	{Name: "tasmin", Dir: "hyras/air_temperature_min", Var: "tasmin", How: Min},
	{Name: "tasmax", Dir: "hyras/air_temperature_max", Var: "tasmax", How: Max},
	{Name: "hurs", Dir: "hyras/humidity", Var: "hurs", How: Mean},
	{Name: "paws_spruce", Dir: "soil_moisture/spruce", Var: "paws", How: Mean, Soil: true},
	{Name: "paws_beech", Dir: "soil_moisture/beech", Var: "paws", How: Mean, Soil: true},
	{Name: "paws_oak", Dir: "soil_moisture/oak", Var: "paws", How: Mean, Soil: true},
	{Name: "paws_pine", Dir: "soil_moisture/pine", Var: "paws", How: Mean, Soil: true},
	{Name: "days_since_rain", Dir: "hyras/precipitation", Var: "pr", How: Last,
		Measure: func() DayMeasure { return DaysSince(5.0, 60) }},
	{Name: "frost_days", Dir: "hyras/air_temperature_min", Var: "tasmin", How: Sum,
		Measure: func() DayMeasure { return ThresholdDays(0.0, false) }},
	{Name: "heat_days", Dir: "hyras/air_temperature_max", Var: "tasmax", How: Sum,
		Measure: func() DayMeasure { return ThresholdDays(25.0, true) }},
}

// PawsVars are the soil moisture columns. Their mean is the derived column "paws".
var PawsVars = []string{"paws_spruce", "paws_beech", "paws_oak", "paws_pine"}

// referenceDir holds the precipitation files that define the land cells.
const referenceDir = "hyras/precipitation"
