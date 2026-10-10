// Package occtest reads the golden occurrence table, so the tests of the occ
// packages share one input.
package occtest

import (
	"encoding/json"
	"math"
	"os"
	"time"

	"github.com/frederikbeimgraben/kinoko/backend/internal/pipeline/core/geo"
	"github.com/frederikbeimgraben/kinoko/backend/internal/pipeline/occ"
)

// Row is one row of occurrences.json.
type Row struct {
	GBIFID   string   `json:"gbifID"`
	Species  *string  `json:"species"`
	Observer *string  `json:"observer"`
	Basis    string   `json:"basis"`
	Lat      float64  `json:"lat"`
	Lon      float64  `json:"lon"`
	Unc      *float64 `json:"unc"`
	Date     string   `json:"date"`
	ISOYear  int      `json:"iso_year"`
	ISOWeek  int      `json:"iso_week"`
	DOY      int      `json:"doy"`
	X        float64  `json:"x"`
	Y        float64  `json:"y"`
	Cell     string   `json:"cell"`
}

// Rows reads occurrences.json.
func Rows(path string) ([]Row, error) {
	raw, err := os.ReadFile(path)
	if err != nil {
		return nil, err
	}
	var rows []Row
	return rows, json.Unmarshal(raw, &rows)
}

// Records reads occurrences.json as records with the golden x and y.
func Records(path string) ([]occ.Record, error) {
	rows, err := Rows(path)
	if err != nil {
		return nil, err
	}
	out := make([]occ.Record, len(rows))
	for i, r := range rows {
		rec, err := r.Record()
		if err != nil {
			return nil, err
		}
		out[i] = rec
	}
	return out, nil
}

// Record converts a row.
func (r Row) Record() (occ.Record, error) {
	d, err := time.Parse(time.DateOnly, r.Date)
	if err != nil {
		return occ.Record{}, err
	}
	cell, err := geo.ParseCellKey(r.Cell)
	if err != nil {
		return occ.Record{}, err
	}
	unc := math.NaN()
	if r.Unc != nil {
		unc = *r.Unc
	}
	return occ.Record{
		GBIFID: r.GBIFID, Species: deref(r.Species), Observer: deref(r.Observer), Basis: r.Basis,
		Lat: r.Lat, Lon: r.Lon, Uncertainty: unc, Date: d, ISOYear: r.ISOYear, ISOWeek: r.ISOWeek,
		DOY: r.DOY, X: r.X, Y: r.Y, Cell: cell,
	}, nil
}

func deref(s *string) string {
	if s == nil {
		return ""
	}
	return *s
}
