package catalog_test

import (
	"encoding/json"
	"net/http"
	"strings"
	"sync"
	"testing"

	"github.com/frederikbeimgraben/kinoko/backend/internal/testkit"
)

func bundleOf(t *testing.T, env *testkit.Env) map[string]any {
	t.Helper()
	return env.Get("/species/bundle", nil).Expect(t, http.StatusOK).Map(t)
}

func items(body map[string]any) []map[string]any {
	raw, _ := body["items"].([]any)
	out := []map[string]any{}
	for _, item := range raw {
		out = append(out, item.(map[string]any))
	}
	return out
}

func equalJSON(t *testing.T, got any, want string) {
	t.Helper()
	encoded := mustJSON(t, got)
	if encoded != want {
		t.Fatalf("got %s, want %s", encoded, want)
	}
}

func TestBundleHasItemsStandardColoursAndFacets(t *testing.T) {
	env := newEnv(t)
	porcini := makeSpecies(t, env, "boletus-edulis", "Steinpilz", "Boletus edulis", nil, nil)
	addColours(t, env, porcini, "cap", "distinct", colour{"braun", "#7a5230"})
	response := env.Get("/species/bundle", nil).Expect(t, http.StatusOK)
	body := response.Map(t)
	if items(body)[0]["slug"] != porcini.Slug {
		t.Fatal(body["items"])
	}
	palette := body["standardColours"].([]any)
	if len(palette) != 12 {
		t.Fatal(palette)
	}
	equalJSON(t, palette[0], `{"hex":"#f3efe6","key":"white"}`)
	equalJSON(t, body["facets"].(map[string]any)["colour.cap"], `{"brown":1}`)
	if response.Header.Get("ETag") == "" {
		t.Fatal(response.Header)
	}
}

func TestFacetsCountEveryAxis(t *testing.T) {
	env := newEnv(t)
	family := makeTaxon(t, env, "family", "boletaceae", "Boletaceae", nil)
	genus := makeTaxon(t, env, "genus", "boletus", "Boletus", &family)
	porcini := makeSpecies(t, env, "boletus-edulis", "Steinpilz", "Boletus edulis", &genus, extra{
		"hymenium_type": "tubes", "period_start_month": 8, "period_end_month": 10,
	})
	makeSpecies(t, env, "amanita-phalloides", "Knollenblätterpilz", "Amanita phalloides", nil, extra{"edibility": "deadly"})
	spruce := makeTerm(t, env, "tree", "fichte", "Fichte", nil, 0)
	addTerm(t, env, porcini, spruce, false)

	facets := bundleOf(t, env)["facets"].(map[string]any)

	equalJSON(t, facets["edibility"], `{"deadly":1,"edible":1}`)
	equalJSON(t, facets["hymenium"], `{"tubes":1}`)
	if facets["period"].(map[string]any)["9"] != 1.0 {
		t.Fatal(facets["period"])
	}
	equalJSON(t, facets["treePartner"], `{"fichte":1}`)
	equalJSON(t, facets["genusFamily"], `{"Amanita":1,"Boletaceae":1,"Boletus":1}`)
	if facets["unknown"].(map[string]any)["hymenium"] != 1.0 {
		t.Fatal(facets["unknown"])
	}
}

func TestBundleNamesGenusAndFamily(t *testing.T) {
	env := newEnv(t)
	family := makeTaxon(t, env, "family", "boletaceae", "Boletaceae", nil)
	genus := makeTaxon(t, env, "genus", "boletus", "Boletus", &family)
	makeSpecies(t, env, "boletus-edulis", "Steinpilz", "Boletus edulis", &genus, nil)

	item := items(bundleOf(t, env))[0]

	if item["genusName"] != "Boletus" || item["familyName"] != "Boletaceae" {
		t.Fatal(item)
	}
}

func TestASpeciesWithoutATaxonNamesItsGenusFromTheLatinName(t *testing.T) {
	env := newEnv(t)
	makeSpecies(t, env, "boletus-edulis", "Steinpilz", "Boletus edulis", nil, nil)

	item := items(bundleOf(t, env))[0]

	if item["genusName"] != "Boletus" || item["familyName"] != nil {
		t.Fatal(item)
	}
}

func TestATermNamesItsKind(t *testing.T) {
	env := newEnv(t)
	porcini := makeSpecies(t, env, "boletus-edulis", "Steinpilz", "", nil, nil)
	spruce := makeTerm(t, env, "tree", "fichte", "Fichte", nil, 0)
	addTerm(t, env, porcini, spruce, false)

	item := items(bundleOf(t, env))[0]

	if item["terms"].([]any)[0].(map[string]any)["term"].(map[string]any)["kind"] != "tree" {
		t.Fatal(item["terms"])
	}
}

func TestBundleReturns304ForMatchingETag(t *testing.T) {
	env := newEnv(t)
	makeSpecies(t, env, "boletus-edulis", "Steinpilz", "Boletus edulis", nil, nil)
	tag := env.Get("/species/bundle", nil).Header.Get("ETag")
	second := env.Do(testkit.Request{Method: http.MethodGet, Path: "/species/bundle", Header: http.Header{"If-None-Match": {tag}}})
	second.Expect(t, http.StatusNotModified)
	if len(second.Body) != 0 || second.Header.Get("ETag") != tag {
		t.Fatal(second)
	}
}

func getWithTag(env *testkit.Env, tag string) testkit.Response {
	return env.Do(testkit.Request{Method: http.MethodGet, Path: "/species/bundle", Header: http.Header{"If-None-Match": {tag}}})
}

func TestBundleETagChangesAfterWrite(t *testing.T) {
	env := newEnv(t)
	makeSpecies(t, env, "boletus-edulis", "Steinpilz", "Boletus edulis", nil, nil)
	tag := env.Get("/species/bundle", nil).Header.Get("ETag")
	makeSpecies(t, env, "boletus-badius", "Maronenröhrling", "Boletus badius", nil, nil)
	second := getWithTag(env, tag).Expect(t, http.StatusOK)
	if second.Header.Get("ETag") == tag {
		t.Fatal("same tag")
	}
}

func TestBundleETagChangesWhenAPhotoIsApproved(t *testing.T) {
	env := newEnv(t)
	porcini := makeSpecies(t, env, "boletus-edulis", "Steinpilz", "Boletus edulis", nil, nil)
	tag := env.Get("/species/bundle", nil).Header.Get("ETag")
	photo := addLeadPhoto(t, env, porcini)
	second := getWithTag(env, tag).Expect(t, http.StatusOK)
	if second.Header.Get("ETag") == tag {
		t.Fatal("same tag")
	}
	if items(second.Map(t))[0]["leadPhotoId"] != photo.String() {
		t.Fatal(string(second.Body))
	}
}

func TestBundleETagChangesWhenTheLeadPhotoChanges(t *testing.T) {
	env := newEnv(t)
	porcini := makeSpecies(t, env, "boletus-edulis", "Steinpilz", "Boletus edulis", nil, nil)
	first := addLeadPhoto(t, env, porcini)
	second := addLeadPhoto(t, env, porcini)
	setPhotoLead(t, env, first, false)
	tag := env.Get("/species/bundle", nil).Header.Get("ETag")
	setPhotoLead(t, env, second, false)
	setPhotoLead(t, env, first, true)
	answer := getWithTag(env, tag).Expect(t, http.StatusOK)
	if answer.Header.Get("ETag") == tag {
		t.Fatal("same tag")
	}
	if items(answer.Map(t))[0]["leadPhotoId"] != first.String() {
		t.Fatal(string(answer.Body))
	}
}

func TestBundleEmptyCatalogue(t *testing.T) {
	env := newEnv(t)
	if body := bundleOf(t, env); len(items(body)) != 0 {
		t.Fatal(body)
	}
}

func TestBundleIsBuiltOnceForOneETag(t *testing.T) {
	env := newEnv(t)
	makeSpecies(t, env, "boletus-edulis", "Steinpilz", "", nil, nil)
	env.Get("/species/bundle", nil)
	builds := module(t, env).Builds()

	env.Get("/species/bundle", nil)

	if module(t, env).Builds() != builds {
		t.Fatal("built again")
	}
}

func TestTwoRequestsAtTheSameTimeBuildOnce(t *testing.T) {
	env := newEnv(t)
	makeSpecies(t, env, "boletus-edulis", "Steinpilz", "", nil, nil)
	module(t, env).ForgetBundle()

	answers := make([]testkit.Response, 2)
	var wait sync.WaitGroup
	for i := range answers {
		wait.Go(func() { answers[i] = env.Get("/species/bundle", nil) })
	}
	wait.Wait()

	if answers[0].Status != http.StatusOK || string(answers[0].Body) != string(answers[1].Body) {
		t.Fatal(answers)
	}
	if module(t, env).Builds() != 1 {
		t.Fatal(module(t, env).Builds())
	}
}

func TestBundleIsFreshAfterAChange(t *testing.T) {
	env := newEnv(t)
	porcini := makeSpecies(t, env, "boletus-edulis", "Steinpilz", "", nil, nil)
	first := env.Get("/species/bundle", nil)

	touch(t, env, porcini, "name", "Herrenpilz")
	second := env.Get("/species/bundle", nil)

	if second.Header.Get("ETag") == first.Header.Get("ETag") {
		t.Fatal("same tag")
	}
	if items(second.Map(t))[0]["name"] != "Herrenpilz" {
		t.Fatal(string(second.Body))
	}
}

func TestBundleFacetsKeepTheOrderOfFirstUse(t *testing.T) {
	env := newEnv(t)
	makeSpecies(t, env, "boletus-edulis", "Steinpilz", "Boletus edulis", nil, extra{"edibility": "poisonous"})
	makeSpecies(t, env, "amanita-muscaria", "Fliegenpilz", "Amanita muscaria", nil, nil)
	body := string(env.Get("/species/bundle", nil).Body)
	want := `"facets":{"edibility":{"edible":1,"poisonous":1},"protection":{"none":2},"genusFamily":{"Amanita":1,"Boletus":1},"unknown":{"hymenium":2,"capShape":2,"period":2,"senses":2,"treePartner":2}}`
	if !strings.Contains(body, want) {
		t.Fatal(body)
	}
}

func mustJSON(t *testing.T, v any) string {
	t.Helper()
	encoded, err := json.Marshal(v)
	if err != nil {
		t.Fatal(err)
	}
	return string(encoded)
}
