package catalog_test

import (
	"net/http"
	"testing"
)

func TestListTaxaGivesAllOrOneRankByLatinName(t *testing.T) {
	env := newEnv(t)
	seed := seedTaxa(t, env)
	all := list(env.Get("/taxa", nil).Expect(t, http.StatusOK).Map(t)["items"])
	if len(all) != 6 {
		t.Fatal(all)
	}
	genera := list(env.Get("/taxa?rank=genus", nil).Expect(t, http.StatusOK).Map(t)["items"])
	if len(genera) != 2 || obj(genera[0])["slug"] != seed.genus.Slug || obj(genera[1])["slug"] != seed.otherGenus.Slug {
		t.Fatal(genera)
	}
	if obj(genera[0])["rank"] != "genus" || obj(genera[0])["id"] == "" {
		t.Fatal(genera[0])
	}
	env.Get("/taxa?rank=tribe", nil).Expect(t, http.StatusUnprocessableEntity)
}
