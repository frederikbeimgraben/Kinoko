package occ

import (
	"math"
	"time"

	"github.com/frederikbeimgraben/kinoko/backend/internal/pipeline/core/calendar"
)

// AppFind is a find that a person released for training (input A6). The runner
// makes it from objects.TrainingFinds: ID.String(), the latin name of SpeciesID,
// and FoundOn.Time. This package does not import objects, which imports the server.
type AppFind struct {
	ID             string
	ScientificName string
	Lat, Lon       float64
	FoundOn        time.Time
}

// appRecord is read_app for one find, after add_time. The find has no
// coordinate error, because a phone GPS gives no estimate.
func appRecord(f AppFind) Record {
	day := time.Date(f.FoundOn.Year(), f.FoundOn.Month(), f.FoundOn.Day(), 0, 0, 0, 0, time.UTC)
	return withTime(Record{
		GBIFID:      "app:" + f.ID,
		Species:     f.ScientificName,
		Observer:    AppObserver(f.ID),
		Basis:       BasisApp,
		Lat:         f.Lat,
		Lon:         f.Lon,
		Uncertainty: math.NaN(),
	}, day)
}

// withTime sets the date, the ISO week and the day of the year, as add_time.
func withTime(r Record, day time.Time) Record {
	w := calendar.WeekOf(day)
	r.Date, r.ISOYear, r.ISOWeek, r.DOY = day, w.Year, w.Week, day.YearDay()
	return r
}
