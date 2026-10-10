package objects_test

import (
	"encoding/json"
	"net/http"
	"net/url"
	"strings"
	"testing"
	"time"

	"github.com/frederikbeimgraben/kinoko/backend/internal/core/db"
	"github.com/frederikbeimgraben/kinoko/backend/internal/core/enums"
	"github.com/frederikbeimgraben/kinoko/backend/internal/modules/objects"
	"github.com/frederikbeimgraben/kinoko/backend/internal/testkit"
)

var aFind = object{"lat": 1.0, "lon": 1.0, "foundOn": "2026-09-01"}

func sharedTo(group db.ID) object {
	return object{"visibility": "shared", "groupId": group.String()}
}

func TestCreateAndGetFind(t *testing.T) {
	env := testkit.New(t)
	anna := makeUser(t, env, "anna")
	created := env.Post("/finds", object{"lat": 50.1, "lon": 8.6, "foundOn": "2026-09-01"}, anna.Person).
		Expect(t, http.StatusCreated).Map(t)
	if created["reviewState"] != "open" || created["ownerId"] != anna.ID.String() {
		t.Fatal(created)
	}
	env.Get("/finds/"+created["id"].(string), anna.Person).Expect(t, http.StatusOK)
}

func TestFindHasEachField(t *testing.T) {
	env := testkit.New(t)
	anna := makeUser(t, env, "anna")
	body := env.Post("/finds", aFind, anna.Person).Expect(t, http.StatusCreated).Body
	want := `"id","ownerId","speciesId","lat","lon","foundOn","count","forTraining","reviewState",` +
		`"reviewedById","reviewedAt","visibility","groupId","note","createdAt","updatedAt","deleted"`
	if got := keysOf(t, body); got != want {
		t.Fatalf("keys %s", got)
	}
}

func TestListMineRequiresLogin(t *testing.T) {
	env := testkit.New(t)
	env.Get("/finds", nil).Expect(t, http.StatusUnauthorized)
}

func TestListMineReturnsOnlyOwnFinds(t *testing.T) {
	env := testkit.New(t)
	anna, bert := makeUser(t, env, "anna"), makeUser(t, env, "bert")
	env.Post("/finds", aFind, anna.Person).Expect(t, http.StatusCreated)
	env.Post("/finds", object{"lat": 2.0, "lon": 2.0, "foundOn": "2026-09-01"}, bert.Person).Expect(t, http.StatusCreated)
	listed := items(t, env.Get("/finds", bert.Person).Expect(t, http.StatusOK))
	if len(listed) != 1 || listed[0]["lat"] != 2.0 {
		t.Fatal(listed)
	}
}

func TestSharedFindsStayHiddenWithoutLogin(t *testing.T) {
	env := testkit.New(t)
	anna := makeUser(t, env, "anna")
	group := makeGroup(t, env, anna.ID)
	env.Post("/finds", with(aFind, sharedTo(group)), anna.Person).Expect(t, http.StatusCreated)
	if listed := items(t, env.Get("/finds?mine=false", nil).Expect(t, http.StatusOK)); len(listed) != 0 {
		t.Fatal(listed)
	}
}

func TestSharedFindsExcludePrivateOnes(t *testing.T) {
	env := testkit.New(t)
	anna := makeUser(t, env, "anna")
	env.Post("/finds", aFind, anna.Person).Expect(t, http.StatusCreated)
	if listed := items(t, env.Get("/finds?mine=false", anna.Person)); len(listed) != 0 {
		t.Fatal(listed)
	}
}

func TestSharedFindsRespectSince(t *testing.T) {
	env := testkit.New(t)
	anna, bert := makeUser(t, env, "anna"), makeUser(t, env, "bert")
	group := makeGroup(t, env, anna.ID)
	env.Post("/finds", with(aFind, sharedTo(group)), anna.Person).Expect(t, http.StatusCreated)
	join(t, env, group, bert.ID)
	if listed := items(t, env.Get("/finds?mine=false&since="+url.QueryEscape("1970-01-01T00:00:00Z"), bert.Person)); len(listed) != 1 {
		t.Fatal(listed)
	}
	if listed := items(t, env.Get("/finds?mine=false&since="+url.QueryEscape("2100-01-01T00:00:00Z"), bert.Person)); len(listed) != 0 {
		t.Fatal(listed)
	}
}

func TestSharedFindsExcludeTheViewersOwn(t *testing.T) {
	env := testkit.New(t)
	anna := makeUser(t, env, "anna")
	group := makeGroup(t, env, anna.ID)
	env.Post("/finds", with(aFind, sharedTo(group)), anna.Person).Expect(t, http.StatusCreated)
	if listed := items(t, env.Get("/finds?mine=false", anna.Person)); len(listed) != 0 {
		t.Fatal(listed)
	}
}

func TestSharedFindsExposeTheOwnerID(t *testing.T) {
	env := testkit.New(t)
	anna, bert := makeUser(t, env, "anna"), makeUser(t, env, "bert")
	group := makeGroup(t, env, anna.ID)
	env.Post("/finds", with(aFind, sharedTo(group)), anna.Person).Expect(t, http.StatusCreated)
	join(t, env, group, bert.ID)
	listed := items(t, env.Get("/finds?mine=false", bert.Person))
	if len(listed) != 1 || listed[0]["ownerId"] != anna.ID.String() {
		t.Fatal(listed)
	}
}

var protectedFind = object{"lat": 50.123456, "lon": 8.123456, "foundOn": "2026-09-01"}

func TestSharedFindsCoarsenAProtectedSpecies(t *testing.T) {
	env := testkit.New(t)
	anna, bert := makeUser(t, env, "anna"), makeUser(t, env, "bert")
	species := makeSpecies(t, env, "probe-species", enums.ProtectionStrict)
	group := makeGroup(t, env, anna.ID)
	env.Post("/finds", with(with(protectedFind, sharedTo(group)), object{"speciesId": species.String()}), anna.Person).
		Expect(t, http.StatusCreated)
	join(t, env, group, bert.ID)
	listed := items(t, env.Get("/finds?mine=false", bert.Person))
	// The values are the fixed reference values of geo.Coarse.
	if listed[0]["lat"] != 50.12576356449874 || listed[0]["lon"] != 8.126918419350993 {
		t.Fatal(listed[0])
	}
}

func TestOwnFindsStayExactForAProtectedSpecies(t *testing.T) {
	env := testkit.New(t)
	anna := makeUser(t, env, "anna")
	species := makeSpecies(t, env, "probe-species", enums.ProtectionStrict)
	env.Post("/finds", with(protectedFind, object{"speciesId": species.String()}), anna.Person).Expect(t, http.StatusCreated)
	listed := items(t, env.Get("/finds", anna.Person))
	if listed[0]["lat"] != 50.123456 || listed[0]["lon"] != 8.123456 {
		t.Fatal(listed[0])
	}
}

func TestSpeciesFilter(t *testing.T) {
	env := testkit.New(t)
	anna := makeUser(t, env, "anna")
	species := makeSpecies(t, env, "probe-species", enums.ProtectionNone)
	env.Post("/finds", with(aFind, object{"speciesId": species.String()}), anna.Person).Expect(t, http.StatusCreated)
	env.Post("/finds", object{"lat": 2.0, "lon": 2.0, "foundOn": "2026-09-01"}, anna.Person).Expect(t, http.StatusCreated)
	if listed := items(t, env.Get("/finds?speciesId="+species.String(), anna.Person)); len(listed) != 1 {
		t.Fatal(listed)
	}
}

func TestBboxFilter(t *testing.T) {
	env := testkit.New(t)
	anna := makeUser(t, env, "anna")
	env.Post("/finds", object{"lat": 50.0, "lon": 8.0, "foundOn": "2026-09-01"}, anna.Person).Expect(t, http.StatusCreated)
	env.Post("/finds", object{"lat": 60.0, "lon": 20.0, "foundOn": "2026-09-01"}, anna.Person).Expect(t, http.StatusCreated)
	if listed := items(t, env.Get("/finds?bbox=7,49,9,51", anna.Person)); len(listed) != 1 {
		t.Fatal(listed)
	}
}

func TestInvalidBboxIs422(t *testing.T) {
	env := testkit.New(t)
	anna := makeUser(t, env, "anna")
	answer := env.Get("/finds?bbox=not-a-bbox", anna.Person).Expect(t, http.StatusUnprocessableEntity)
	if errs := fieldErrors(t, answer); len(errs) != 1 || errs[0]["field"] != "bbox" || errs[0]["code"] != "bbox" {
		t.Fatal(errs)
	}
}

func TestPutRevivesADeletedFind(t *testing.T) {
	env := testkit.New(t)
	anna := makeUser(t, env, "anna")
	id := env.Post("/finds", aFind, anna.Person).Map(t)["id"].(string)
	env.Delete("/finds/"+id, anna.Person).Expect(t, http.StatusNoContent)
	revived := env.Put("/finds/"+id, aFind, anna.Person).Expect(t, http.StatusCreated).Map(t)
	if revived["deleted"] != false {
		t.Fatal(revived)
	}
}

func TestReviewRequiresTheRight(t *testing.T) {
	env := testkit.New(t)
	anna := makeUser(t, env, "anna")
	id := env.Post("/finds", aFind, anna.Person).Map(t)["id"].(string)
	env.Post("/finds/"+id+"/review", object{"decision": "accepted"}, anna.Person).Expect(t, http.StatusForbidden)
}

func TestReviewSetsStateAndReviewer(t *testing.T) {
	env := testkit.New(t)
	anna, reviewer := makeUser(t, env, "anna"), makeReviewer(t, env, "reviewer")
	id := env.Post("/finds", aFind, anna.Person).Map(t)["id"].(string)
	body := env.Post("/finds/"+id+"/review", object{"decision": "rejected"}, reviewer.Person).
		Expect(t, http.StatusOK).Map(t)
	if body["reviewState"] != "rejected" || body["reviewedById"] != reviewer.ID.String() || body["reviewedAt"] == nil {
		t.Fatal(body)
	}
}

func TestReviewOfMissingFindIsNotFound(t *testing.T) {
	env := testkit.New(t)
	reviewer := makeReviewer(t, env, "reviewer")
	env.Post("/finds/"+db.NewID().String()+"/review", object{"decision": "accepted"}, reviewer.Person).
		Expect(t, http.StatusNotFound)
}

func TestReopenPutsADecidedFindBackInTheQueue(t *testing.T) {
	env := testkit.New(t)
	anna, reviewer := makeUser(t, env, "anna"), makeReviewer(t, env, "reviewer")
	id := env.Post("/finds", aFind, anna.Person).Map(t)["id"].(string)
	env.Post("/finds/"+id+"/review", object{"decision": "accepted"}, reviewer.Person).Expect(t, http.StatusOK)
	body := env.Delete("/finds/"+id+"/review", reviewer.Person).Expect(t, http.StatusOK).Map(t)
	if body["reviewState"] != "open" || body["reviewedById"] != nil || body["reviewedAt"] != nil {
		t.Fatal(body)
	}
	if listed := items(t, env.Get("/finds/reviews/open", reviewer.Person)); len(listed) != 1 {
		t.Fatal(listed)
	}
	env.Delete("/finds/"+id+"/review", reviewer.Person).Expect(t, http.StatusConflict)
}

func TestReopenRequiresTheRight(t *testing.T) {
	env := testkit.New(t)
	anna, reviewer := makeUser(t, env, "anna"), makeReviewer(t, env, "reviewer")
	id := env.Post("/finds", aFind, anna.Person).Map(t)["id"].(string)
	env.Delete("/finds/"+id+"/review", anna.Person).Expect(t, http.StatusForbidden)
	env.Delete("/finds/"+db.NewID().String()+"/review", reviewer.Person).Expect(t, http.StatusNotFound)
}

func TestOpenFindsRequiresTheRight(t *testing.T) {
	env := testkit.New(t)
	anna := makeUser(t, env, "anna")
	env.Get("/finds/reviews/open", anna.Person).Expect(t, http.StatusForbidden)
}

func TestOpenFindsListsEveryAccount(t *testing.T) {
	env := testkit.New(t)
	anna, bert, reviewer := makeUser(t, env, "anna"), makeUser(t, env, "bert"), makeReviewer(t, env, "reviewer")
	env.Post("/finds", aFind, anna.Person).Expect(t, http.StatusCreated)
	done := env.Post("/finds", object{"lat": 2.0, "lon": 2.0, "foundOn": "2026-09-01"}, bert.Person).Map(t)["id"].(string)
	env.Post("/finds/"+done+"/review", object{"decision": "accepted"}, reviewer.Person).Expect(t, http.StatusOK)
	listed := items(t, env.Get("/finds/reviews/open", reviewer.Person).Expect(t, http.StatusOK))
	if len(listed) != 1 || listed[0]["lat"] != 1.0 || listed[0]["ownerId"] != anna.ID.String() {
		t.Fatal(listed)
	}
	if listed[0]["ownerName"] != "anna" {
		t.Fatalf("the reviewer sees the reporter by name: %v", listed[0]["ownerName"])
	}
}

func TestAcceptAllOpenFinds(t *testing.T) {
	env := testkit.New(t)
	anna, reviewer := makeUser(t, env, "anna"), makeReviewer(t, env, "reviewer")
	env.Post("/finds", aFind, anna.Person).Expect(t, http.StatusCreated)
	env.Post("/finds", object{"lat": 2.0, "lon": 2.0, "foundOn": "2026-09-01"}, anna.Person).Expect(t, http.StatusCreated)
	env.Post("/finds/reviews/accept-all", nil, reviewer.Person).Expect(t, http.StatusNoContent)
	listed := items(t, env.Get("/finds", anna.Person))
	for _, item := range listed {
		if item["reviewState"] != "accepted" || item["reviewedById"] != reviewer.ID.String() {
			t.Fatal(item)
		}
	}
	if len(listed) != 2 {
		t.Fatal(listed)
	}
}

func TestTrainingFindsFiltersCorrectly(t *testing.T) {
	env := testkit.New(t)
	anna, reviewer := makeUser(t, env, "anna"), makeReviewer(t, env, "reviewer")
	species := makeSpecies(t, env, "probe-species", enums.ProtectionNone)
	ready := env.Post("/finds", with(aFind, object{"speciesId": species.String(), "forTraining": true, "count": 3}), anna.Person).
		Map(t)["id"].(string)
	env.Post("/finds", object{"lat": 2.0, "lon": 2.0, "foundOn": "2026-09-01", "forTraining": true}, anna.Person).
		Expect(t, http.StatusCreated)
	env.Post("/finds/"+ready+"/review", object{"decision": "accepted"}, reviewer.Person).Expect(t, http.StatusOK)
	rows, err := objects.TrainingFinds(ctx(), env.DB)
	if err != nil {
		t.Fatal(err)
	}
	if len(rows) != 1 || rows[0].ID.String() != ready || rows[0].SpeciesID != species ||
		rows[0].Count == nil || *rows[0].Count != 3 || rows[0].FoundOn.String() != "2026-09-01" {
		t.Fatal(rows)
	}
}

func TestCreateFindRejectsACountThatInt64CannotHold(t *testing.T) {
	env := testkit.New(t)
	anna := makeUser(t, env, "anna")
	for _, count := range []string{"1e19", "10000000000000000000"} {
		answer := env.Post("/finds", with(aFind, object{"count": json.RawMessage(count)}), anna.Person).
			Expect(t, http.StatusUnprocessableEntity)
		if errs := fieldErrors(t, answer); len(errs) != 1 || errs[0]["field"] != "count" || errs[0]["code"] != "int_parsing" {
			t.Fatal(string(answer.Body))
		}
	}
	made := env.Post("/finds", with(aFind, object{"count": json.RawMessage("9007199254740993")}), anna.Person).
		Expect(t, http.StatusCreated).Body
	if !strings.Contains(string(made), `"count":9007199254740993`) {
		t.Fatal(string(made))
	}
}

func TestFindWritesCheckThePlaceAndTheDay(t *testing.T) {
	env := testkit.New(t)
	anna := makeUser(t, env, "anna")
	cases := []struct {
		body        object
		field, code string
	}{
		{object{"lat": 95.0, "lon": 8.6, "foundOn": "2026-09-01"}, "lat", "less_than_equal"},
		{object{"lat": -91.0, "lon": 8.6, "foundOn": "2026-09-01"}, "lat", "greater_than_equal"},
		{object{"lat": 50.1, "lon": 181.0, "foundOn": "2026-09-01"}, "lon", "less_than_equal"},
		{object{"lat": 50.1, "lon": -180.5, "foundOn": "2026-09-01"}, "lon", "greater_than_equal"},
		{object{"lat": 50.1, "lon": 8.6, "foundOn": "2099-09-01"}, "foundOn", "less_than_equal"},
	}
	for _, c := range cases {
		answer := env.Post("/finds", c.body, anna.Person).Expect(t, http.StatusUnprocessableEntity)
		if errs := fieldErrors(t, answer); len(errs) != 1 || errs[0]["field"] != c.field || errs[0]["code"] != c.code {
			t.Errorf("%v: %v", c.body, errs)
		}
	}
	tomorrow := env.Now.AddDate(0, 0, 1).Format(time.DateOnly)
	env.Post("/finds", object{"lat": 50.1, "lon": 8.6, "foundOn": tomorrow}, anna.Person).Expect(t, http.StatusCreated)
}
