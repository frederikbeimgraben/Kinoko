package catalog_test

import (
	"encoding/json"
	"net/http"
	"testing"
)

func reactionsOf(t *testing.T, raw string) []any {
	t.Helper()
	var out []any
	if err := json.Unmarshal([]byte(raw), &out); err != nil {
		t.Fatal(err)
	}
	return out
}

func TestSpeciesWriteStoresTheReactionsOfTheProfileUnchanged(t *testing.T) {
	env := newEnv(t)
	porcini := seedReactions(t, env)
	env.Put("/species/"+porcini.Slug, writePayload(map[string]any{
		"reactions": reactionsOf(t, wantReactions),
	}), &editor).Expect(t, http.StatusOK)
	if got := reactionsJSON(t, env, porcini.Slug); got != wantReactions {
		t.Fatalf("got  %s\nwant %s", got, wantReactions)
	}
	if n := scalar[int](t, env, "SELECT count(*) FROM reaction_source"); n != 2 {
		t.Fatal(n)
	}
}

func TestSpeciesWriteReplacesReactionsAndAddsANewSource(t *testing.T) {
	env := newEnv(t)
	porcini := seedReactions(t, env)
	body := env.Put("/species/"+porcini.Slug, writePayload(map[string]any{
		"reactions": []any{map[string]any{
			"reagent": map[string]any{"slug": "feso4", "name": ""}, "reading": "FeSO4 grün", "part": "flesh",
			"location": nil, "result": "positive", "colour": map[string]any{"name": "grün", "hex": "#4a7a3a"},
			"contested": false, "partlyConfirmed": true,
			"sources": []any{
				map[string]any{"label": "Pilzbuch", "url": nil, "year": "1999"},
				map[string]any{"label": "Eigene Probe", "url": nil, "year": "2026"},
			},
		}},
	}), &editor).Expect(t, http.StatusOK).Map(t)
	reactions := list(body["reactions"])
	if len(reactions) != 1 {
		t.Fatal(reactions)
	}
	one := obj(reactions[0])
	if obj(one["reagent"])["name"] != "Eisensulfat" || one["part"] != "flesh" || obj(one["colour"])["hex"] != "#4a7a3a" {
		t.Fatal(one)
	}
	equalJSON(t, one["sources"], `[{"label":"Pilzbuch","url":null,"year":"1999"},{"label":"Eigene Probe","url":null,"year":"2026"}]`)
	if n := scalar[int](t, env, "SELECT count(*) FROM reaction_source"); n != 3 {
		t.Fatal(n)
	}
	if n := scalar[int](t, env, `SELECT count(*) FROM reaction_source WHERE "key" LIKE 'eigene-probe-%'`); n != 1 {
		t.Fatal(n)
	}
}

func TestSpeciesWriteWithEmptyReactionsRemovesThem(t *testing.T) {
	env := newEnv(t)
	porcini := seedReactions(t, env)
	body := env.Put("/species/"+porcini.Slug, writePayload(map[string]any{"reactions": []any{}}), &editor).
		Expect(t, http.StatusOK).Map(t)
	if len(list(body["reactions"])) != 0 {
		t.Fatal(body["reactions"])
	}
}

func TestSpeciesWriteRejectsAnUnknownReagent(t *testing.T) {
	env := newEnv(t)
	porcini := seedReactions(t, env)
	env.Put("/species/"+porcini.Slug, writePayload(map[string]any{
		"reactions": []any{map[string]any{
			"reagent": map[string]any{"slug": "unbekannt", "name": ""}, "reading": "x", "part": nil, "location": nil,
			"result": "negative", "colour": nil, "contested": false, "partlyConfirmed": false, "sources": []any{},
		}},
	}), &editor).Expect(t, http.StatusUnprocessableEntity)
	if got := reactionsJSON(t, env, porcini.Slug); got != wantReactions {
		t.Fatal(got)
	}
}

func TestSpeciesWriteSetsAndClearsTheDraftFlag(t *testing.T) {
	env := newEnv(t)
	created := env.Post("/species", writePayload(map[string]any{"descriptionDraft": true}), &editor).
		Expect(t, http.StatusCreated).Map(t)
	if created["descriptionDraft"] != true {
		t.Fatal(created)
	}
	slug, _ := created["slug"].(string)
	cleared := env.Put("/species/"+slug, writePayload(map[string]any{"descriptionDraft": false}), &editor).
		Expect(t, http.StatusOK).Map(t)
	if cleared["descriptionDraft"] != false {
		t.Fatal(cleared)
	}
}
