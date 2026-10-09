package objects_test

import (
	"net/http"
	"net/url"
	"testing"

	"github.com/frederikbeimgraben/kinoko/backend/internal/core/db"
	"github.com/frederikbeimgraben/kinoko/backend/internal/testkit"
)

var aFactor = object{"source": "boletus-edulis", "condition": "above", "low": 0.5}

func aCombination(factors ...object) object {
	return object{"name": "Regel", "rule": "intersection", "factors": factors}
}

func writeLayers(t *testing.T, env *testkit.Env, names ...string) {
	t.Helper()
	layers := object{}
	for _, name := range names {
		layers[name] = object{"label": name, "unit": ""}
	}
	writeJSON(t, env.Settings.Maps, "layers.json", object{"layers": layers})
}

func TestCreateWithoutManifestSkipsTheCheck(t *testing.T) {
	env := testkit.New(t)
	anna := makeUser(t, env, "anna")
	answer := env.Post("/combinations", aCombination(aFactor), anna.Person).Expect(t, http.StatusCreated).Map(t)
	factor := answer["factors"].([]any)[0].(map[string]any)
	if factor["source"] != "boletus-edulis" || factor["active"] != true || factor["high"] != nil || factor["low"] != 0.5 {
		t.Fatal(answer)
	}
}

func TestFactorsAreStoredAsCompactJSON(t *testing.T) {
	env := testkit.New(t)
	anna := makeUser(t, env, "anna")
	id := env.Post("/combinations", aCombination(object{"source": "ä", "condition": "between", "low": 1, "high": 1e-7, "active": false}), anna.Person).
		Expect(t, http.StatusCreated).Map(t)["id"].(string)
	parsed, _ := db.ParseID(id)
	var stored string
	if err := env.DB.QueryRow("SELECT factors FROM combination WHERE id = ?", parsed).Scan(&stored); err != nil {
		t.Fatal(err)
	}
	want := `[{"source": "` + "\\u00e4" + `", "condition": "between", "low": 1.0, "high": 1e-07, "active": false}]`
	if stored != want {
		t.Fatalf("stored %s", stored)
	}
}

func TestCreateRejectsAnUnknownSource(t *testing.T) {
	env := testkit.New(t)
	anna := makeUser(t, env, "anna")
	writeLayers(t, env, "boletus-edulis")
	answer := env.Post("/combinations", aCombination(aFactor, with(aFactor, object{"source": "x"})), anna.Person).
		Expect(t, http.StatusUnprocessableEntity)
	errs := fieldErrors(t, answer)
	if len(errs) != 1 || errs[0]["field"] != "factors.1.source" || errs[0]["code"] != "unknown_source" {
		t.Fatal(errs)
	}
}

func TestCreateAcceptsAKnownSource(t *testing.T) {
	env := testkit.New(t)
	anna := makeUser(t, env, "anna")
	writeLayers(t, env, "boletus-edulis")
	env.Post("/combinations", aCombination(aFactor), anna.Person).Expect(t, http.StatusCreated)
}

func TestPutReplacesACombination(t *testing.T) {
	env := testkit.New(t)
	anna := makeUser(t, env, "anna")
	id := db.NewID().String()
	env.Put("/combinations/"+id, with(aCombination(aFactor), object{"name": "Alt"}), anna.Person).Expect(t, http.StatusCreated)
	second := env.Put("/combinations/"+id, object{"name": "Neu", "rule": "graded", "factors": []object{aFactor}}, anna.Person).
		Expect(t, http.StatusOK).Map(t)
	if second["name"] != "Neu" || second["rule"] != "graded" {
		t.Fatal(second)
	}
}

func TestPutRejectsAnUnknownSource(t *testing.T) {
	env := testkit.New(t)
	anna := makeUser(t, env, "anna")
	writeLayers(t, env, "boletus-edulis")
	env.Put("/combinations/"+db.NewID().String(), aCombination(with(aFactor, object{"source": "x"})), anna.Person).
		Expect(t, http.StatusUnprocessableEntity)
}

func TestDeleteACombination(t *testing.T) {
	env := testkit.New(t)
	anna := makeUser(t, env, "anna")
	id := env.Post("/combinations", aCombination(aFactor), anna.Person).Map(t)["id"].(string)
	env.Delete("/combinations/"+id, anna.Person).Expect(t, http.StatusNoContent)
	env.Get("/combinations/"+id, anna.Person).Expect(t, http.StatusNotFound)
}

func TestCombinationListRequiresLogin(t *testing.T) {
	env := testkit.New(t)
	env.Get("/combinations", nil).Expect(t, http.StatusUnauthorized)
}

func TestGetACombination(t *testing.T) {
	env := testkit.New(t)
	anna := makeUser(t, env, "anna")
	id := env.Post("/combinations", aCombination(aFactor), anna.Person).Map(t)["id"].(string)
	env.Get("/combinations/"+id, anna.Person).Expect(t, http.StatusOK)
}

func TestCombinationListAndChangesSince(t *testing.T) {
	env := testkit.New(t)
	anna := makeUser(t, env, "anna")
	id := env.Post("/combinations", aCombination(aFactor), anna.Person).Map(t)["id"].(string)
	if listed := items(t, env.Get("/combinations", anna.Person)); len(listed) != 1 {
		t.Fatal(listed)
	}
	since := ids(items(t, env.Get("/combinations?since="+url.QueryEscape("1970-01-01T00:00:00Z"), anna.Person)))
	if len(since) != 1 || since[0] != id {
		t.Fatal(since)
	}
}
