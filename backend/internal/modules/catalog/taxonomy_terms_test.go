package catalog_test

import (
	"net/http"
	"slices"
	"testing"

	"github.com/frederikbeimgraben/kinoko/backend/internal/testkit"
)

type taxaSeed struct {
	division, order, family, siblingFamily, genus, otherGenus taxon
	porcini, jack                                             species
}

func seedTaxa(t *testing.T, env *testkit.Env) taxaSeed {
	var s taxaSeed
	s.division = makeTaxon(t, env, "division", "basidiomycota", "", nil)
	s.order = makeTaxon(t, env, "order", "boletales", "", &s.division)
	s.family = makeTaxon(t, env, "family", "boletaceae", "", &s.order)
	s.siblingFamily = makeTaxon(t, env, "family", "paxillaceae", "", &s.order)
	s.genus = makeTaxon(t, env, "genus", "boletus", "", &s.family)
	s.otherGenus = makeTaxon(t, env, "genus", "suillus", "", &s.family)
	s.porcini = makeSpecies(t, env, "boletus-edulis", "Steinpilz", "Boletus edulis", &s.genus, nil)
	s.jack = makeSpecies(t, env, "suillus-luteus", "Butterpilz", "Suillus luteus", &s.otherGenus, nil)
	return s
}

func taxonPage(t *testing.T, env *testkit.Env, x taxon) map[string]any {
	t.Helper()
	return env.Get("/taxa/"+x.Rank+"/"+x.Slug, nil).Expect(t, http.StatusOK).Map(t)
}

func slugSet(items []any) []string {
	out := []string{}
	for _, item := range items {
		out = append(out, obj(item)["slug"].(string))
	}
	slices.Sort(out)
	return out
}

func TestGenusPageHasItsOwnSpecies(t *testing.T) {
	env := newEnv(t)
	seed := seedTaxa(t, env)
	body := taxonPage(t, env, seed.genus)
	if body["speciesCount"] != 1.0 || obj(list(body["species"])[0])["slug"] != seed.porcini.Slug {
		t.Fatal(body)
	}
	equalJSON(t, body["children"], `[]`)
}

func TestFamilyPageCollectsSpeciesAcrossGenera(t *testing.T) {
	env := newEnv(t)
	seed := seedTaxa(t, env)
	body := taxonPage(t, env, seed.family)
	if body["speciesCount"] != 2.0 {
		t.Fatal(body)
	}
	expectSlugs(t, slugSet(list(body["species"])), seed.porcini.Slug, seed.jack.Slug)
	counts := map[string]any{}
	for _, child := range list(body["children"]) {
		counts[obj(child)["slug"].(string)] = obj(child)["speciesCount"]
	}
	equalJSON(t, counts, `{"boletus":1,"suillus":1}`)
}

func TestFamilyPageHasPathAndSiblings(t *testing.T) {
	env := newEnv(t)
	seed := seedTaxa(t, env)
	body := taxonPage(t, env, seed.family)
	path := []string{}
	for _, step := range list(body["path"]) {
		path = append(path, obj(step)["slug"].(string))
	}
	if !slices.Equal(path, []string{"basidiomycota", "boletales"}) {
		t.Fatal(path)
	}
	expectSlugs(t, slugSet(list(body["siblings"])), "paxillaceae")
}

func TestDivisionPageHasEmptyPath(t *testing.T) {
	env := newEnv(t)
	seed := seedTaxa(t, env)
	body := taxonPage(t, env, seed.division)
	equalJSON(t, body["path"], `[]`)
	equalJSON(t, body["siblings"], `[]`)
}

func TestTaxonPage404(t *testing.T) {
	env := newEnv(t)
	env.Get("/taxa/genus/unknown-genus", nil).Expect(t, http.StatusNotFound)
	env.Get("/taxa/tribe/x", nil).Expect(t, http.StatusUnprocessableEntity)
}

func termSlugs(t *testing.T, env *testkit.Env, path string) []string {
	t.Helper()
	return slugsOf(t, env.Get(path, nil))
}

func TestListTermsOrderedByPositionAndName(t *testing.T) {
	env := newEnv(t)
	makeTerm(t, env, "smell", "b", "B", nil, 1)
	makeTerm(t, env, "smell", "a", "A", nil, 0)
	makeTerm(t, env, "taste", "c", "C", nil, 0)
	if got := termSlugs(t, env, "/terms?kind=smell"); !slices.Equal(got, []string{"a", "b"}) {
		t.Fatal(got)
	}
}

func TestListTermsWithoutKindReturnsAll(t *testing.T) {
	env := newEnv(t)
	makeTerm(t, env, "smell", "a", "A", nil, 0)
	makeTerm(t, env, "taste", "b", "B", nil, 0)
	if got := termSlugs(t, env, "/terms"); len(got) != 2 {
		t.Fatal(got)
	}
}

func TestListTermsCountsTheSpeciesThatUseATerm(t *testing.T) {
	env := newEnv(t)
	used := makeTerm(t, env, "smell", "a", "A", nil, 0)
	makeTerm(t, env, "smell", "b", "B", nil, 1)
	addTerm(t, env, makeSpecies(t, env, "one", "", "One", nil, nil), used, false)
	addTerm(t, env, makeSpecies(t, env, "two", "", "Two", nil, nil), used, true)
	items := env.Get("/terms?kind=smell", nil).Expect(t, http.StatusOK).Map(t)["items"].([]any)
	if items[0].(map[string]any)["usage"] != 2.0 || items[1].(map[string]any)["usage"] != 0.0 {
		t.Fatal(items)
	}
}

func TestCreateTermRequiresPermission(t *testing.T) {
	env := newEnv(t)
	env.Post("/terms", map[string]any{"kind": "smell", "slug": "a", "name": "A"}, nil).Expect(t, http.StatusUnauthorized)
}

func TestCreateTermSuccess(t *testing.T) {
	env := newEnv(t)
	body := env.Post("/terms", map[string]any{"kind": "smell", "slug": "fruity", "name": "fruchtig"}, &editor).
		Expect(t, http.StatusCreated).Map(t)
	if body["slug"] != "fruity" || body["group"] != nil || body["position"] != 0.0 {
		t.Fatal(body)
	}
}

func TestCreateTermDuplicateSlugWithinKindConflicts(t *testing.T) {
	env := newEnv(t)
	makeTerm(t, env, "smell", "fruity", "fruchtig", nil, 0)
	body := env.Post("/terms", map[string]any{"kind": "smell", "slug": "fruity", "name": "anders"}, &editor).
		Expect(t, http.StatusConflict).Map(t)
	if body["code"] != "slug_taken" {
		t.Fatal(body)
	}
}

func TestCreateTermSameSlugDifferentKindIsAllowed(t *testing.T) {
	env := newEnv(t)
	makeTerm(t, env, "smell", "fruity", "fruchtig", nil, 0)
	env.Post("/terms", map[string]any{"kind": "taste", "slug": "fruity", "name": "fruchtig"}, &editor).
		Expect(t, http.StatusCreated)
}

func TestUpdateTermChangesNameGroupPosition(t *testing.T) {
	env := newEnv(t)
	tr := makeTerm(t, env, "trigger", "cut", "Anschnitt", nil, 0)
	body := env.Patch("/terms/"+tr.ID.String(), map[string]any{"name": "Anschnitt frisch", "group": "mechanical", "position": 3}, &editor).
		Expect(t, http.StatusOK).Map(t)
	if body["name"] != "Anschnitt frisch" || body["group"] != "mechanical" || body["position"] != 3.0 {
		t.Fatal(body)
	}
}

func TestUpdateTermPartialLeavesOtherFields(t *testing.T) {
	env := newEnv(t)
	tr := makeTerm(t, env, "trigger", "cut", "Anschnitt", ptr("mechanical"), 2)
	body := env.Patch("/terms/"+tr.ID.String(), map[string]any{"position": 5}, &editor).Expect(t, http.StatusOK).Map(t)
	if body["name"] != "Anschnitt" || body["group"] != "mechanical" || body["position"] != 5.0 {
		t.Fatal(body)
	}
	cleared := env.Patch("/terms/"+tr.ID.String(), map[string]any{"group": nil}, &editor).Expect(t, http.StatusOK).Map(t)
	if cleared["group"] != nil || cleared["position"] != 5.0 {
		t.Fatal(cleared)
	}
}

func TestUpdateTerm404(t *testing.T) {
	env := newEnv(t)
	env.Patch("/terms/00000000-0000-0000-0000-000000000000", map[string]any{"position": 1}, &editor).
		Expect(t, http.StatusNotFound)
}

func TestMergeTermSelfIsInvalid(t *testing.T) {
	env := newEnv(t)
	tr := makeTerm(t, env, "smell", "fruity", "fruchtig", nil, 0)
	body := env.Post("/terms/"+tr.ID.String()+"/merge", map[string]any{"into": tr.ID.String()}, &editor).
		Expect(t, http.StatusUnprocessableEntity).Map(t)
	equalJSON(t, body["errors"], `[{"code":"self_merge","field":"into"}]`)
}

func termSlugsOf(entries []any) []string {
	out := []string{}
	for _, e := range entries {
		out = append(out, obj(obj(e)["term"])["slug"].(string))
	}
	slices.Sort(out)
	return out
}

func TestMergeTermMovesSpeciesAndTriggerUsage(t *testing.T) {
	env := newEnv(t)
	source := makeTerm(t, env, "smell", "musty", "modrig", nil, 0)
	target := makeTerm(t, env, "smell", "mouldy", "muffig", nil, 0)
	porcini := makeSpecies(t, env, "boletus-edulis", "Steinpilz", "Boletus edulis", nil, nil)
	bay := makeSpecies(t, env, "boletus-badius", "Maronenröhrling", "Boletus badius", nil, nil)
	addTerm(t, env, porcini, source, false)
	addTerm(t, env, bay, source, false)
	addTerm(t, env, bay, target, false)
	addColourChange(t, env, porcini, 0, "flesh", "blau", "#3a6ea8", source)
	addColourChange(t, env, bay, 0, "flesh", "blau", "#3a6ea8", source, target)

	env.Post("/terms/"+source.ID.String()+"/merge", map[string]any{"into": target.ID.String()}, &editor).
		Expect(t, http.StatusNoContent)

	p := profileOf(t, env, porcini.Slug)
	expectSlugs(t, termSlugsOf(list(p["terms"])), "mouldy")
	if obj(list(obj(list(p["colourChanges"])[0])["triggers"])[0])["slug"] != "mouldy" {
		t.Fatal(p["colourChanges"])
	}
	b := profileOf(t, env, bay.Slug)
	expectSlugs(t, termSlugsOf(list(b["terms"])), "mouldy")
	expectSlugs(t, slugSet(list(obj(list(b["colourChanges"])[0])["triggers"])), "mouldy")
	expectSlugs(t, termSlugs(t, env, "/terms?kind=smell"), "mouldy")
}

func TestDeleteTermRemovesItAndItsUsage(t *testing.T) {
	env := newEnv(t)
	tr := makeTerm(t, env, "smell", "fruity", "fruchtig", nil, 0)
	porcini := makeSpecies(t, env, "boletus-edulis", "Steinpilz", "Boletus edulis", nil, nil)
	addTerm(t, env, porcini, tr, false)
	env.Delete("/terms/"+tr.ID.String(), &editor).Expect(t, http.StatusNoContent)
	expectSlugs(t, termSlugs(t, env, "/terms?kind=smell"))
	equalJSON(t, profileOf(t, env, porcini.Slug)["terms"], `[]`)
}

func TestDeleteTermRequiresPermission(t *testing.T) {
	env := newEnv(t)
	tr := makeTerm(t, env, "smell", "fruity", "fruchtig", nil, 0)
	env.Delete("/terms/"+tr.ID.String(), nil).Expect(t, http.StatusUnauthorized)
}

func TestDeleteTerm404(t *testing.T) {
	env := newEnv(t)
	env.Delete("/terms/00000000-0000-0000-0000-000000000000", &editor).Expect(t, http.StatusNotFound)
}

func TestMergeTerm404(t *testing.T) {
	env := newEnv(t)
	tr := makeTerm(t, env, "smell", "fruity", "fruchtig", nil, 0)
	env.Post("/terms/"+tr.ID.String()+"/merge", map[string]any{"into": "00000000-0000-0000-0000-000000000000"}, &editor).
		Expect(t, http.StatusNotFound)
}
