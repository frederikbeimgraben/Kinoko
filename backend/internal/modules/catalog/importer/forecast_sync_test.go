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
