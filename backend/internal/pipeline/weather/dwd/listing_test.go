package dwd

import (
	"encoding/json"
	"os"
	"slices"
	"testing"
)

// listingGolden is the golden file testdata/listing.json: the parsed listing and
// the newest version of the saved pages in testdata.
type listingGolden map[string]struct {
	Names  []string           `json:"names"`
	Newest map[string]*string `json:"newest"`
}

func loadListing(t *testing.T) listingGolden {
	t.Helper()
	b, err := os.ReadFile("../testdata/listing.json")
	if err != nil {
		t.Fatal(err)
	}
	var g listingGolden
	if err := json.Unmarshal(b, &g); err != nil {
		t.Fatal(err)
	}
	return g
}

func page(t *testing.T, name string) string {
	t.Helper()
	b, err := os.ReadFile("../testdata/" + name)
	if err != nil {
		t.Fatal(err)
	}
	return string(b)
}

func TestParseListingMatchesGolden(t *testing.T) {
	for name, want := range loadListing(t) {
		if got := ParseListing(page(t, name)); !slices.Equal(got, want.Names) {
			t.Errorf("%s: got %v, want %v", name, got, want.Names)
		}
	}
}

func TestNewestVersionHyrasMatchesGolden(t *testing.T) {
	g := loadListing(t)["hyras_precipitation.html"]
	for year, want := range map[string]int{"2023": 2023, "2024": 2024, "2025": 2025, "2026": 2026} {
		got := NewestVersion(g.Names, HyrasPattern("pr", want))
		exp := ""
		if g.Newest[year] != nil {
			exp = *g.Newest[year]
		}
		if got != exp {
			t.Errorf("%s: got %q, want %q", year, got, exp)
		}
	}
}

// The golden listing gives every soil file the version (0, 0), because its
// pattern requires "_" after the version. NewestVersion takes the newest soil file.
func TestNewestVersionSoilTakesNewest(t *testing.T) {
	g := loadListing(t)["soil_spruce_2024.html"]
	if py := *g.Newest["0-30"]; py != "grids_germany_daily_soil_moisture_spruce_2024_0-30_v1-0.nc" {
		t.Fatalf("the golden listing picked %s", py)
	}
	got := NewestVersion(g.Names, SoilPattern("spruce", 2024, "0-30"))
	if got != "grids_germany_daily_soil_moisture_spruce_2024_0-30_v1-1.nc" {
		t.Errorf("got %s", got)
	}
}

func TestVersionKeyAndYear(t *testing.T) {
	cases := map[string][2]int{
		"pr_hyras_1_2024_v6-1_de.nc":                              {6, 1},
		"pr_hyras_1_2024_v12_de.nc":                               {12, 0},
		"grids_germany_daily_soil_moisture_oak_2020_0-30_v2-3.nc": {2, 3},
		"README.txt": {0, 0},
	}
	for name, want := range cases {
		if got := VersionKey(name); got != want {
			t.Errorf("%s: got %v, want %v", name, got, want)
		}
	}
	if y, ok := YearOf("dwd/hyras/precipitation/pr_hyras_1_2024_v6-1_de.nc"); !ok || y != 2024 {
		t.Errorf("year %d %v", y, ok)
	}
	if y, ok := YearOf("dwd/soil_moisture/oak/grids_germany_daily_soil_moisture_oak_2020_0-30_v2-3.nc"); !ok || y != 2020 {
		t.Errorf("year %d %v", y, ok)
	}
}
