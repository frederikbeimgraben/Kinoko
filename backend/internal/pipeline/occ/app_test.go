package occ

import (
	"math"
	"testing"
	"time"
)

// Port of test_app_funde.py: a find becomes a GBIF-shaped row with its own observer.
func TestAppFindRows(t *testing.T) {
	finds := []AppFind{
		{ID: "3f2b-0001", ScientificName: "Boletus edulis", Lat: 48.5203, Lon: 9.0511, FoundOn: time.Date(2026, 9, 1, 0, 0, 0, 0, time.UTC)},
		{ID: "3f2b-0002", ScientificName: "Macrolepiota procera", Lat: 48.6, Lon: 9.2, FoundOn: time.Date(2026, 9, 2, 0, 0, 0, 0, time.UTC)},
	}
	a, b := appRecord(finds[0]), appRecord(finds[1])
	if a.GBIFID != "app:3f2b-0001" || a.Species != "Boletus edulis" || a.Basis != BasisApp {
		t.Errorf("first row %+v", a)
	}
	if a.Lat != 48.5203 || a.Lon != 9.0511 || !math.IsNaN(a.Uncertainty) {
		t.Errorf("a find keeps its exact place and claims no error: %+v", a)
	}
	if a.Observer == b.Observer || a.Observer[:4] != "app:" || a.Observer != AppObserver("3f2b-0001") {
		t.Errorf("each find is its own observer: %q %q", a.Observer, b.Observer)
	}
	if a.ISOYear != 2026 || a.ISOWeek != 36 || b.ISOWeek != 36 {
		t.Errorf("iso weeks %d/%d %d", a.ISOYear, a.ISOWeek, b.ISOWeek)
	}
}
