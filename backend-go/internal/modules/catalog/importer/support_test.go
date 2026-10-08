package importer

import (
	"context"
	"database/sql"
	"io/fs"
	"path/filepath"
	"testing"
	"testing/fstest"
	"time"

	backend "github.com/frederikbeimgraben/kinoko/backend"
	"github.com/frederikbeimgraben/kinoko/backend/internal/core/db"
)

var fixedNow = func() time.Time { return time.Date(2026, 1, 2, 3, 4, 5, 0, time.UTC) }

func openDB(t testing.TB) *sql.DB {
	t.Helper()
	handle, err := db.Open(filepath.Join(t.TempDir(), "pilze.sqlite"))
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { handle.Close() })
	if err := db.Migrate(context.Background(), handle); err != nil {
		t.Fatal(err)
	}
	return handle
}

func realData(t testing.TB) fs.FS {
	t.Helper()
	data, err := fs.Sub(backend.Data, "daten")
	if err != nil {
		t.Fatal(err)
	}
	return data
}

func speciesFileCount(t testing.TB) int {
	t.Helper()
	names, err := fs.Glob(realData(t), "arten/*.toml")
	if err != nil {
		t.Fatal(err)
	}
	return len(names)
}

func count(t testing.TB, handle *sql.DB, query string, args ...any) int {
	t.Helper()
	n, err := db.Scalar[int](context.Background(), handle, query, args...)
	if err != nil {
		t.Fatal(err)
	}
	return n
}

func ptr[T any](v T) *T { return &v }

// testProfile is the smallest valid profile, as _profile() in the old tests.
func testProfile(change func(*Profile)) Profile {
	p := Profile{
		Name:       "Testpilz",
		Lateinisch: "Testus fungus",
		Gruppe:     "roehrling",
		Speisewert: "essbar",
		Schutz:     ProtectionEntry{Status: "keiner"},
		Quelle:     SourceEntry{URL: "https://example.test/a", GeprueftAm: "2026-01-01"},
	}
	if change != nil {
		change(&p)
	}
	return p
}

func testContext(p Profile, change func(*Context)) Context {
	ctx := Context{
		Stem:       "testpilz",
		Profile:    p,
		SpeciesID:  db.NewID(),
		Slug:       "testus-fungus",
		GenusIDs:   map[string]db.ID{},
		Terms:      NewTerms(nil),
		Colours:    map[string]string{},
		SpeciesIDs: map[string]db.ID{},
		Report:     NewReport(),
		SeenPairs:  map[[2]db.ID]bool{},
	}
	if change != nil {
		change(&ctx)
	}
	return ctx
}

const smallTaxonomy = `{"taxa": [
 {"slug": "boletaceae", "rang": "familie", "lateinisch": "Boletaceae", "name": "Dickröhrlingsverwandte", "elter": null},
 {"slug": "boletus", "rang": "gattung", "lateinisch": "Boletus", "name": "Dickröhrlinge", "elter": "boletaceae"}
]}`

func smallProfile(name, latin, extra string) string {
	return `name = "` + name + `"
lateinisch = "` + latin + `"
gruppe = "roehrling"
speisewert = "essbar"
marktfaehig = false
` + extra + `
[schutz]
status = "keiner"

[quelle]
url = "https://www.example.test/` + name + `"
geprueftAm = "2026-01-01"

[farben]
hut = [{ name = "braun", hex = "#7a5230" }, { name = "olivgrün", hex = "#6f8438" }]
fleisch = [{ name = "weiß", hex = "#ffffff" }, { name = "blau", hex = "#2f5fa8" }]
`
}

// smallData is a data folder with four species and the given reactions.
func smallData(reactions string) fstest.MapFS {
	files := fstest.MapFS{
		"taxonomie.json":                             {Data: []byte(smallTaxonomy)},
		"arten/steinpilz.toml":                       {Data: []byte(smallProfile("Steinpilz", "Boletus edulis", `synonyme = ["Boletus bulbosus"]`))},
		"arten/braetling.toml":                       {Data: []byte(smallProfile("Brätling", "Lactarius volemus", ""))},
		"arten/flockenstieliger-hexenroehrling.toml": {Data: []byte(smallProfile("Flockenstieliger Hexenröhrling", "Neoboletus erythropus", ""))},
		"arten/butterpilz.toml":                      {Data: []byte(smallProfile("Butterpilz", "Suillus luteus", ""))},
	}
	if reactions != "" {
		files[ReactionsFile] = &fstest.MapFile{Data: []byte(reactions)}
	}
	return files
}
