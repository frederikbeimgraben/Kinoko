package texts_test

import (
	"net/http"
	"slices"
	"testing"

	"github.com/frederikbeimgraben/kinoko/backend/internal/fn"
	"github.com/frederikbeimgraben/kinoko/backend/internal/testkit"
)

var glossaryEntry = map[string]string{"term": "Zystide", "definition": "Sterile Zelle im Hymenium."}

func with(base map[string]string, key, value string) map[string]string {
	out := map[string]string{key: value}
	for k, v := range base {
		if k != key {
			out[k] = v
		}
	}
	return out
}

// anna is a person with text.edit through the admin group.
func anna() *testkit.Person {
	p := testkit.Admin()
	p.Sub, p.Name, p.Email = "anna", "anna", "anna@example.org"
	return &p
}

func TestListIsOpenToEveryone(t *testing.T) {
	env := testkit.New(t)
	items := env.Get("/glossary", nil).Expect(t, http.StatusOK).Map(t)["items"].([]any)
	if len(items) == 0 || items[0].(map[string]any)["termEn"] == "" {
		t.Fatal(items)
	}
}

func TestCreateNeedsTheRight(t *testing.T) {
	env := testkit.New(t)
	grantTextEdit(t, env)
	env.Post("/glossary", glossaryEntry, testkit.Ptr(testkit.Someone("anna"))).Expect(t, http.StatusForbidden)
}

func TestCreateReadAndDelete(t *testing.T) {
	env := testkit.New(t)
	grantTextEdit(t, env)
	body := env.Post("/glossary", glossaryEntry, anna()).Expect(t, http.StatusCreated).Map(t)
	if body["term"] != "Zystide" || body["updatedByName"] != "anna" {
		t.Fatal(body)
	}
	ids := func() []any {
		return fn.Map(env.Get("/glossary", nil).Map(t)["items"].([]any), func(item any) any { return item.(map[string]any)["id"] })
	}
	if !slices.Contains(ids(), body["id"]) {
		t.Fatal(ids())
	}
	env.Delete("/glossary/"+body["id"].(string), anna()).Expect(t, http.StatusNoContent)
	if slices.Contains(ids(), body["id"]) {
		t.Fatal("still listed")
	}
}

func TestUpdateChangesTheDefinition(t *testing.T) {
	env := testkit.New(t)
	grantTextEdit(t, env)
	made := env.Post("/glossary", glossaryEntry, anna()).Expect(t, http.StatusCreated).Map(t)
	changed := env.Put("/glossary/"+made["id"].(string), with(glossaryEntry, "definition", "Kurz."), anna()).
		Expect(t, http.StatusOK).Map(t)
	if changed["definition"] != "Kurz." {
		t.Fatal(changed)
	}
}

func TestTheEnglishDefinitionIsStoredAndKeptByAnUpdateWithoutIt(t *testing.T) {
	env := testkit.New(t)
	grantTextEdit(t, env)
	made := env.Post("/glossary", with(glossaryEntry, "definitionEn", "Sterile cell in the hymenium."), anna()).
		Expect(t, http.StatusCreated).Map(t)
	if made["definitionEn"] != "Sterile cell in the hymenium." {
		t.Fatal(made)
	}
	changed := env.Put("/glossary/"+made["id"].(string), with(glossaryEntry, "definition", "Kurz."), anna()).
		Expect(t, http.StatusOK).Map(t)
	if changed["definitionEn"] != "Sterile cell in the hymenium." || changed["definition"] != "Kurz." {
		t.Fatal(changed)
	}
}

func TestAnEntryWithoutEnglishHasAnEmptyText(t *testing.T) {
	env := testkit.New(t)
	grantTextEdit(t, env)
	made := env.Post("/glossary", glossaryEntry, anna()).Expect(t, http.StatusCreated).Map(t)
	if made["definitionEn"] != "" {
		t.Fatal(made)
	}
}

func TestATermStandsOnce(t *testing.T) {
	env := testkit.New(t)
	grantTextEdit(t, env)
	first := env.Post("/glossary", glossaryEntry, anna()).Expect(t, http.StatusCreated).Map(t)
	twice := env.Post("/glossary", glossaryEntry, anna()).Expect(t, http.StatusUnprocessableEntity).Map(t)
	if errs := twice["errors"].([]any); errs[0].(map[string]any)["field"] != "term" || errs[0].(map[string]any)["code"] != "taken" {
		t.Fatal(twice)
	}
	other := env.Post("/glossary", with(glossaryEntry, "term", "Lamellenschneide"), anna()).Expect(t, http.StatusCreated).Map(t)
	env.Put("/glossary/"+other["id"].(string), glossaryEntry, anna()).Expect(t, http.StatusUnprocessableEntity)
	env.Put("/glossary/"+first["id"].(string), glossaryEntry, anna()).Expect(t, http.StatusOK)
}

func TestAnUnknownEntry(t *testing.T) {
	env := testkit.New(t)
	grantTextEdit(t, env)
	missing := "/glossary/11111111-1111-1111-1111-111111111111"
	env.Put(missing, glossaryEntry, anna()).Expect(t, http.StatusNotFound)
	env.Delete(missing, anna()).Expect(t, http.StatusNotFound)
}

func TestTheEnglishTermIsStoredAndKeptByAnUpdateWithoutIt(t *testing.T) {
	env := testkit.New(t)
	grantTextEdit(t, env)
	made := env.Post("/glossary", with(glossaryEntry, "termEn", "Cystidium"), anna()).Expect(t, http.StatusCreated).Map(t)
	changed := env.Put("/glossary/"+made["id"].(string), with(glossaryEntry, "definition", "Kurz."), anna()).
		Expect(t, http.StatusOK).Map(t)
	if made["termEn"] != "Cystidium" || changed["termEn"] != "Cystidium" {
		t.Fatal(made, changed)
	}
}
