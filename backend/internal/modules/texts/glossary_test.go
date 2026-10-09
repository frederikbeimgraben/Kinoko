package texts_test

import (
	"net/http"
	"testing"

	"github.com/frederikbeimgraben/kinoko/backend/internal/testkit"
)

var glossaryEntry = map[string]string{"term": "Hymenium", "definition": "Die Fruchtschicht eines Pilzes."}

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
	listed := env.Get("/glossary", nil).Expect(t, http.StatusOK)
	if string(listed.Body) != `{"items":[]}` {
		t.Fatal(string(listed.Body))
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
	if body["term"] != "Hymenium" || body["updatedByName"] != "anna" {
		t.Fatal(body)
	}
	items := env.Get("/glossary", nil).Map(t)["items"].([]any)
	if len(items) != 1 || items[0].(map[string]any)["id"] != body["id"] {
		t.Fatal(items)
	}
	env.Delete("/glossary/"+body["id"].(string), anna()).Expect(t, http.StatusNoContent)
	if items := env.Get("/glossary", nil).Map(t)["items"].([]any); len(items) != 0 {
		t.Fatal(items)
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
	made := env.Post("/glossary", with(glossaryEntry, "definitionEn", "The spore-bearing layer."), anna()).
		Expect(t, http.StatusCreated).Map(t)
	if made["definitionEn"] != "The spore-bearing layer." {
		t.Fatal(made)
	}
	changed := env.Put("/glossary/"+made["id"].(string), with(glossaryEntry, "definition", "Kurz."), anna()).
		Expect(t, http.StatusOK).Map(t)
	if changed["definitionEn"] != "The spore-bearing layer." || changed["definition"] != "Kurz." {
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
	other := env.Post("/glossary", with(glossaryEntry, "term", "Stiel"), anna()).Expect(t, http.StatusCreated).Map(t)
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
