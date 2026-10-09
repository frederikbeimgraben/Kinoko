package exporter

import (
	"context"
	"io/fs"
	"os"
	"path/filepath"
	"strings"
	"testing"

	"github.com/frederikbeimgraben/kinoko/backend/internal/core/db"
	"github.com/frederikbeimgraben/kinoko/backend/internal/modules/catalog/importer"
	"github.com/frederikbeimgraben/kinoko/backend/internal/modules/texts"
)

const steinpilz = "(SELECT id FROM species WHERE slug = 'boletus-edulis')"

var edits = []string{
	"UPDATE species SET edibility_note = 'Geprüft: essbar.', description = 'Ein Röhrling.' WHERE slug = 'boletus-edulis'",
	"INSERT INTO species_part_note (species_id, part, description, comment) VALUES (" + steinpilz + ", 'cap', 'Braun.', 'Notiz.')",
	"UPDATE species_colour SET name = 'dunkelbraun', hex = '#4a2c17' WHERE position = 0 AND part = 'cap' AND species_id = " + steinpilz,
	"DELETE FROM species_season WHERE season = 'summer' AND species_id = " + steinpilz,
	"UPDATE species_reaction SET reading = 'zuerst gelb, dann olivgrün' WHERE position = 0 AND species_id = " + steinpilz,
	"UPDATE glossary_entry SET definition_en = 'A broadleaf tree. Checked.' WHERE term = 'Ahorn'",
}

func TestExportCarriesTheChanges(t *testing.T) {
	handle := seeded(t)
	ctx := context.Background()
	for _, edit := range edits {
		if result, err := handle.ExecContext(ctx, edit); err != nil {
			t.Fatal(edit, err)
		} else if n, _ := result.RowsAffected(); n != 1 {
			t.Fatalf("%s: %d rows", edit, n)
		}
	}
	out, report := export(t, handle)
	body, err := os.ReadFile(filepath.Join(out, "arten", "steinpilz.toml"))
	if err != nil {
		t.Fatal(err)
	}
	profile, err := importer.ParseProfile(string(body), "steinpilz")
	if err != nil {
		t.Fatal(err)
	}
	if *profile.SpeisewertHinweis != "Geprüft: essbar." || *profile.Beschreibung != "Ein Röhrling." {
		t.Fatalf("species texts: %s", body)
	}
	if len(profile.Teilnotizen) != 1 || profile.Teilnotizen[0].Key != "hut" || profile.Teilnotizen[0].Kommentar != "Notiz." {
		t.Fatalf("part notes: %+v", profile.Teilnotizen)
	}
	if profile.Farben[0].Key != "hut" || profile.Farben[0].Colours[0].Name != "dunkelbraun" {
		t.Fatalf("colours: %+v", profile.Farben[0])
	}
	if strings.Join(profile.Jahreszeiten, ",") != "herbst" {
		t.Fatalf("seasons: %v", profile.Jahreszeiten)
	}
	for file, want := range map[string]string{
		importer.ReactionsFile: `"reading": "zuerst gelb, dann olivgrün"`,
		texts.GlossaryFile:     `"definitionEn": "A broadleaf tree. Checked."`,
	} {
		body, err := os.ReadFile(filepath.Join(out, file))
		if err != nil {
			t.Fatal(err)
		}
		if !strings.Contains(string(body), want) {
			t.Fatalf("%s misses %s", file, want)
		}
	}
	if len(report.Warnings) > 0 {
		t.Fatalf("warnings: %v", report.Warnings)
	}
	reimported(t, out)
}

// reimported imports the export into a new database and checks the changes and a second, equal export.
func reimported(t *testing.T, out string) {
	t.Helper()
	handle := openDB(t)
	ctx := context.Background()
	// The export does not write the taxonomy: the admin UI does not change it.
	taxa, err := fs.ReadFile(seedData(t), "taxonomie.json")
	if err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(filepath.Join(out, "taxonomie.json"), taxa, 0o600); err != nil {
		t.Fatal(err)
	}
	data := os.DirFS(out)
	if err := importer.SeedIfEmpty(ctx, handle, data, fixedNow); err != nil {
		t.Fatal(err)
	}
	if _, err := texts.SeedGlossary(ctx, handle, data, db.At(fixedNow())); err != nil {
		t.Fatal(err)
	}
	for _, query := range []string{
		"SELECT count(*) FROM species WHERE description = 'Ein Röhrling.' AND edibility_note = 'Geprüft: essbar.'",
		"SELECT count(*) FROM species_part_note WHERE description = 'Braun.' AND comment = 'Notiz.'",
		"SELECT count(*) FROM species_colour WHERE name = 'dunkelbraun' AND species_id = " + steinpilz,
		"SELECT count(*) FROM species_reaction WHERE reading = 'zuerst gelb, dann olivgrün'",
		"SELECT count(*) FROM glossary_entry WHERE definition_en = 'A broadleaf tree. Checked.'",
	} {
		if n, err := db.Scalar[int](ctx, handle, query); err != nil || n != 1 {
			t.Fatalf("%s: %d %v", query, n, err)
		}
	}
	again := t.TempDir()
	if _, err := Export(ctx, handle, data, again); err != nil {
		t.Fatal(err)
	}
	for _, name := range []string{"arten/steinpilz.toml", importer.ReactionsFile, texts.GlossaryFile} {
		first, _ := os.ReadFile(filepath.Join(out, name))
		second, _ := os.ReadFile(filepath.Join(again, name))
		if string(first) != string(second) {
			t.Errorf("%s:\n%s", name, firstDifference(string(second), string(first)))
		}
	}
}

func TestExportFollowsDeletedSpeciesAndLookalikes(t *testing.T) {
	handle := seeded(t)
	ctx := context.Background()
	if _, err := handle.ExecContext(ctx, "DELETE FROM species WHERE slug = 'tylopilus-felleus'"); err != nil {
		t.Fatal(err)
	}
	out, report := export(t, handle)
	if _, err := os.Stat(filepath.Join(out, "arten", "gallenroehrling.toml")); !os.IsNotExist(err) {
		t.Fatal("the profile of the deleted species stays")
	}
	body, err := os.ReadFile(filepath.Join(out, "arten", "steinpilz.toml"))
	if err != nil {
		t.Fatal(err)
	}
	if strings.Contains(string(body), "gallenroehrling") || !strings.Contains(string(body), "gelbfleckiger-steinpilz") {
		t.Fatalf("lookalikes: %s", body)
	}
	if report.Species != len(seedFiles(t))-3 {
		t.Fatalf("species %d", report.Species)
	}
}

func TestExportRefusesAnEmptyDatabase(t *testing.T) {
	if _, err := Export(context.Background(), openDB(t), seedData(t), t.TempDir()); err == nil {
		t.Fatal("an empty database gave an export")
	}
}

func TestExportWarnsAboutDataWithoutSeedForm(t *testing.T) {
	handle := seeded(t)
	ctx := context.Background()
	if _, err := handle.ExecContext(ctx, "INSERT INTO species_part_feature (species_id, part, feature, phase) VALUES ("+
		steinpilz+", 'cap', 'umbonate', 'young')"); err != nil {
		t.Fatal(err)
	}
	_, report := export(t, handle)
	if len(report.Warnings) != 1 || !strings.HasPrefix(report.Warnings[0], "steinpilz: cap features differ") {
		t.Fatalf("warnings: %v", report.Warnings)
	}
}
