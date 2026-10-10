package importer

import (
	"context"
	"database/sql"
	"testing"
	"testing/fstest"
)

func forecastOn(t *testing.T, handle *sql.DB, slug string) bool {
	t.Helper()
	return count(t, handle, "SELECT count(*) FROM species WHERE slug = ? AND forecast_enabled", slug) == 1
}

func withKarte(files fstest.MapFS) fstest.MapFS {
	files["arten/butterpilz.toml"] = &fstest.MapFile{Data: []byte(smallProfile("Butterpilz", "Suillus luteus", `karte = "suillus_luteus"`))}
	return files
}

func exec(t *testing.T, handle *sql.DB, statements ...string) {
	t.Helper()
	for _, s := range statements {
		if _, err := handle.ExecContext(context.Background(), s); err != nil {
			t.Fatal(err)
		}
	}
}

func TestTheImportStoresTheForecastFlags(t *testing.T) {
	handle := openDB(t)
	seed(t, handle, withKarte(smallData("")))
	if !forecastOn(t, handle, "suillus-luteus") || forecastOn(t, handle, "boletus-edulis") {
		t.Fatal("flags of the import")
	}
	if n := count(t, handle, "SELECT count(*) FROM seed_digest WHERE name LIKE 'arten/%#karte'"); n != 4 {
		t.Fatalf("digests %d", n)
	}
}

func TestAnUpgradeTurnsOnTheNewForecastsAndKeepsTheAdminFlags(t *testing.T) {
	handle := openDB(t)
	seed(t, handle, smallData(""))
	exec(t, handle, "UPDATE species SET forecast_enabled = TRUE WHERE slug = 'boletus-edulis'", "DELETE FROM seed_digest")
	seed(t, handle, withKarte(smallData("")))
	if !forecastOn(t, handle, "suillus-luteus") {
		t.Fatal("the new forecast is off")
	}
	if !forecastOn(t, handle, "boletus-edulis") {
		t.Fatal("the sync turned off a forecast that an admin turned on")
	}
}

func TestAnUnchangedKarteKeepsTheFlagOfAnAdmin(t *testing.T) {
	handle := openDB(t)
	seed(t, handle, smallData(""))
	seed(t, handle, withKarte(smallData("")))
	if !forecastOn(t, handle, "suillus-luteus") {
		t.Fatal("added karte")
	}
	exec(t, handle, "UPDATE species SET forecast_enabled = FALSE WHERE slug = 'suillus-luteus'")
	seed(t, handle, withKarte(smallData("")))
	if forecastOn(t, handle, "suillus-luteus") {
		t.Fatal("an unchanged file turned on a flag that an admin turned off")
	}
	seed(t, handle, smallData(""))
	if forecastOn(t, handle, "suillus-luteus") {
		t.Fatal("removed karte")
	}
}

func ringOf(t *testing.T, handle *sql.DB, slug string) string {
	t.Helper()
	var shape sql.NullString
	if err := handle.QueryRowContext(context.Background(), "SELECT ring_shape FROM species WHERE slug = ?", slug).Scan(&shape); err != nil {
		t.Fatal(err)
	}
	return shape.String
}

func TestAnUpgradeFillsOnlyAnEmptyRingShape(t *testing.T) {
	handle := openDB(t)
	seed(t, handle, smallData(""))
	exec(t, handle, "UPDATE species SET ring_shape = 'double' WHERE slug = 'boletus-edulis'", "DELETE FROM seed_digest")
	files := smallData("")
	files["arten/butterpilz.toml"] = &fstest.MapFile{Data: []byte(smallProfile("Butterpilz", "Suillus luteus", `ringform = "haengend"`))}
	files["arten/steinpilz.toml"] = &fstest.MapFile{Data: []byte(smallProfile("Steinpilz", "Boletus edulis", `ringform = "ringzone"`))}
	seed(t, handle, files)
	if got := ringOf(t, handle, "suillus-luteus"); got != "pendant" {
		t.Fatalf("empty field %q", got)
	}
	if got := ringOf(t, handle, "boletus-edulis"); got != "double" {
		t.Fatalf("the sync changed the value of an admin: %q", got)
	}
	files["arten/butterpilz.toml"] = &fstest.MapFile{Data: []byte(smallProfile("Butterpilz", "Suillus luteus", `ringform = "doppelt"`))}
	seed(t, handle, files)
	if got := ringOf(t, handle, "suillus-luteus"); got != "double" {
		t.Fatalf("changed file %q", got)
	}
}

func TestAnUpgradeKeepsAForecastThatAnAdminTurnedOff(t *testing.T) {
	handle := openDB(t)
	seed(t, handle, withKarte(smallData("")))
	exec(t, handle,
		"INSERT INTO species_forecast (species_id, chain_key, taxa) SELECT id, 'suillus_luteus', '[]' FROM species WHERE slug = 'suillus-luteus'",
		"UPDATE species SET forecast_enabled = FALSE WHERE slug = 'suillus-luteus'",
		"DELETE FROM seed_digest")
	seed(t, handle, withKarte(smallData("")))
	if forecastOn(t, handle, "suillus-luteus") {
		t.Fatal("the first sync turned on a forecast of a species with a chain row")
	}
}

func TestAnUpgradeKeepsTheForecastOfAnEditedSpecies(t *testing.T) {
	handle := openDB(t)
	seed(t, handle, smallData(""))
	exec(t, handle,
		"INSERT INTO user (id, sub, name, created_at) VALUES ('0123456789abcdef0123456789abcdef', 'sub', 'Admin', '2026-01-01 00:00:00')",
		"UPDATE species SET updated_by_id = '0123456789abcdef0123456789abcdef' WHERE slug = 'suillus-luteus'",
		"DELETE FROM seed_digest")
	seed(t, handle, withKarte(smallData("")))
	if forecastOn(t, handle, "suillus-luteus") {
		t.Fatal("the first sync changed a species that an admin edited")
	}
}

func TestARemovedKarteTurnsTheForecastOff(t *testing.T) {
	handle := openDB(t)
	seed(t, handle, withKarte(smallData("")))
	seed(t, handle, smallData(""))
	if forecastOn(t, handle, "suillus-luteus") {
		t.Fatal("the forecast stays without karte")
	}
}

func TestAnUnknownRingformKeepsTheRingShape(t *testing.T) {
	handle := openDB(t)
	files := smallData("")
	files["arten/butterpilz.toml"] = &fstest.MapFile{Data: []byte(smallProfile("Butterpilz", "Suillus luteus", `ringform = "haengend"`))}
	seed(t, handle, files)
	files["arten/butterpilz.toml"] = &fstest.MapFile{Data: []byte(smallProfile("Butterpilz", "Suillus luteus", `ringform = "spiralig"`))}
	seed(t, handle, files)
	if got := ringOf(t, handle, "suillus-luteus"); got != "pendant" {
		t.Fatalf("an unknown value changed the ring shape: %q", got)
	}
	files["arten/butterpilz.toml"] = &fstest.MapFile{Data: []byte(smallProfile("Butterpilz", "Suillus luteus", ""))}
	seed(t, handle, files)
	if got := ringOf(t, handle, "suillus-luteus"); got != "" {
		t.Fatalf("a removed ringform stays: %q", got)
	}
}
