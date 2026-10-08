package catalog_test

import (
	"net/http"
	"strings"
	"testing"

	"github.com/frederikbeimgraben/kinoko/backend/internal/core/db"
	"github.com/frederikbeimgraben/kinoko/backend/internal/testkit"
)

func addReactionSource(t *testing.T, env *testkit.Env, key, label string, url, year *string) db.ID {
	id := db.NewID()
	exec(t, env, `INSERT INTO reaction_source (id, "key", label, url, year) VALUES (?, ?, ?, ?, ?)`, id, key, label, url, year)
	return id
}

type reaction struct {
	position        int
	reagent         term
	reading         string
	part, location  *string
	result          string
	colourName      *string
	colourHex       *string
	contested       bool
	partlyConfirmed bool
	sources         []db.ID
}

func addReaction(t *testing.T, env *testkit.Env, s species, r reaction) {
	exec(t, env, `INSERT INTO species_reaction (species_id, position, term_id, reading, part, location, result,
		colour_name, colour_hex, contested, partly_confirmed) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
		s.ID, r.position, r.reagent.ID, r.reading, r.part, r.location, r.result, r.colourName, r.colourHex,
		r.contested, r.partlyConfirmed)
	for _, source := range r.sources {
		exec(t, env, "INSERT INTO species_reaction_source (species_id, position, source_id) VALUES (?, ?, ?)",
			s.ID, r.position, source)
	}
}

func seedReactions(t *testing.T, env *testkit.Env) species {
	porcini := makeSpecies(t, env, "boletus-edulis", "Steinpilz", "Boletus edulis", nil, nil)
	koh := makeTerm(t, env, "trigger", "koh", "Kalilauge", ptr("reagent"), 0)
	iron := makeTerm(t, env, "trigger", "feso4", "Eisensulfat", ptr("reagent"), 1)
	book := addReactionSource(t, env, "book", "Pilzbuch", nil, ptr("1999"))
	site := addReactionSource(t, env, "site", "123pilzsuche", ptr("https://example.test"), nil)
	addReaction(t, env, porcini, reaction{position: 1, reagent: iron, reading: "FeSO4 negativ", result: "negative",
		sources: []db.ID{site}})
	addReaction(t, env, porcini, reaction{position: 0, reagent: koh, reading: "KOH auf Huthaut gelb",
		part: ptr("cap"), location: ptr("Huthaut"), result: "positive", colourName: ptr("gelb"),
		colourHex: ptr("#e0b446"), contested: true, partlyConfirmed: true, sources: []db.ID{book, site}})
	return porcini
}

const wantReactions = `[{"reagent":{"slug":"koh","name":"Kalilauge"},"reading":"KOH auf Huthaut gelb","part":"cap",` +
	`"location":"Huthaut","result":"positive","colour":{"name":"gelb","hex":"#e0b446"},"contested":true,` +
	`"partlyConfirmed":true,"sources":[{"label":"Pilzbuch","url":null,"year":"1999"},` +
	`{"label":"123pilzsuche","url":"https://example.test","year":null}]},` +
	`{"reagent":{"slug":"feso4","name":"Eisensulfat"},"reading":"FeSO4 negativ","part":null,"location":null,` +
	`"result":"negative","colour":null,"contested":false,"partlyConfirmed":false,` +
	`"sources":[{"label":"123pilzsuche","url":"https://example.test","year":null}]}]`

func reactionsJSON(t *testing.T, env *testkit.Env, slug string) string {
	t.Helper()
	body := string(env.Get("/species/"+slug, nil).Expect(t, http.StatusOK).Body)
	_, after, found := strings.Cut(body, `"reactions":`)
	if !found {
		t.Fatal(body)
	}
	return after[:len(after)-1]
}

func TestProfileShowsReactionsInPositionOrder(t *testing.T) {
	env := newEnv(t)
	porcini := seedReactions(t, env)
	if got := reactionsJSON(t, env, porcini.Slug); got != wantReactions {
		t.Fatalf("got  %s\nwant %s", got, wantReactions)
	}
}

func TestSpeciesWriteKeepsReactions(t *testing.T) {
	env := newEnv(t)
	porcini := seedReactions(t, env)
	body := env.Put("/species/"+porcini.Slug, writePayload(map[string]any{"name": "Herrenpilz"}), &editor).
		Expect(t, http.StatusOK).Map(t)
	if len(list(body["reactions"])) != 2 {
		t.Fatal(body["reactions"])
	}
	if got := reactionsJSON(t, env, porcini.Slug); got != wantReactions {
		t.Fatal(got)
	}
}

func TestBundleCountsReactionsWithoutTheirRows(t *testing.T) {
	env := newEnv(t)
	porcini := seedReactions(t, env)
	makeSpecies(t, env, "amanita-muscaria", "Fliegenpilz", "Amanita muscaria", nil, nil)
	tag := env.Get("/species/bundle", nil).Header.Get("ETag")
	counts := map[string]any{}
	for _, item := range items(bundleOf(t, env)) {
		if _, ok := item["reactions"]; ok {
			t.Fatal("the bundle has reaction rows")
		}
		counts[item["slug"].(string)] = item["reactionCount"]
	}
	equalJSON(t, counts, `{"amanita-muscaria":0,"boletus-edulis":2}`)

	exec(t, env, "DELETE FROM species_reaction WHERE species_id = ? AND position = 1", porcini.ID)
	if getWithTag(env, tag).Expect(t, http.StatusOK).Header.Get("ETag") == tag {
		t.Fatal("the tag does not follow the reactions")
	}
}

func TestMergeTermMovesReactions(t *testing.T) {
	env := newEnv(t)
	porcini := seedReactions(t, env)
	potash := makeTerm(t, env, "trigger", "kalilauge", "Kalilauge 20 %", ptr("reagent"), 2)
	koh := scalar[db.ID](t, env, "SELECT id FROM term WHERE slug = 'koh'")
	env.Post("/terms/"+koh.String()+"/merge", map[string]any{"into": potash.ID.String()}, &editor).
		Expect(t, http.StatusNoContent)
	first := obj(list(profileOf(t, env, porcini.Slug)["reactions"])[0])
	if obj(first["reagent"])["slug"] != "kalilauge" {
		t.Fatal(first)
	}
}

func TestDeleteSpeciesRemovesItsReactions(t *testing.T) {
	env := newEnv(t)
	porcini := seedReactions(t, env)
	env.Delete("/species/"+porcini.Slug, &editor).Expect(t, http.StatusNoContent)
	if n := scalar[int](t, env, "SELECT count(*) FROM species_reaction_source"); n != 0 {
		t.Fatal(n)
	}
}
