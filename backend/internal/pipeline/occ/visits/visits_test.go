package visits

import (
	"encoding/json"
	"os"
	"testing"
	"time"

	"github.com/frederikbeimgraben/kinoko/backend/internal/pipeline/occ"
	"github.com/frederikbeimgraben/kinoko/backend/internal/pipeline/occ/internal/occtest"
)

type goldenVisit struct {
	Key      string  `json:"key"`
	NRecords int     `json:"n_records"`
	NSpecies int     `json:"n_species"`
	Label    int8    `json:"label"`
	FromApp  int8    `json:"from_app"`
	Lon      float64 `json:"lon"`
	Lat      float64 `json:"lat"`
	X        float64 `json:"x"`
	Y        float64 `json:"y"`
	Cell     string  `json:"cell"`
	Date     string  `json:"date"`
	ISOYear  int     `json:"iso_year"`
	ISOWeek  int     `json:"iso_week"`
}

// Golden: visit_model.build_visits (with build_occurrences.visit_gate) on the records of
// occurrences.json filtered as visit_model.main does (iso_year >= 2015, error <= 500 m).
func TestBuildMatchesPython(t *testing.T) {
	records, err := occtest.Records("../testdata/occurrences.json")
	if err != nil {
		t.Fatal(err)
	}
	raw, err := os.ReadFile("testdata/visits.json")
	if err != nil {
		t.Fatal(err)
	}
	var want []goldenVisit
	if err := json.Unmarshal(raw, &want); err != nil {
		t.Fatal(err)
	}
	got := Build(occ.TrainingSet(records, MinYear, MaxUncertainty), []string{"Boletus edulis"}, MinSpecies)
	if len(got) != len(want) {
		t.Fatalf("got %d visits, want %d", len(got), len(want))
	}
	for i, w := range want {
		g := got[i]
		if g.Key != w.Key || g.NRecords != w.NRecords || g.NSpecies != w.NSpecies || g.Label != w.Label ||
			g.FromApp != w.FromApp || g.Cell.String() != w.Cell || g.Date.Format(time.DateOnly) != w.Date ||
			g.ISOYear != w.ISOYear || g.ISOWeek != w.ISOWeek {
			t.Fatalf("visit %d: got %+v, want %+v", i, g, w)
		}
		if g.Lon != w.Lon || g.Lat != w.Lat || g.X != w.X || g.Y != w.Y {
			t.Errorf("visit %d: means %v %v %v %v, want %v %v %v %v", i, g.Lon, g.Lat, g.X, g.Y, w.Lon, w.Lat, w.X, w.Y)
		}
	}
	if Positives(got) == 0 || CheckPositives(got) == nil {
		t.Errorf("positives %d: the small set must fail the check of %d", Positives(got), MinPositives)
	}
}

// Port of the gate tests of test_app_funde.py.
func TestGate(t *testing.T) {
	cases := []struct {
		name string
		v    Visit
		keep bool
	}{
		{"a careful walk", Visit{NSpecies: 12}, true},
		{"a lonely record", Visit{NSpecies: 1}, false},
		{"an app find of the target", Visit{NSpecies: 1, Label: 1, FromApp: 1}, true},
		{"an app find of another species is no absence", Visit{NSpecies: 1, FromApp: 1}, false},
	}
	for _, c := range cases {
		if Gate(c.v, 2) != c.keep {
			t.Errorf("%s: gate gives %v", c.name, !c.keep)
		}
	}
}
