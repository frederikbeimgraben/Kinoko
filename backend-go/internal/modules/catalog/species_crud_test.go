package catalog_test

import (
	"context"
	"net/http"
	"slices"
	"strings"
	"testing"
	"time"

	"github.com/frederikbeimgraben/kinoko/backend/internal/core/db"
	"github.com/frederikbeimgraben/kinoko/backend/internal/modules/catalog"
	"github.com/frederikbeimgraben/kinoko/backend/internal/testkit"
)

func profileOf(t *testing.T, env *testkit.Env, slug string) map[string]any {
	t.Helper()
	return env.Get("/species/"+slug, nil).Expect(t, http.StatusOK).Map(t)
}

func list(v any) []any {
	out, _ := v.([]any)
	return out
}

func obj(v any) map[string]any {
	out, _ := v.(map[string]any)
	return out
}

func TestGetSpeciesProfileAssemblesAllChildRows(t *testing.T) {
	env := newEnv(t)
	porcini := makeSpecies(t, env, "boletus-edulis", "Steinpilz", "Boletus edulis", nil, nil)
	bay := makeSpecies(t, env, "boletus-badius", "Maronenröhrling", "Boletus badius", nil, nil)
	addName(t, env, porcini, 0, "Herrenpilz", "synonym")
	addMeasurement(t, env, porcini, "cap", "width", 4, 20)
	addColours(t, env, porcini, "cap", "distinct", colour{"braun", "#7a5230"})
	trigger := makeTerm(t, env, "trigger", "cut", "Anschnitt", nil, 0)
	addColourChange(t, env, porcini, 0, "flesh", "blau", "#3a6ea8", trigger)
	addPartFeature(t, env, porcini, "cap", "umbonate", "young")
	addPartFeature(t, env, porcini, "cap", "inrolled", "young")
	addPartFeature(t, env, porcini, "stem", "bulb", "old")
	addTrait(t, env, porcini, "cap", "Der Hut ist braun.")
	addSource(t, env, porcini, 0, "profile", "123pilzsuche", "https://example.test", "2025-01-01")
	addSeason(t, env, porcini, "summer")
	smell := makeTerm(t, env, "smell", "fruity", "fruchtig", nil, 0)
	addTerm(t, env, porcini, smell, true)
	addLookalike(t, env, porcini, bay, ptr("heller"), ptr("dunkler"))

	body := profileOf(t, env, porcini.Slug)
	equalJSON(t, body["names"], `[{"kind":"synonym","name":"Herrenpilz"}]`)
	if obj(list(body["measurements"])[0])["part"] != "cap" {
		t.Fatal(body["measurements"])
	}
	if obj(list(obj(list(body["colours"])[0])["colours"])[0])["nearest"] != "#6b4423" {
		t.Fatal(body["colours"])
	}
	change := obj(list(body["colourChanges"])[0])
	if obj(list(change["triggers"])[0])["slug"] != "cut" || change["kind"] != "mechanical" || change["from"] != nil {
		t.Fatal(change)
	}
	equalJSON(t, body["capFeatures"], `[{"feature":"umbonate","phase":"young"}]`)
	equalJSON(t, body["capMargins"], `[{"margin":"inrolled","phase":"young"}]`)
	equalJSON(t, body["stemFeatures"], `[{"feature":"bulb","phase":"old"}]`)
	equalJSON(t, body["traits"], `[{"key":"cap","text":"Der Hut ist braun."}]`)
	if obj(list(body["sources"])[0])["title"] != "123pilzsuche" || obj(list(body["sources"])[0])["checkedOn"] != "2025-01-01" {
		t.Fatal(body["sources"])
	}
	equalJSON(t, body["seasons"], `["summer"]`)
	if obj(list(body["terms"])[0])["fromExperience"] != true {
		t.Fatal(body["terms"])
	}
	look := obj(list(body["lookalikes"])[0])
	if look["slug"] != bay.Slug || look["difference"] != "dunkler" {
		t.Fatal(look)
	}
	other := obj(list(profileOf(t, env, bay.Slug)["lookalikes"])[0])
	if other["slug"] != porcini.Slug || other["difference"] != "heller" {
		t.Fatal(other)
	}
	equalJSON(t, body["reactions"], `[]`)
}

func TestGetSpecies404(t *testing.T) {
	env := newEnv(t)
	env.Get("/species/unknown-species", nil).Expect(t, http.StatusNotFound)
}

func writePayload(change map[string]any) map[string]any {
	body := map[string]any{
		"name": "Steinpilz", "scientificName": "Boletus edulis", "group": "bolete",
		"edibility": "edible", "protection": "none",
	}
	for key, value := range change {
		body[key] = value
	}
	return body
}

func TestCreateSpeciesRequiresPermission(t *testing.T) {
	env := newEnv(t)
	env.Post("/species", writePayload(nil), nil).Expect(t, http.StatusUnauthorized)
}

func TestCreateSpeciesSuccessBuildsSlugFromLatinName(t *testing.T) {
	env := newEnv(t)
	body := env.Post("/species", writePayload(map[string]any{"scientificName": "Böletus Édulis"}), &editor).
		Expect(t, http.StatusCreated).Map(t)
	if body["slug"] != "boeletus-edulis" || body["updatedByName"] != "Admin" {
		t.Fatal(body)
	}
}

func TestCreateSpeciesDuplicateSlugConflicts(t *testing.T) {
	env := newEnv(t)
	env.Post("/species", writePayload(nil), &editor).Expect(t, http.StatusCreated)
	second := env.Post("/species", writePayload(map[string]any{"name": "Anderer Name"}), &editor).
		Expect(t, http.StatusConflict).Map(t)
	if second["code"] != "slug_taken" {
		t.Fatal(second)
	}
}

func TestReplaceSpeciesReplacesChildRows(t *testing.T) {
	env := newEnv(t)
	porcini := makeSpecies(t, env, "boletus-edulis", "Steinpilz", "Boletus edulis", nil, nil)
	addName(t, env, porcini, 0, "Herrenpilz", "synonym")
	body := env.Put("/species/"+porcini.Slug, writePayload(map[string]any{
		"names": []any{map[string]any{"name": "Neuer Name", "kind": "common"}},
	}), &editor).Expect(t, http.StatusOK).Map(t)
	equalJSON(t, body["names"], `[{"kind":"common","name":"Neuer Name"}]`)
	if body["slug"] != porcini.Slug {
		t.Fatal(body)
	}
}

func TestReplaceSpeciesWritesEveryChildKind(t *testing.T) {
	env := newEnv(t)
	porcini := makeSpecies(t, env, "boletus-edulis", "Steinpilz", "Boletus edulis", nil, nil)
	other := makeSpecies(t, env, "boletus-aereus", "Sommersteinpilz", "Boletus aereus", nil, nil)
	tr := makeTerm(t, env, "smell", "fruity", "fruchtig", nil, 0)
	ref := map[string]any{"id": tr.ID.String(), "slug": tr.Slug, "name": tr.Name, "kind": tr.Kind}
	payload := writePayload(map[string]any{
		"measurements": []any{map[string]any{"part": "cap", "measurements": []any{
			map[string]any{"dimension": "width", "unit": "cm", "low": 4.0, "high": 20.0}}}},
		"partNotes": []any{map[string]any{"part": "cap", "description": "Halbkugelig", "comment": "Selten bis 30 cm"}},
		"colours": []any{map[string]any{"part": "cap", "mode": "distinct", "colours": []any{
			map[string]any{"name": "braun", "hex": "#7a5230"}, map[string]any{"name": "creme", "hex": "#f2e6c2"}}}},
		"colourChanges": []any{
			map[string]any{"part": "flesh", "kind": "mechanical", "from": map[string]any{"name": "weiss", "hex": "#ffffff"},
				"to": map[string]any{"name": "blau", "hex": "#3a6ea8"}, "triggers": []any{ref}},
			map[string]any{"part": "cap", "kind": "environment", "to": map[string]any{"name": "dunkel", "hex": "#2a2a2a"},
				"triggers": []any{}},
		},
		"capFeatures":  []any{map[string]any{"feature": "umbonate", "phase": "young"}},
		"capMargins":   []any{map[string]any{"margin": "inrolled", "phase": "young"}},
		"stemFeatures": []any{map[string]any{"feature": "bulb", "phase": "old"}},
		"traits":       []any{map[string]any{"key": "cap", "text": "Der Hut ist braun."}},
		"sources": []any{map[string]any{"scope": "profile", "title": "Quelle", "url": "https://example.test",
			"checkedOn": "2025-01-01"}},
		"seasons":    []any{"summer"},
		"terms":      []any{map[string]any{"term": ref, "fromExperience": true}},
		"lookalikes": []any{map[string]any{"slug": other.Slug, "difference": "neu"}},
	})
	body := env.Put("/species/"+porcini.Slug, payload, &editor).Expect(t, http.StatusOK).Map(t)
	if obj(list(obj(list(body["measurements"])[0])["measurements"])[0])["low"] != 4.0 {
		t.Fatal(body["measurements"])
	}
	equalJSON(t, body["partNotes"], `[{"comment":"Selten bis 30 cm","description":"Halbkugelig","part":"cap"}]`)
	if len(list(obj(list(body["colours"])[0])["colours"])) != 2 {
		t.Fatal(body["colours"])
	}
	changes := list(body["colourChanges"])
	if obj(obj(changes[0])["from"])["hex"] != "#ffffff" || obj(changes[1])["from"] != nil {
		t.Fatal(changes)
	}
	equalJSON(t, body["capFeatures"], `[{"feature":"umbonate","phase":"young"}]`)
	equalJSON(t, body["capMargins"], `[{"margin":"inrolled","phase":"young"}]`)
	equalJSON(t, body["stemFeatures"], `[{"feature":"bulb","phase":"old"}]`)
	equalJSON(t, body["traits"], `[{"key":"cap","text":"Der Hut ist braun."}]`)
	if obj(list(body["sources"])[0])["title"] != "Quelle" {
		t.Fatal(body["sources"])
	}
	equalJSON(t, body["seasons"], `["summer"]`)
	if obj(list(body["terms"])[0])["fromExperience"] != true {
		t.Fatal(body["terms"])
	}
	equalJSON(t, body["lookalikes"], `[{"capColours":[],"difference":"neu","edibility":"edible","name":"Sommersteinpilz","scientificName":"Boletus aereus","slug":"boletus-aereus"}]`)
}

func TestReplaceSpeciesWritesRingPart(t *testing.T) {
	env := newEnv(t)
	porcini := makeSpecies(t, env, "boletus-edulis", "Steinpilz", "Boletus edulis", nil, nil)
	body := env.Put("/species/"+porcini.Slug, writePayload(map[string]any{
		"partNotes": []any{map[string]any{"part": "ring", "description": "Vergänglich", "comment": ""}},
		"colours": []any{map[string]any{"part": "ring", "mode": "distinct", "colours": []any{
			map[string]any{"name": "weiss", "hex": "#ffffff"}}}},
	}), &editor).Expect(t, http.StatusOK).Map(t)
	equalJSON(t, body["partNotes"], `[{"comment":"","description":"Vergänglich","part":"ring"}]`)
	if obj(list(body["colours"])[0])["part"] != "ring" {
		t.Fatal(body["colours"])
	}
}

func TestReplaceSpeciesLookalikeSyncIsIndependentPerSide(t *testing.T) {
	env := newEnv(t)
	porcini := makeSpecies(t, env, "boletus-edulis", "Steinpilz", "Boletus edulis", nil, nil)
	bay := makeSpecies(t, env, "boletus-badius", "Maronenröhrling", "Boletus badius", nil, nil)
	env.Put("/species/"+porcini.Slug, writePayload(map[string]any{
		"lookalikes": []any{map[string]any{"slug": bay.Slug, "difference": "von porcini"}},
	}), &editor).Expect(t, http.StatusOK)
	env.Put("/species/"+bay.Slug, writePayload(map[string]any{
		"name": bay.Name, "scientificName": bay.LatinName, "lookalikes": []any{},
	}), &editor).Expect(t, http.StatusOK)

	equalJSON(t, profileOf(t, env, porcini.Slug)["lookalikes"],
		`[{"capColours":[],"difference":"von porcini","edibility":"edible","name":"Maronenröhrling","scientificName":"Boletus badius","slug":"boletus-badius"}]`)
	bayLook := obj(list(profileOf(t, env, bay.Slug)["lookalikes"])[0])
	if bayLook["slug"] != porcini.Slug || bayLook["difference"] != nil {
		t.Fatal(bayLook)
	}

	env.Put("/species/"+porcini.Slug, writePayload(map[string]any{"lookalikes": []any{}}), &editor).Expect(t, http.StatusOK)
	equalJSON(t, profileOf(t, env, porcini.Slug)["lookalikes"], `[]`)
	equalJSON(t, profileOf(t, env, bay.Slug)["lookalikes"], `[]`)
}

func TestReplaceSpecies404(t *testing.T) {
	env := newEnv(t)
	env.Put("/species/unknown-species", writePayload(nil), &editor).Expect(t, http.StatusNotFound)
}

func TestReplaceSpeciesUnknownLookalikeSlugIsInvalid(t *testing.T) {
	env := newEnv(t)
	porcini := makeSpecies(t, env, "boletus-edulis", "Steinpilz", "Boletus edulis", nil, nil)
	body := env.Put("/species/"+porcini.Slug, writePayload(map[string]any{
		"name": "Neu", "lookalikes": []any{map[string]any{"slug": "unknown-species", "difference": "x"}},
	}), &editor).Expect(t, http.StatusUnprocessableEntity).Map(t)
	equalJSON(t, body["errors"], `[{"code":"unknown_slug","field":"lookalikes"}]`)
	if profileOf(t, env, porcini.Slug)["name"] != "Steinpilz" {
		t.Fatal("not rolled back")
	}
}

func TestDeleteSpeciesSuccess(t *testing.T) {
	env := newEnv(t)
	porcini := makeSpecies(t, env, "boletus-edulis", "Steinpilz", "Boletus edulis", nil, nil)
	env.Delete("/species/"+porcini.Slug, &editor).Expect(t, http.StatusNoContent)
	env.Get("/species/"+porcini.Slug, nil).Expect(t, http.StatusNotFound)
}

func TestDeleteSpeciesInUseByFindConflicts(t *testing.T) {
	env := newEnv(t)
	porcini := makeSpecies(t, env, "boletus-edulis", "Steinpilz", "Boletus edulis", nil, nil)
	addFind(t, env, porcini, makeUser(t, env, "owner-1", "owner-1"))
	body := env.Delete("/species/"+porcini.Slug, &editor).Expect(t, http.StatusConflict).Map(t)
	if body["code"] != "in_use" {
		t.Fatal(body)
	}
}

func TestDeleteSpeciesInUseByPhotoConflicts(t *testing.T) {
	env := newEnv(t)
	porcini := makeSpecies(t, env, "boletus-edulis", "Steinpilz", "Boletus edulis", nil, nil)
	addLeadPhoto(t, env, porcini)
	body := env.Delete("/species/"+porcini.Slug, &editor).Expect(t, http.StatusConflict).Map(t)
	if body["code"] != "in_use" {
		t.Fatal(body)
	}
}

func TestSetForecast(t *testing.T) {
	env := newEnv(t)
	porcini := makeSpecies(t, env, "boletus-edulis", "Steinpilz", "Boletus edulis", nil, nil)
	before := profileOf(t, env, porcini.Slug)["updatedAt"]
	body := env.Put("/species/"+porcini.Slug+"/forecast", map[string]any{"enabled": true}, &editor).
		Expect(t, http.StatusOK).Map(t)
	if body["forecastEnabled"] != true || body["updatedAt"] == before {
		t.Fatal(body)
	}
	again := env.Put("/species/"+porcini.Slug+"/forecast", map[string]any{"enabled": true}, &editor).
		Expect(t, http.StatusOK).Map(t)
	if again["updatedAt"] != body["updatedAt"] {
		t.Fatal("a write without a change moved updated_at")
	}
}

func TestCounts(t *testing.T) {
	env := newEnv(t)
	porcini := makeSpecies(t, env, "boletus-edulis", "Steinpilz", "Boletus edulis", nil, nil)
	addLeadPhoto(t, env, porcini)
	addFind(t, env, porcini, makeUser(t, env, "owner-2", "owner-2"))
	body := env.Get("/species/"+porcini.Slug+"/counts", &editor).Expect(t, http.StatusOK)
	equalJSON(t, body.Map(t), `{"finds":1,"photos":1,"records":0}`)
}

func TestCountsAllReadsRecordsFindsAndPhotos(t *testing.T) {
	env := newEnv(t)
	porcini := makeSpecies(t, env, "boletus-edulis", "Steinpilz", "Boletus edulis", nil, nil)
	addLeadPhoto(t, env, porcini)
	addFind(t, env, porcini, makeUser(t, env, "owner-3", "owner-3"))
	addRunSpecies(t, env, makeRun(t, env, time.Now()), porcini, "finished", 42)
	found, err := catalog.CountsFor(context.Background(), env.DB, []db.ID{porcini.ID})
	if err != nil {
		t.Fatal(err)
	}
	if got := found[porcini.ID]; got.Records != 42 || got.Finds != 1 || got.Photos != 1 {
		t.Fatal(got)
	}
}

func TestCountsKeepTheLastFinishedRun(t *testing.T) {
	env := newEnv(t)
	porcini := makeSpecies(t, env, "boletus-edulis", "Steinpilz", "Boletus edulis", nil, nil)
	now := time.Now()
	addRunSpecies(t, env, makeRun(t, env, now.Add(-time.Hour)), porcini, "finished", 7)
	addRunSpecies(t, env, makeRun(t, env, now), porcini, "finished", 42)
	addRunSpecies(t, env, makeRun(t, env, now.Add(time.Hour)), porcini, "queued", 0)
	body := env.Get("/species/"+porcini.Slug+"/counts", &editor).Expect(t, http.StatusOK).Map(t)
	if body["records"] != 42.0 {
		t.Fatal(body)
	}
}

func TestCountsRequiresPermission(t *testing.T) {
	env := newEnv(t)
	porcini := makeSpecies(t, env, "boletus-edulis", "Steinpilz", "Boletus edulis", nil, nil)
	env.Get("/species/"+porcini.Slug+"/counts", nil).Expect(t, http.StatusUnauthorized)
	someone := testkit.Someone("plain")
	env.Get("/species/"+porcini.Slug+"/counts", &someone).Expect(t, http.StatusForbidden)
}

func TestProfileNamesTheAccountThatChangedIt(t *testing.T) {
	env := newEnv(t)
	user := makeUser(t, env, "person-editor", "Frederik")
	makeSpecies(t, env, "boletus-edulis", "Steinpilz", "", nil, extra{"updated_by_id": user})
	if profileOf(t, env, "boletus-edulis")["updatedByName"] != "Frederik" {
		t.Fatal()
	}
}

func TestProfileHasEveryFieldInContractOrder(t *testing.T) {
	env := newEnv(t)
	makeSpecies(t, env, "boletus-edulis", "Steinpilz", "Boletus edulis", nil, nil)
	body := string(env.Get("/species/boletus-edulis", nil).Body)
	keys := []string{`"id"`, `"slug"`, `"scientificName"`, `"taxonId"`, `"genusName"`, `"familyName"`,
		`"leadPhotoId"`, `"updatedAt"`, `"updatedByName"`, `"capShapeOld"`, `"names"`, `"lookalikes"`, `"reactions"`}
	positions := []int{}
	for _, key := range keys {
		positions = append(positions, strings.Index(body, key))
	}
	if !slices.IsSorted(positions) || slices.Contains(positions, -1) {
		t.Fatal(body)
	}
}
