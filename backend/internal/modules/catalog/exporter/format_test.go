package exporter

import (
	"io/fs"
	"testing"

	"github.com/frederikbeimgraben/kinoko/backend/internal/modules/catalog/importer"
)

func TestFormatGivesEachSeedFileBack(t *testing.T) {
	data := seedData(t)
	names, err := fs.Glob(data, "arten/*.toml")
	if err != nil || len(names) == 0 {
		t.Fatal(names, err)
	}
	for _, name := range names {
		body, err := fs.ReadFile(data, name)
		if err != nil {
			t.Fatal(err)
		}
		parsed, err := ParseFile(string(body), name)
		if err != nil {
			t.Fatal(err)
		}
		if got := string(Format(parsed)); got != string(body) {
			t.Errorf("%s:\n%s", name, firstDifference(got, string(body)))
		}
	}
}

func TestParseRefusesUnknownKeys(t *testing.T) {
	if _, err := ParseFile("name = \"A\"\nneu = 1\n", "a.toml"); err == nil {
		t.Fatal("unknown key accepted")
	}
}

func TestQuoteEscapes(t *testing.T) {
	if got := quote("a\"b\\c\nd"); got != `"a\"b\\c\nd"` {
		t.Fatal(got)
	}
}

func TestDescriptionWritesTheEnglishTextAndTheDraftFlag(t *testing.T) {
	cases := []struct {
		row     importer.SpeciesRow
		base    *bool
		english string
		draft   string
	}{
		{importer.SpeciesRow{DescriptionEn: "A mushroom.", DescriptionDraft: true}, nil, "A mushroom.", "true"},
		{importer.SpeciesRow{}, nil, "", "none"},
		{importer.SpeciesRow{}, new(true), "", "false"},
	}
	for _, c := range cases {
		english, draft := description(c.row, File{Entwurf: c.base})
		gotEnglish, gotDraft := "", "none"
		if english != nil {
			gotEnglish = *english
		}
		if draft != nil {
			gotDraft = map[bool]string{true: "true", false: "false"}[*draft]
		}
		if gotEnglish != c.english || gotDraft != c.draft {
			t.Fatalf("%+v: %q %s", c.row, gotEnglish, gotDraft)
		}
	}
}
