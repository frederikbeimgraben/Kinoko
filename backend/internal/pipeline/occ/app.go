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

// AppBox is the extent in degrees (west, south, east, north) that an app find
// must lie in. A find outside would stretch the dense activity grid far beyond Germany.
var AppBox = [4]float64{5.5, 47.0, 15.5, 55.5}

// AppDropped counts the app finds that BoundAppFinds drops.
type AppDropped struct{ Outside, Future int }

// BoundAppFinds keeps the finds inside AppBox and not after the day of today.
func BoundAppFinds(finds []AppFind, today time.Time) ([]AppFind, AppDropped) {
	last := time.Date(today.Year(), today.Month(), today.Day(), 0, 0, 0, 0, time.UTC)
	var out []AppFind
	var dropped AppDropped
	for _, f := range finds {
		day := time.Date(f.FoundOn.Year(), f.FoundOn.Month(), f.FoundOn.Day(), 0, 0, 0, 0, time.UTC)
		switch {
		case !(f.Lon >= AppBox[0] && f.Lon <= AppBox[2] && f.Lat >= AppBox[1] && f.Lat <= AppBox[3]):
			dropped.Outside++
		case day.After(last):
			dropped.Future++
		default:
			out = append(out, f)
		}
	}
	return out, dropped
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
