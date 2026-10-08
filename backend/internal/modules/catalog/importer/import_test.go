package importer

import (
	"bytes"
	"context"
	"fmt"
	"slices"
	"strings"
	"testing"

	"github.com/frederikbeimgraben/kinoko/backend/internal/core/db"
)

func runImport(t *testing.T) (*Report, func(string, ...any) int) {
	t.Helper()
	handle := openDB(t)
	data := realData(t)
	profiles, err := LoadProfiles(data)
	if err != nil {
		t.Fatal(err)
	}
	report, err := ImportAll(context.Background(), handle, profiles, data, fixedNow)
	if err != nil {
		t.Fatal(err)
	}
	return report, func(q string, args ...any) int { return count(t, handle, q, args...) }
}

func TestImportWritesEverySpecies(t *testing.T) {
	report, n := runImport(t)
	want := speciesFileCount(t)
	if got := n("SELECT count(*) FROM species"); got != want {
		t.Fatalf("species %d, expected %d", got, want)
	}
	if report.Counts["species"] != want {
		t.Fatalf("report %v", report.Counts)
	}
	if n("SELECT count(*) FROM species WHERE updated_at = '2026-01-02 03:04:05.000000'") != want {
		t.Fatal("updated_at is not the clock time")
	}
}

func TestBoletusEdulisDetails(t *testing.T) {
	handle := openDB(t)
	data := realData(t)
	profiles, err := LoadProfiles(data)
	if err != nil {
		t.Fatal(err)
	}
	if _, err := ImportAll(context.Background(), handle, profiles, data, fixedNow); err != nil {
		t.Fatal(err)
	}
	ctx := context.Background()
	var id, edibility, group, protection, genusSlug, genusRank string
	err = handle.QueryRowContext(ctx, `SELECT s.id, s.edibility, s.group_key, s.protection, t.slug, t.rank
		FROM species s JOIN taxon t ON t.id = s.taxon_id WHERE s.slug = 'boletus-edulis'`).
		Scan(&id, &edibility, &group, &protection, &genusSlug, &genusRank)
	if err != nil {
		t.Fatal(err)
	}
	if edibility != "edible" || group != "bolete" || protection != "personal_use" || genusSlug != "boletus" || genusRank != "genus" {
		t.Fatalf("%s %s %s %s %s", edibility, group, protection, genusSlug, genusRank)
	}
	capColours, err := db.Column[string](ctx, handle, "SELECT name FROM species_colour WHERE species_id = ? AND part = 'cap'", id)
	if err != nil {
		t.Fatal(err)
	}
	if !slices.Contains(capColours, "weiß") || !slices.Contains(capColours, "braun") {
		t.Fatalf("cap colours %v", capColours)
	}
	measured, err := db.Column[string](ctx, handle,
		"SELECT part || '.' || dimension FROM species_measurement WHERE species_id = ? ORDER BY 1", id)
	if err != nil {
		t.Fatal(err)
	}
	if !slices.Equal(measured, []string{"cap.width", "spore.length", "spore.width"}) {
		t.Fatalf("measurements %v", measured)
	}
	if n := count(t, handle, "SELECT count(*) FROM species_colour_change WHERE species_id = ?", id); n != 2 {
		t.Fatalf("changes %d", n)
	}
	if n := count(t, handle, "SELECT count(*) FROM species_colour_change_trigger WHERE species_id = ?", id); n != 2 {
		t.Fatalf("triggers %d", n)
	}
	if n := count(t, handle, "SELECT count(*) FROM species_lookalike WHERE species_a_id = ? OR species_b_id = ?", id, id); n < 1 {
		t.Fatalf("lookalikes %d", n)
	}
	traits, err := db.Column[string](ctx, handle, `SELECT "key" FROM species_trait WHERE species_id = ? ORDER BY rowid`, id)
	if err != nil {
		t.Fatal(err)
	}
	if traits[0] != "cap" || traits[1] != "tubes" {
		t.Fatalf("traits keep file order: %v", traits)
	}
}

func TestSecondRunDoesNotDuplicate(t *testing.T) {
	handle := openDB(t)
	data := realData(t)
	profiles, err := LoadProfiles(data)
	if err != nil {
		t.Fatal(err)
	}
	for range 2 {
		if _, err := ImportAll(context.Background(), handle, profiles, data, fixedNow); err != nil {
			t.Fatal(err)
		}
	}
	if got := count(t, handle, "SELECT count(*) FROM species"); got != speciesFileCount(t) {
		t.Fatalf("species %d", got)
	}
	if count(t, handle, "SELECT count(*) FROM species_colour") == 0 || count(t, handle, "SELECT count(*) FROM species_lookalike") == 0 {
		t.Fatal("children missing")
	}
}

func TestRunCreatesSchemaAndImports(t *testing.T) {
	handle, err := db.Open(t.TempDir() + "/catalog.sqlite")
	if err != nil {
		t.Fatal(err)
	}
	defer func() { _ = handle.Close() }()
	var out bytes.Buffer
	if err := Run(context.Background(), handle, realData(t), fixedNow, &out); err != nil {
		t.Fatal(err)
	}
	if got := count(t, handle, "SELECT count(*) FROM species"); got != speciesFileCount(t) {
		t.Fatalf("species %d", got)
	}
	text := out.String()
	if !strings.Contains(text, fmt.Sprintf("species: %d\n", speciesFileCount(t))) || !strings.Contains(text, "Warning: the import deletes") ||
		!strings.Contains(text, "reactions: ") {
		t.Fatalf("output %s", text)
	}
	if count(t, handle, "SELECT count(*) FROM species_reaction") == 0 {
		t.Fatal("reactions missing after the CLI import")
	}
}

func TestPrintReportListsCountsAndSkips(t *testing.T) {
	report := NewReport()
	report.Counts["species"] = 3
	report.Counts["species_name"] = 5
	report.Skipped["measurement_ohne_koerperteil"] = 2
	got := ReportLines(report)
	want := []string{"species: 3", "taxa: 0", "terms: 0", "species_name: 5", "skipped measurement_ohne_koerperteil: 2"}
	if !slices.Equal(got, want) {
		t.Fatalf("%v", got)
	}
}

func TestStartImportsTheCatalogIntoAnEmptyDatabase(t *testing.T) {
	handle := openDB(t)
	if err := SeedIfEmpty(context.Background(), handle, realData(t), fixedNow); err != nil {
		t.Fatal(err)
	}
	if got := count(t, handle, "SELECT count(*) FROM species"); got != 306 {
		t.Fatalf("species %d", got)
	}
}

func TestSyncDoesNotReimportWhenSpeciesExist(t *testing.T) {
	handle := openDB(t)
	ctx := context.Background()
	if err := SeedIfEmpty(ctx, handle, realData(t), fixedNow); err != nil {
		t.Fatal(err)
	}
	before, err := db.Column[string](ctx, handle, "SELECT id FROM species ORDER BY id")
	if err != nil {
		t.Fatal(err)
	}
	if err := SeedIfEmpty(ctx, handle, realData(t), fixedNow); err != nil {
		t.Fatal(err)
	}
	after, err := db.Column[string](ctx, handle, "SELECT id FROM species ORDER BY id")
	if err != nil {
		t.Fatal(err)
	}
	if !slices.Equal(before, after) {
		t.Fatal("the second start imported again")
	}
}
