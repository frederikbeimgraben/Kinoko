package importer

import (
	"context"
	"database/sql"
	"testing"
	"testing/fstest"

	"github.com/frederikbeimgraben/kinoko/backend/internal/core/db"
)

func TestParseProfileReadsTheDescriptionsAndTheDraftFlag(t *testing.T) {
	p, err := ParseProfile(`name = "X"
lateinisch = "X y"
beschreibung = "Ein Pilz."
beschreibungEn = "A mushroom."
entwurf = true
`, "x.toml")
	if err != nil {
		t.Fatal(err)
	}
	if p.Beschreibung == nil || *p.Beschreibung != "Ein Pilz." || p.BeschreibungEn == nil ||
		*p.BeschreibungEn != "A mushroom." || !p.Entwurf {
		t.Fatalf("%+v", p)
	}
	bare, err := ParseProfile("name = \"X\"\nlateinisch = \"X y\"\n", "x.toml")
	if err != nil {
		t.Fatal(err)
	}
	if bare.Beschreibung != nil || bare.BeschreibungEn != nil || bare.Entwurf {
		t.Fatalf("%+v", bare)
	}
}

func TestSpeciesRowTakesTheDescriptions(t *testing.T) {
	row, _, err := BuildSpecies(testContext(testProfile(func(p *Profile) {
		p.Beschreibung, p.BeschreibungEn, p.Entwurf = ptr("Ein Pilz."), ptr("A mushroom."), true
	}), nil))
	if err != nil {
		t.Fatal(err)
	}
	if *row.Description != "Ein Pilz." || row.DescriptionEn != "A mushroom." || !row.DescriptionDraft {
		t.Fatalf("%+v", row)
	}
	row, _, err = BuildSpecies(testContext(testProfile(nil), nil))
	if err != nil {
		t.Fatal(err)
	}
	if row.Description != nil || row.DescriptionEn != "" || row.DescriptionDraft {
		t.Fatalf("%+v", row)
	}
}

type storedDescription struct {
	german  *string
	english string
	draft   bool
}

func descriptionOf(t *testing.T, handle *sql.DB, slug string) storedDescription {
	t.Helper()
	d, err := db.One(context.Background(), handle, func(s db.Scanner) (storedDescription, error) {
		var d storedDescription
		return d, s.Scan(&d.german, &d.english, &d.draft)
	}, "SELECT description, description_en, description_draft FROM species WHERE slug = ?", slug)
	if err != nil {
		t.Fatal(err)
	}
	return d
}

func withDescribedButterpilz(files fstest.MapFS, extra string) fstest.MapFS {
	files["arten/butterpilz.toml"] = &fstest.MapFile{Data: []byte(smallProfile("Butterpilz", "Suillus luteus", extra))}
	return files
}

func TestTheImportWritesTheDescriptionsAndTheDigests(t *testing.T) {
	handle := openDB(t)
	seed(t, handle, withDescribedButterpilz(smallData(""),
		"beschreibung = \"Ein Pilz.\"\nbeschreibungEn = \"A mushroom.\"\nentwurf = true"))
	got := descriptionOf(t, handle, "suillus-luteus")
	if got.german == nil || *got.german != "Ein Pilz." || got.english != "A mushroom." || !got.draft {
		t.Fatalf("%+v", got)
	}
	if n := count(t, handle, "SELECT count(*) FROM seed_digest WHERE name LIKE 'arten/%#beschreibung'"); n != 4 {
		t.Fatalf("digests %d", n)
	}
}

func TestAChangedSpeciesFileUpdatesTheDescriptionOnTheNextStart(t *testing.T) {
	handle := openDB(t)
	ctx := context.Background()
	seed(t, handle, smallData(""))
	for _, change := range []string{
		"UPDATE species SET edibility_note = 'geprüft' WHERE slug IN ('suillus-luteus', 'boletus-edulis')",
		"UPDATE species SET description = 'Von Hand.' WHERE slug = 'boletus-edulis'",
	} {
		if _, err := handle.ExecContext(ctx, change); err != nil {
			t.Fatal(err)
		}
	}
	seed(t, handle, withDescribedButterpilz(smallData(""),
		"beschreibung = \"Ein Pilz.\"\nbeschreibungEn = \"A mushroom.\"\nentwurf = true"))
	got := descriptionOf(t, handle, "suillus-luteus")
	if got.german == nil || *got.german != "Ein Pilz." || got.english != "A mushroom." || !got.draft {
		t.Fatalf("changed file %+v", got)
	}
	if n := count(t, handle, "SELECT count(*) FROM species WHERE edibility_note = 'geprüft'"); n != 2 {
		t.Fatal("the sync changed a field other than the description")
	}
	if kept := descriptionOf(t, handle, "boletus-edulis"); kept.german == nil || *kept.german != "Von Hand." {
		t.Fatalf("unchanged file %+v", kept)
	}
}

func TestAnUnchangedSpeciesFileKeepsTheDescriptionOfTheDatabase(t *testing.T) {
	handle := openDB(t)
	ctx := context.Background()
	files := withDescribedButterpilz(smallData(""), "beschreibung = \"Ein Pilz.\"")
	seed(t, handle, files)
	if _, err := handle.ExecContext(ctx, "UPDATE species SET description = 'Geprüft.' WHERE slug = 'suillus-luteus'"); err != nil {
		t.Fatal(err)
	}
	seed(t, handle, files)
	if got := descriptionOf(t, handle, "suillus-luteus"); got.german == nil || *got.german != "Geprüft." {
		t.Fatalf("%+v", got)
	}
}

func TestAnEditedDescriptionStaysWhenTheFileChanges(t *testing.T) {
	handle := openDB(t)
	ctx := context.Background()
	seed(t, handle, withDescribedButterpilz(smallData(""), "beschreibung = \"Ein Pilz.\"\nentwurf = true"))
	if _, err := handle.ExecContext(ctx,
		"UPDATE species SET description = 'Geprüft.', description_draft = FALSE WHERE slug = 'suillus-luteus'"); err != nil {
		t.Fatal(err)
	}
	seed(t, handle, withDescribedButterpilz(smallData(""), "beschreibung = \"Ein anderer Pilz.\"\nentwurf = true"))
	if got := descriptionOf(t, handle, "suillus-luteus"); got.german == nil || *got.german != "Geprüft." || got.draft {
		t.Fatalf("%+v", got)
	}
}

func TestADescriptionSyncWithoutStoredDigestsFillsOnlyAnEmptyDescription(t *testing.T) {
	handle := openDB(t)
	ctx := context.Background()
	files := withDescribedButterpilz(smallData(""), "beschreibung = \"Ein Pilz.\"")
	files["arten/steinpilz.toml"] = &fstest.MapFile{Data: []byte(smallProfile("Steinpilz", "Boletus edulis",
		"beschreibung = \"Ein Röhrling.\""))}
	seed(t, handle, files)
	for _, change := range []string{
		"UPDATE species SET description = NULL WHERE slug = 'suillus-luteus'",
		"UPDATE species SET description = 'Von Hand.' WHERE slug = 'boletus-edulis'",
		"DELETE FROM seed_digest",
	} {
		if _, err := handle.ExecContext(ctx, change); err != nil {
			t.Fatal(err)
		}
	}
	seed(t, handle, files)
	if got := descriptionOf(t, handle, "suillus-luteus"); got.german == nil || *got.german != "Ein Pilz." {
		t.Fatalf("empty %+v", got)
	}
	if got := descriptionOf(t, handle, "boletus-edulis"); got.german == nil || *got.german != "Von Hand." {
		t.Fatalf("a description of the database changed: %+v", got)
	}
	if n := count(t, handle, "SELECT count(*) FROM seed_digest WHERE name LIKE 'arten/%#beschreibung'"); n != 2 {
		t.Fatalf("digests %d", n)
	}
}

func TestARemovedAndAddedDescriptionStillSyncs(t *testing.T) {
	handle := openDB(t)
	seed(t, handle, withDescribedButterpilz(smallData(""), "beschreibung = \"Ein Pilz.\""))
	seed(t, handle, smallData(""))
	if got := descriptionOf(t, handle, "suillus-luteus"); got.german == nil || *got.german != "Ein Pilz." {
		t.Fatalf("a file without beschreibung changed the description: %+v", got)
	}
	seed(t, handle, withDescribedButterpilz(smallData(""), "beschreibung = \"Ein neuer Pilz.\""))
	if got := descriptionOf(t, handle, "suillus-luteus"); got.german == nil || *got.german != "Ein neuer Pilz." {
		t.Fatalf("the description added again did not sync: %+v", got)
	}
}
