package season

import (
	"bytes"
	"encoding/json"
	"math"
	"os"
	"path/filepath"
	"testing"
	"time"

	"github.com/frederikbeimgraben/kinoko/backend/internal/pipeline/core/calendar"
	"github.com/frederikbeimgraben/kinoko/backend/internal/pipeline/occ"
	"github.com/frederikbeimgraben/kinoko/backend/internal/pipeline/occ/internal/occtest"
)

// Golden: arten_zaehlen.saisontabelle(begehungen_bilden(occ), stand=letzte_volle_woche(max date)),
// written as arten_zaehlen.main writes it. The bytes must be equal.
func TestTableMatchesPythonBytes(t *testing.T) {
	records, err := occtest.Records("../testdata/occurrences.json")
	if err != nil {
		t.Fatal(err)
	}
	want, err := os.ReadFile("testdata/saison.json")
	if err != nil {
		t.Fatal(err)
	}
	entries := Begehungen(records, AbJahr, MinArten, MaxUnsicherheitM)
	stand, err := Stand(entries)
	if err != nil {
		t.Fatal(err)
	}
	table, err := Table(entries, LatinNames(), stand)
	if err != nil {
		t.Fatal(err)
	}
	path := filepath.Join(t.TempDir(), "unter", "saison.json")
	if err := Write(path, table); err != nil {
		t.Fatal(err)
	}
	got, err := os.ReadFile(path)
	if err != nil {
		t.Fatal(err)
	}
	if !bytes.Equal(got, want) {
		t.Fatalf("saison.json differs from Python:\n got %.300s\nwant %.300s", got, want)
	}
}

// Golden: arten_zaehlen.letzte_volle_woche.
func TestLastFullWeekMatchesPython(t *testing.T) {
	raw, err := os.ReadFile("testdata/weeks.json")
	if err != nil {
		t.Fatal(err)
	}
	var cases [][3]any
	if err := json.Unmarshal(raw, &cases); err != nil {
		t.Fatal(err)
	}
	for _, c := range cases {
		d, _ := time.Parse(time.DateOnly, c[0].(string))
		want := calendar.Week{Year: int(c[1].(float64)), Week: int(c[2].(float64))}
		if got := LastFullWeek(d); got != want {
			t.Errorf("%s: %v, want %v", c[0], got, want)
		}
	}
}

// fixture is _occ of test_arten_zaehlen.py: six records in four visits, two too coarse or too lonely.
func fixture() []occ.Record {
	type row struct {
		species, who, date string
		km, year, week     int
		unc                float64
	}
	nan := math.NaN()
	rows := []row{
		{"Boletus edulis", "anna", "2024-10-01", 40, 2024, 40, nan},
		{"Imleria badia", "anna", "2024-10-01", 40, 2024, 40, nan},
		{"Imleria badia", "anna", "2024-10-08", 41, 2024, 41, 100},
		{"Cantharellus cibarius", "anna", "2024-10-08", 41, 2024, 41, 100},
		{"Boletus edulis", "bert", "2024-10-01", 40, 2024, 40, nan},
		{"Boletus edulis", "cara", "2025-10-01", 40, 2025, 40, 5000},
		{"Imleria badia", "cara", "2025-10-01", 40, 2025, 40, 5000},
		{"Boletus edulis", "dora", "2026-06-01", 23, 2026, 23, nan},
		{"Imleria badia", "dora", "2026-06-01", 23, 2026, 23, nan},
		{"Boletus edulis", "emil", "2010-10-01", 40, 2010, 40, nan},
		{"Imleria badia", "emil", "2010-10-01", 40, 2010, 40, nan},
	}
	out := make([]occ.Record, len(rows))
	for i, r := range rows {
		d, _ := time.Parse(time.DateOnly, r.date)
		out[i] = occ.Record{Species: r.species, Observer: r.who, Date: d, ISOYear: r.year, ISOWeek: r.week,
			Uncertainty: r.unc, X: float64(r.km * 1000), Y: float64(r.km * 1000)}
	}
	return out
}

func TestNamesCoverTheAppSpecies(t *testing.T) {
	if len(Arten) != 85 || Arten[0] != (Art{"Boletus edulis", "Steinpilz"}) {
		t.Errorf("%d names, first %v", len(Arten), Arten[0])
	}
}

func TestStufeFollowsTheThresholds(t *testing.T) {
	for n, want := range map[int]string{0: "Profil", 59: "Profil", 60: "Saison", 599: "Saison", 600: "Vorhersage", 4000: "Vorhersage"} {
		if got := Stufe(n); got != want {
			t.Errorf("Stufe(%d) = %s, want %s", n, got, want)
		}
	}
}

func TestWeek53FoldsIntoWeek52(t *testing.T) {
	var s Series
	for range 3 {
		s.add(52)
	}
	for range 4 {
		s.add(53)
	}
	if s[51] != 7 {
		t.Errorf("week 52 holds %d, want 7", s[51])
	}
}

func TestVisitsNeedTwoSpeciesAndAnExactPlace(t *testing.T) {
	entries := Begehungen(fixture(), AbJahr, MinArten, MaxUnsicherheitM)
	who, keys := map[string]bool{}, map[string]bool{}
	for _, e := range entries {
		who[e.Observer], keys[e.Visit] = true, true
	}
	if len(who) != 2 || !who["anna"] || !who["dora"] || len(keys) != 3 {
		t.Errorf("observers %v, visits %d", who, len(keys))
	}
}

func TestTableSplitsClosedYearsAndCountsPerSpecies(t *testing.T) {
	table, err := Table(Begehungen(fixture(), AbJahr, MinArten, MaxUnsicherheitM), LatinNames(), calendar.Week{Year: 2026, Week: 34})
	if err != nil {
		t.Fatal(err)
	}
	var doc struct {
		StandJahr, BisJahr, VonJahr    int
		BegehungenJeWoche              []int
		BegehungenJeWocheLaufendesJahr []int
		Arten                          map[string]struct {
			BegehungenMitFund         int
			FundeJeWoche              []int
			FundeJeWocheLaufendesJahr []int
		}
	}
	if err := json.Unmarshal(Marshal(table), &doc); err != nil {
		t.Fatal(err)
	}
	if doc.StandJahr != 2026 || doc.BisJahr != 2025 || doc.VonJahr != 2024 {
		t.Errorf("years %d %d %d", doc.StandJahr, doc.BisJahr, doc.VonJahr)
	}
	if doc.BegehungenJeWoche[39] != 1 || doc.BegehungenJeWoche[40] != 1 || doc.BegehungenJeWocheLaufendesJahr[22] != 1 {
		t.Errorf("visits per week %v %v", doc.BegehungenJeWoche, doc.BegehungenJeWocheLaufendesJahr)
	}
	be, ib := doc.Arten["Boletus edulis"], doc.Arten["Imleria badia"]
	if be.BegehungenMitFund != 2 || be.FundeJeWoche[39] != 1 || be.FundeJeWocheLaufendesJahr[22] != 1 || ib.BegehungenMitFund != 3 {
		t.Errorf("per species %+v %+v", be, ib)
	}
	if m := doc.Arten["Morchella esculenta"]; m.BegehungenMitFund != 0 || len(m.FundeJeWoche) != 52 {
		t.Errorf("a species without a find has zeros: %+v", m)
	}
	if _, err := Table(nil, LatinNames(), calendar.Week{Year: 2026, Week: 1}); err != ErrNoVisits {
		t.Errorf("no visits: %v", err)
	}
}
