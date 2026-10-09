package importer

import (
	"context"
	"database/sql"
	"encoding/json"
	"testing"
	"testing/fstest"

	"github.com/frederikbeimgraben/kinoko/backend/internal/core/db"
)

type reaction = map[string]any

func reactionsJSON(t *testing.T, reactions []reaction, sources []map[string]any) string {
	t.Helper()
	body, err := json.Marshal(map[string]any{"groups": []any{}, "reactions": reactions, "sources": sources})
	if err != nil {
		t.Fatal(err)
	}
	return string(body)
}

func entry(latin, reagent, reading, result string, partSlug any, sources ...string) reaction {
	if sources == nil {
		sources = []string{}
	}
	return reaction{
		"latin": latin, "germanName": "", "reagent": reagent, "reading": reading,
		"part": "Fleisch (Schnitt)", "partSlug": partSlug, "result": result,
		"contested": false, "partlyConfirmed": false, "sources": sources,
	}
}

var testSources = []map[string]any{
	{"id": "src-a", "label": "Quelle A", "url": "https://a.test", "year": "2013"},
	{"id": "src-b", "label": "Quelle B", "url": nil, "year": nil},
}

func seed(t *testing.T, handle *sql.DB, data fstest.MapFS) {
	t.Helper()
	if err := SeedIfEmpty(context.Background(), handle, data, fixedNow); err != nil {
		t.Fatal(err)
	}
}

type storedReaction struct {
	latin, reagent, reading, result string
	part, location                  *string
	colourName, colourHex           *string
	position                        int
}

func storedReactions(t *testing.T, handle *sql.DB) []storedReaction {
	t.Helper()
	rows, err := db.All(context.Background(), handle, func(s db.Scanner) (storedReaction, error) {
		var r storedReaction
		return r, s.Scan(&r.latin, &r.reagent, &r.reading, &r.result, &r.part, &r.location, &r.colourName, &r.colourHex, &r.position)
	}, `SELECT s.latin_name, t.slug, r.reading, r.result, r.part, r.location, r.colour_name, r.colour_hex, r.position
		FROM species_reaction r JOIN species s ON s.id = r.species_id JOIN term t ON t.id = r.term_id
		ORDER BY s.latin_name, r.position`)
	if err != nil {
		t.Fatal(err)
	}
	return rows
}

func TestReactionsMatchTheLatinNameAndTheSynonymWithoutCase(t *testing.T) {
	handle := openDB(t)
	seed(t, handle, smallData(reactionsJSON(t, []reaction{
		entry("boletus EDULIS", "koh", "Fleisch blau", "positive", "flesh", "src-a"),
		entry("Boletus bulbosus", "melzer", "braun", "positive", "nicht-teil", "src-a", "src-b", "src-a"),
		entry("Amanita muscaria", "koh", "gelb", "positive", "cap"),
	}, testSources)))
	got := storedReactions(t, handle)
	if len(got) != 2 {
		t.Fatalf("%+v", got)
	}
	first, second := got[0], got[1]
	if first.latin != "Boletus edulis" || first.reagent != "koh" || first.position != 0 || *first.part != "flesh" ||
		first.location != nil || *first.colourName != "blau" || *first.colourHex != "#2f5fa8" {
		t.Fatalf("first %+v", first)
	}
	if second.latin != "Boletus edulis" || second.position != 1 || *second.part != "flesh" || *second.colourName != "braun" {
		t.Fatalf("second %+v", second)
	}
	if n := count(t, handle, "SELECT count(*) FROM species_reaction_source WHERE position = 1"); n != 2 {
		t.Fatalf("sources of the second reaction %d", n)
	}
}

func TestReactionsUseTheTwoManualMatches(t *testing.T) {
	handle := openDB(t)
	seed(t, handle, smallData(reactionsJSON(t, []reaction{
		entry("Lactifluus volemus", "koh", "braun", "positive", "flesh"),
		entry("Neoboletus luridiformis", "feso4", "olivgrün", "positive", "flesh"),
	}, testSources)))
	got := storedReactions(t, handle)
	if len(got) != 2 || got[0].latin != "Lactarius volemus" || got[1].latin != "Neoboletus erythropus" {
		t.Fatalf("%+v", got)
	}
	if *got[1].colourName != "olivgrün" {
		t.Fatalf("colour %v", *got[1].colourName)
	}
}

func TestVariableRowTakesTheReadingsOfTheSameReagentAndPlace(t *testing.T) {
	handle := openDB(t)
	seed(t, handle, smallData(reactionsJSON(t, []reaction{
		entry("Boletus edulis", "koh", "orange vs. negativ", "variable", "flesh", "src-a"),
		entry("Boletus edulis", "koh", "orangerot", "positive", "flesh", "src-b"),
		entry("Boletus edulis", "melzer", "braun", "positive", "flesh", "src-b"),
	}, testSources)))
	got := storedReactions(t, handle)
	if len(got) != 2 || got[0].result != "variable" || got[1].reagent != "melzer" || got[1].position != 1 {
		t.Fatalf("%+v", got)
	}
	if n := count(t, handle, "SELECT count(*) FROM species_reaction_source WHERE position = 0"); n != 2 {
		t.Fatalf("sources of the variable reaction %d", n)
	}
}

func TestNegativeReactionHasNoColour(t *testing.T) {
	handle := openDB(t)
	seed(t, handle, smallData(reactionsJSON(t, []reaction{
		entry("Boletus edulis", "koh", "negativ, bleibt braun", "negative", nil),
		entry("Boletus edulis", "melzer", "keine deutliche Farbe", "variable", nil),
	}, testSources)))
	got := storedReactions(t, handle)
	if len(got) != 2 {
		t.Fatalf("%+v", got)
	}
	for _, r := range got {
		if r.colourName != nil || r.colourHex != nil {
			t.Fatalf("%+v", r)
		}
	}
}

func TestReactionSyncIsIdempotentAndTakesNewData(t *testing.T) {
	handle := openDB(t)
	first := reactionsJSON(t, []reaction{
		entry("Boletus edulis", "koh", "blau", "positive", "flesh", "src-a"),
		entry("Boletus edulis", "h2so4", "braun", "positive", "flesh", "src-b"),
		entry("Suillus luteus", "meixner", "blau", "positive", "flesh"),
	}, testSources)
	seed(t, handle, smallData(first))
	seed(t, handle, smallData(first))
	if n := count(t, handle, "SELECT count(*) FROM species_reaction"); n != 3 {
		t.Fatalf("reactions %d", n)
	}
	if n := count(t, handle, "SELECT count(*) FROM species_reaction_source"); n != 2 {
		t.Fatalf("links %d", n)
	}
	if n := count(t, handle, "SELECT count(*) FROM reaction_source"); n != 2 {
		t.Fatalf("sources %d", n)
	}
	if n := count(t, handle, "SELECT count(*) FROM term WHERE kind = 'trigger' AND slug IN ('h2so4', 'meixner') AND group_key = 'reagent'"); n != 2 {
		t.Fatalf("new reagent terms %d", n)
	}
	if n := count(t, handle, "SELECT count(*) FROM term WHERE name = 'Schwefelsäure (H2SO4)'"); n != 1 {
		t.Fatalf("term name %d", n)
	}

	changed := []map[string]any{{"id": "src-a", "label": "Quelle A2", "url": nil, "year": "2020"}}
	seed(t, handle, smallData(reactionsJSON(t, []reaction{
		entry("Boletus edulis", "koh", "rot", "positive", "cap", "src-a"),
	}, changed)))
	got := storedReactions(t, handle)
	if len(got) != 2 || got[0].reading != "rot" || got[1].latin != "Suillus luteus" {
		t.Fatalf("%+v", got)
	}
	if n := count(t, handle, "SELECT count(*) FROM reaction_source WHERE \"key\" = 'src-a' AND label = 'Quelle A2' AND url IS NULL AND year = '2020'"); n != 1 {
		t.Fatal("source not updated")
	}
}

func TestReactionsOfTheRealData(t *testing.T) {
	handle := openDB(t)
	data := realData(t)
	ctx := context.Background()
	if err := SeedIfEmpty(ctx, handle, data, fixedNow); err != nil {
		t.Fatal(err)
	}
	profiles, err := LoadProfiles(data)
	if err != nil {
		t.Fatal(err)
	}
	report, err := SyncReactions(ctx, handle, data, profiles)
	if err != nil {
		t.Fatal(err)
	}
	if report.Species < 40 || report.Reactions == 0 || len(report.UnknownReagent) != 0 || len(report.NewTerms) != 0 {
		t.Fatalf("%+v", report)
	}
	if count(t, handle, "SELECT count(*) FROM species_reaction") != report.Reactions {
		t.Fatal("rows differ from the report")
	}
	if count(t, handle, `SELECT count(*) FROM species_reaction r JOIN species s ON s.id = r.species_id WHERE s.slug = 'lactarius-volemus'`) == 0 {
		t.Fatal("manual match missing")
	}
	t.Logf("matched %d species, %d reactions, %d latin names without species", report.Species, report.Reactions, len(report.Unmatched))
}
