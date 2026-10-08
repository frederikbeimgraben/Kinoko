package catalog_test

import (
	"net/http"
	"net/url"
	"slices"
	"testing"

	"github.com/frederikbeimgraben/kinoko/backend/internal/testkit"
)

type listSeed struct {
	porcini, fly species
	genus        taxon
	term         term
}

func seedList(t *testing.T, env *testkit.Env) listSeed {
	genus := makeTaxon(t, env, "genus", "boletus", "Boletus", nil)
	other := makeTaxon(t, env, "genus", "amanita", "Amanita", nil)
	porcini := makeSpecies(t, env, "boletus-edulis", "Steinpilz", "Boletus edulis", &genus, extra{
		"hymenium_type": "tubes", "cap_shape_young": "hemispherical", "cap_shape_old": "convex",
		"period_start_month": 6, "period_end_month": 10,
	})
	addColours(t, env, porcini, "cap", "distinct", colour{"braun", "#7a5230"})
	addMeasurement(t, env, porcini, "cap", "width", 4, 10)
	addName(t, env, porcini, 0, "Herrenpilz", "synonym")
	fly := makeSpecies(t, env, "amanita-muscaria", "Fliegenpilz", "Amanita muscaria", &other, extra{
		"edibility": "poisonous", "hymenium_type": "gills", "cap_shape_young": "spherical",
		"cap_shape_old": "flat", "period_start_month": 11, "period_end_month": 2,
	})
	addColours(t, env, fly, "cap", "distinct", colour{"rot", "#c0392b"})
	addMeasurement(t, env, fly, "cap", "width", 8, 20)
	tr := makeTerm(t, env, "smell", "fruity", "fruchtig", nil, 0)
	addTerm(t, env, porcini, tr, false)
	return listSeed{porcini, fly, genus, tr}
}

func search(t *testing.T, env *testkit.Env, query url.Values) []string {
	t.Helper()
	slugs := slugsOf(t, env.Get("/species?"+query.Encode(), nil))
	slices.Sort(slugs)
	return slugs
}

func expectSlugs(t *testing.T, got []string, want ...string) {
	t.Helper()
	slices.Sort(want)
	if !slices.Equal(got, want) {
		t.Fatalf("got %v, want %v", got, want)
	}
}

func TestSearchMatchesNameLatinNameAndFurtherName(t *testing.T) {
	env := newEnv(t)
	seed := seedList(t, env)
	expectSlugs(t, search(t, env, url.Values{"q": {"Herrenpilz"}}), seed.porcini.Slug)
	expectSlugs(t, search(t, env, url.Values{"q": {"amanita"}}), seed.fly.Slug)
}

func TestTaxonIDFiltersBySubtree(t *testing.T) {
	env := newEnv(t)
	seed := seedList(t, env)
	expectSlugs(t, search(t, env, url.Values{"taxonId": {seed.genus.ID.String()}}), seed.porcini.Slug)
}

func TestEdibilityAndHymeniumAndCapShapeAxes(t *testing.T) {
	env := newEnv(t)
	seed := seedList(t, env)
	expectSlugs(t, search(t, env, url.Values{"edibility[]": {"edible", "poisonous"}}), seed.porcini.Slug, seed.fly.Slug)
	expectSlugs(t, search(t, env, url.Values{"hymenium[]": {"tubes"}}), seed.porcini.Slug)
	expectSlugs(t, search(t, env, url.Values{"capShape[]": {"flat"}}), seed.fly.Slug)
}

func TestAxesCombineWithAnd(t *testing.T) {
	env := newEnv(t)
	seedList(t, env)
	expectSlugs(t, search(t, env, url.Values{"edibility[]": {"poisonous"}, "hymenium[]": {"tubes"}}))
}

func TestTermsRequireAll(t *testing.T) {
	env := newEnv(t)
	seed := seedList(t, env)
	other := makeTerm(t, env, "smell", "musty", "modrig", nil, 0)
	expectSlugs(t, search(t, env, url.Values{"terms[]": {seed.term.ID.String()}}), seed.porcini.Slug)
	expectSlugs(t, search(t, env, url.Values{"terms[]": {seed.term.ID.String(), other.ID.String()}}))
}

func TestMonthsWrapsYear(t *testing.T) {
	env := newEnv(t)
	seed := seedList(t, env)
	expectSlugs(t, search(t, env, url.Values{"months[]": {"12"}}), seed.fly.Slug)
	expectSlugs(t, search(t, env, url.Values{"months[]": {"7"}}), seed.porcini.Slug)
}

func TestColourFilterUsesNearestStandardColour(t *testing.T) {
	env := newEnv(t)
	seed := seedList(t, env)
	expectSlugs(t, search(t, env, url.Values{"colour[cap]": {"#7a5230"}}), seed.porcini.Slug)
}

func TestColourFilterRejectsMalformedHex(t *testing.T) {
	env := newEnv(t)
	seedList(t, env)
	env.Get("/species?"+url.Values{"colour[cap]": {"not-a-hex"}}.Encode(), nil).Expect(t, http.StatusUnprocessableEntity)
}

func TestSizeFilterMatchesOverlappingRange(t *testing.T) {
	env := newEnv(t)
	seed := seedList(t, env)
	expectSlugs(t, search(t, env, url.Values{"size[cap.width]": {"1-5"}}), seed.porcini.Slug)
	expectSlugs(t, search(t, env, url.Values{"size[cap.width]": {"15-"}}), seed.fly.Slug)
	expectSlugs(t, search(t, env, url.Values{"size[cap.width]": {"-3"}}))
}

func TestSizeFilterRejectsBadKey(t *testing.T) {
	env := newEnv(t)
	seedList(t, env)
	env.Get("/species?"+url.Values{"size[cap.unknown]": {"1-2"}}.Encode(), nil).Expect(t, http.StatusUnprocessableEntity)
}

func TestSizeFilterRejectsBadRange(t *testing.T) {
	env := newEnv(t)
	seedList(t, env)
	for _, value := range []string{"not-a-range", "1.2.3-4"} {
		env.Get("/species?"+url.Values{"size[cap.width]": {value}}.Encode(), nil).Expect(t, http.StatusUnprocessableEntity)
	}
}

func TestListOrdersByName(t *testing.T) {
	env := newEnv(t)
	seedList(t, env)
	body := env.Get("/species", nil).Expect(t, http.StatusOK).Map(t)
	names := []string{}
	for _, item := range list(body["items"]) {
		names = append(names, obj(item)["name"].(string))
	}
	if !slices.IsSorted(names) || len(names) != 2 {
		t.Fatal(names)
	}
}

func TestPaginationLimitAndCursor(t *testing.T) {
	env := newEnv(t)
	seedList(t, env)
	first := env.Get("/species?limit=1", nil).Expect(t, http.StatusOK).Map(t)
	if len(list(first["items"])) != 1 || first["nextCursor"] == nil {
		t.Fatal(first)
	}
	second := env.Get("/species?limit=1&cursor="+first["nextCursor"].(string), nil).Expect(t, http.StatusOK).Map(t)
	if len(list(second["items"])) != 1 || second["nextCursor"] != nil ||
		obj(list(second["items"])[0])["slug"] == obj(list(first["items"])[0])["slug"] {
		t.Fatal(second)
	}
}

func TestPaginationLimitOverFortyRejected(t *testing.T) {
	env := newEnv(t)
	env.Get("/species?limit=41", nil).Expect(t, http.StatusUnprocessableEntity)
}

func TestLeadPhotoIDInSummary(t *testing.T) {
	env := newEnv(t)
	seed := seedList(t, env)
	photo := addLeadPhoto(t, env, seed.porcini)
	item := obj(list(env.Get("/species?q=Steinpilz", nil).Expect(t, http.StatusOK).Map(t)["items"])[0])
	if item["leadPhotoId"] != photo.String() {
		t.Fatal(item)
	}
	if _, ok := item["names"]; ok {
		t.Fatal("a summary has no child rows")
	}
}
