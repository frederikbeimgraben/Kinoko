package occ_test

import (
	"testing"
	"time"

	"github.com/frederikbeimgraben/kinoko/backend/internal/pipeline/occ"
)

func TestBoundAppFindsDropsFindsAbroadAndInTheFuture(t *testing.T) {
	today := time.Date(2026, 10, 8, 3, 0, 0, 0, time.UTC)
	finds := []occ.AppFind{
		{ID: "home", Lat: 48.5, Lon: 9.05, FoundOn: today},
		{ID: "new-york", Lat: 40.7, Lon: -74.0, FoundOn: today},
		{ID: "bad-lat", Lat: 95, Lon: 9.0, FoundOn: today},
		{ID: "typo", Lat: 48.5, Lon: 9.05, FoundOn: time.Date(2099, 9, 1, 0, 0, 0, 0, time.UTC)},
		{ID: "tomorrow", Lat: 48.5, Lon: 9.05, FoundOn: today.AddDate(0, 0, 1)},
	}
	kept, dropped := occ.BoundAppFinds(finds, today)
	if len(kept) != 1 || kept[0].ID != "home" || dropped != (occ.AppDropped{Outside: 2, Future: 2}) {
		t.Errorf("kept %v, dropped %+v", kept, dropped)
	}
}

// TestBuildOccurrencesDropsAnInvalidCoordinate checks that a latitude
// beyond the pole does not reach the grid.
func TestBuildOccurrencesDropsAnInvalidCoordinate(t *testing.T) {
	finds := []occ.AppFind{{ID: "pole", ScientificName: "Boletus edulis", Lat: 95, Lon: 9, FoundOn: time.Date(2025, 9, 1, 0, 0, 0, 0, time.UTC)}}
	got, st, err := occ.BuildOccurrences(occ.Sources{API: "testdata/raw"}, finds, occ.MaxUncertainty)
	if err != nil {
		t.Fatal(err)
	}
	for _, r := range got {
		if r.GBIFID == "app:pole" {
			t.Fatalf("the find is kept at x %v, y %v", r.X, r.Y)
		}
	}
	if st.KeptApp != 0 {
		t.Errorf("stats %+v", st)
	}
}
