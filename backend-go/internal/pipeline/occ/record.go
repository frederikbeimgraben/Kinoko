// Package occ builds the occurrence table of the chain (build_occurrences.py):
// GBIF records from the cache and the archive import, plus the app finds, in
// class Agaricomycetes, with an ISO week and a 5 km cell. Subpackages build
// the visits, the activity fields and the season table from it.
package occ

import (
	"math"
	"time"

	"github.com/frederikbeimgraben/kinoko/backend/internal/pipeline/core/geo"
)

// Constants of build_occurrences.py.
const (
	// CellSize is CELL_SIZE, the edge of a grid cell in metres.
	CellSize = 5000
	// TargetClass is TARGET_CLASS, the class that the chain keeps.
	TargetClass = "Agaricomycetes"
	// MaxUncertainty is the default of --max-uncertainty in metres.
	MaxUncertainty = 5000.0
	// BasisGBIF and BasisApp are the values of the basis column.
	BasisGBIF = "gbif"
	BasisApp  = "app"
)

// LichenClasses is LICHEN_CLASSES: classes that form lichens.
var LichenClasses = []string{"Lecanoromycetes", "Arthoniomycetes", "Lichinomycetes", "Coniocybomycetes"}

// Record is one row of occurrences.parquet. It keeps the columns that the
// later steps read. Uncertainty is NaN when the publisher gave none.
type Record struct {
	GBIFID      string
	Species     string // "": no species
	Observer    string // recordedByHash, "": no observer
	Basis       string
	Lat, Lon    float64
	Uncertainty float64
	Date        time.Time // UTC midnight
	ISOYear     int
	ISOWeek     int
	DOY         int
	X, Y        float64 // EPSG:3035
	Cell        geo.CellKey
}

// HasObserver tells if recordedByHash is not null.
func (r Record) HasObserver() bool { return r.Observer != "" }

// UncertaintyAtMost tells if the coordinate error is unknown or at most m metres.
func (r Record) UncertaintyAtMost(m float64) bool {
	return math.IsNaN(r.Uncertainty) || r.Uncertainty <= m
}

// TrainingSet is the record filter of visit_model.main: ISO year from minYear and
// a coordinate error of at most maxUnc metres. Both the visits and the activity
// fields must use it; region_map.py used all records (finding 5 of the plan).
func TrainingSet(records []Record, minYear int, maxUnc float64) []Record {
	out := make([]Record, 0, len(records))
	for _, r := range records {
		if r.ISOYear >= minYear && r.UncertaintyAtMost(maxUnc) {
			out = append(out, r)
		}
	}
	return out
}

// Stats counts what BuildOccurrences read and dropped.
type Stats struct {
	Files        int
	Read         int
	Duplicates   int
	App          int
	Lichens      int
	OtherClass   int
	NoDate       int
	TooCoarse    int
	NoCoordinate int
	Kept         int
	KeptApp      int
}
