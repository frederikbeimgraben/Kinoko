package objects_test

import (
	"net/http"
	"net/url"
	"testing"

	"github.com/frederikbeimgraben/kinoko/backend/internal/testkit"
)

func aMarker(name string) object { return object{"name": name, "lat": 1.0, "lon": 1.0} }

func TestCreateAndGetMarker(t *testing.T) {
	env := testkit.New(t)
	anna := makeUser(t, env, "anna")
	body := env.Post("/markers", object{"name": "Fundstelle", "lat": 50.1, "lon": 8.6}, anna.Person).
		Expect(t, http.StatusCreated).Map(t)
	if body["name"] != "Fundstelle" || body["colour"] != "green" || body["deleted"] != false {
		t.Fatal(body)
	}
	fetched := env.Get("/markers/"+body["id"].(string), anna.Person).Expect(t, http.StatusOK).Map(t)
	if fetched["id"] != body["id"] {
		t.Fatal(fetched)
	}
}

func TestMarkerHasEachField(t *testing.T) {
	env := testkit.New(t)
	anna := makeUser(t, env, "anna")
	body := env.Post("/markers", aMarker("A"), anna.Person).Expect(t, http.StatusCreated).Body
	want := `"id","ownerId","name","lat","lon","colour","visibility","groupId","note","createdAt","updatedAt","deleted"`
	if got := keysOf(t, body); got != want {
		t.Fatalf("keys %s", got)
	}
}

func TestListReturnsOnlyOwnMarkers(t *testing.T) {
	env := testkit.New(t)
	anna, bert := makeUser(t, env, "anna"), makeUser(t, env, "bert")
	env.Post("/markers", aMarker("A"), anna.Person).Expect(t, http.StatusCreated)
	env.Post("/markers", aMarker("B"), bert.Person).Expect(t, http.StatusCreated)
	listed := items(t, env.Get("/markers", bert.Person))
	if len(listed) != 1 || listed[0]["name"] != "B" {
		t.Fatal(listed)
	}
}

func TestMarkerListRequiresLogin(t *testing.T) {
	env := testkit.New(t)
	env.Get("/markers", nil).Expect(t, http.StatusUnauthorized)
}

func TestPutCreatesWithGivenID(t *testing.T) {
	env := testkit.New(t)
	anna := makeUser(t, env, "anna")
	id := "11111111-1111-1111-1111-111111111111"
	answer := env.Put("/markers/"+id, object{"name": "Gerät", "lat": 3.0, "lon": 4.0}, anna.Person).
		Expect(t, http.StatusCreated).Map(t)
	if answer["id"] != id {
		t.Fatal(answer)
	}
}

func TestPutReplacesExistingMarker(t *testing.T) {
	env := testkit.New(t)
	anna := makeUser(t, env, "anna")
	id := "22222222-2222-2222-2222-222222222222"
	first := env.Put("/markers/"+id, aMarker("Alt"), anna.Person).Expect(t, http.StatusCreated).Map(t)
	tick()
	answer := env.Put("/markers/"+id, aMarker("Neu"), anna.Person).Expect(t, http.StatusOK).Map(t)
	if answer["name"] != "Neu" || answer["createdAt"] != first["createdAt"] || answer["updatedAt"] == first["updatedAt"] {
		t.Fatal(first, answer)
	}
}

func TestPutOfForeignIDIsNotFound(t *testing.T) {
	env := testkit.New(t)
	anna, bert := makeUser(t, env, "anna"), makeUser(t, env, "bert")
	id := "33333333-3333-3333-3333-333333333333"
	env.Put("/markers/"+id, aMarker("Anna"), anna.Person).Expect(t, http.StatusCreated)
	env.Put("/markers/"+id, aMarker("Bert"), bert.Person).Expect(t, http.StatusNotFound)
}

func TestDeleteThenGetIsNotFound(t *testing.T) {
	env := testkit.New(t)
	anna := makeUser(t, env, "anna")
	id := env.Post("/markers", aMarker("A"), anna.Person).Map(t)["id"].(string)
	env.Delete("/markers/"+id, anna.Person).Expect(t, http.StatusNoContent)
	env.Delete("/markers/"+id, anna.Person).Expect(t, http.StatusNotFound)
	env.Get("/markers/"+id, anna.Person).Expect(t, http.StatusNotFound)
}

func TestPutRevivesADeletedMarker(t *testing.T) {
	env := testkit.New(t)
	anna := makeUser(t, env, "anna")
	id := env.Post("/markers", aMarker("A"), anna.Person).Map(t)["id"].(string)
	env.Delete("/markers/"+id, anna.Person).Expect(t, http.StatusNoContent)
	revived := env.Put("/markers/"+id, aMarker("B"), anna.Person).Expect(t, http.StatusCreated).Map(t)
	if revived["deleted"] != false {
		t.Fatal(revived)
	}
}

func TestChangesSinceIncludesDeletedRows(t *testing.T) {
	env := testkit.New(t)
	anna := makeUser(t, env, "anna")
	id := env.Post("/markers", aMarker("A"), anna.Person).Map(t)["id"].(string)
	env.Delete("/markers/"+id, anna.Person).Expect(t, http.StatusNoContent)
	listed := items(t, env.Get("/markers?since="+url.QueryEscape("1970-01-01T00:00:00Z"), anna.Person).Expect(t, http.StatusOK))
	if len(listed) != 1 || listed[0]["id"] != id || listed[0]["deleted"] != true {
		t.Fatal(listed)
	}
}

func TestSinceWithAnOffsetIsUTC(t *testing.T) {
	env := testkit.New(t)
	anna := makeUser(t, env, "anna")
	env.Post("/markers", aMarker("A"), anna.Person).Expect(t, http.StatusCreated)
	if listed := items(t, env.Get("/markers?since="+url.QueryEscape("2100-01-01T01:00:00+02:00"), anna.Person)); len(listed) != 0 {
		t.Fatal(listed)
	}
	if listed := items(t, env.Get("/markers?since="+url.QueryEscape("1970-01-01T01:00:00+02:00"), anna.Person)); len(listed) != 1 {
		t.Fatal(listed)
	}
}

func TestListWithoutSinceExcludesDeletedRows(t *testing.T) {
	env := testkit.New(t)
	anna := makeUser(t, env, "anna")
	id := env.Post("/markers", aMarker("A"), anna.Person).Map(t)["id"].(string)
	env.Delete("/markers/"+id, anna.Person).Expect(t, http.StatusNoContent)
	if listed := items(t, env.Get("/markers", anna.Person)); len(listed) != 0 {
		t.Fatal(listed)
	}
}

func TestPaginationReturnsANextCursor(t *testing.T) {
	env := testkit.New(t)
	anna := makeUser(t, env, "anna")
	env.Post("/markers", aMarker("A"), anna.Person).Expect(t, http.StatusCreated)
	env.Post("/markers", aMarker("B"), anna.Person).Expect(t, http.StatusCreated)
	first := env.Get("/markers?limit=1", anna.Person).Expect(t, http.StatusOK).Map(t)
	if len(first["items"].([]any)) != 1 || first["nextCursor"] == nil {
		t.Fatal(first)
	}
	second := env.Get("/markers?limit=1&cursor="+first["nextCursor"].(string), anna.Person).Map(t)
	if len(second["items"].([]any)) != 1 || second["nextCursor"] != nil {
		t.Fatal(second)
	}
}
