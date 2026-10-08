package objects_test

import (
	"net/http"
	"testing"

	"github.com/frederikbeimgraben/kinoko/backend/internal/core/db"
	"github.com/frederikbeimgraben/kinoko/backend/internal/testkit"
)

var (
	visFind   = object{"lat": 50.0, "lon": 8.0, "foundOn": "2026-09-01"}
	visMarker = object{"name": "Stelle", "lat": 50.0, "lon": 8.0}
	visZone   = object{"name": "Wald", "polygon": object{
		"type":        "Polygon",
		"coordinates": [][][]float64{{{8.0, 50.0}, {8.01, 50.0}, {8.01, 50.01}, {8.0, 50.01}, {8.0, 50.0}}},
	}}
)

func TestSharedWithoutAGroupIsRefused(t *testing.T) {
	env := testkit.New(t)
	anna := makeUser(t, env, "anna")
	answer := env.Post("/finds", with(visFind, object{"visibility": "shared"}), anna.Person).
		Expect(t, http.StatusUnprocessableEntity)
	if errs := fieldErrors(t, answer); len(errs) != 1 || errs[0]["field"] != "groupId" || errs[0]["code"] != "group" {
		t.Fatal(errs)
	}
}

func TestSharedToAForeignGroupIsRefused(t *testing.T) {
	env := testkit.New(t)
	anna, bert := makeUser(t, env, "anna"), makeUser(t, env, "bert")
	group := makeGroup(t, env, anna.ID)
	env.Post("/finds", with(visFind, sharedTo(group)), bert.Person).Expect(t, http.StatusUnprocessableEntity)
}

func TestPrivateDropsTheGroup(t *testing.T) {
	env := testkit.New(t)
	anna := makeUser(t, env, "anna")
	group := makeGroup(t, env, anna.ID)
	made := env.Post("/finds", with(visFind, object{"visibility": "private", "groupId": group.String()}), anna.Person).
		Expect(t, http.StatusCreated).Map(t)
	if made["groupId"] != nil {
		t.Fatal(made)
	}
}

func TestTheGroupSeesASharedFind(t *testing.T) {
	env := testkit.New(t)
	anna, bert, carl := makeUser(t, env, "anna"), makeUser(t, env, "bert"), makeUser(t, env, "carl")
	group := makeGroup(t, env, anna.ID)
	made := env.Post("/finds", with(visFind, sharedTo(group)), anna.Person).Expect(t, http.StatusCreated).Map(t)
	if made["groupId"] != group.String() {
		t.Fatal(made)
	}
	join(t, env, group, bert.ID)
	if seen := ids(items(t, env.Get("/finds?mine=false", bert.Person))); len(seen) != 1 || seen[0] != made["id"] {
		t.Fatal(seen)
	}
	if seen := items(t, env.Get("/finds?mine=false", carl.Person)); len(seen) != 0 {
		t.Fatal(seen)
	}
}

func TestAGuestSeesNoSharedFind(t *testing.T) {
	env := testkit.New(t)
	anna := makeUser(t, env, "anna")
	group := makeGroup(t, env, anna.ID)
	env.Post("/finds", with(visFind, sharedTo(group)), anna.Person).Expect(t, http.StatusCreated)
	if seen := items(t, env.Get("/finds?mine=False", nil).Expect(t, http.StatusOK)); len(seen) != 0 {
		t.Fatal(seen)
	}
}

func TestMarkersAndZonesCarryTheGroup(t *testing.T) {
	env := testkit.New(t)
	anna := makeUser(t, env, "anna")
	group := makeGroup(t, env, anna.ID)
	marker := env.Post("/markers", with(visMarker, sharedTo(group)), anna.Person).Expect(t, http.StatusCreated).Map(t)
	zone := env.Post("/zones", with(visZone, sharedTo(group)), anna.Person).Expect(t, http.StatusCreated).Map(t)
	if marker["groupId"] != group.String() || zone["groupId"] != group.String() {
		t.Fatal(marker, zone)
	}
	env.Post("/markers", with(visMarker, object{"visibility": "shared"}), anna.Person).Expect(t, http.StatusUnprocessableEntity)
	env.Post("/zones", with(visZone, object{"visibility": "shared"}), anna.Person).Expect(t, http.StatusUnprocessableEntity)
}

// groupByAPI makes a group through the access module. The test stops when
// the access module does not serve groups.
func groupByAPI(t *testing.T, env *testkit.Env, owner account) db.ID {
	t.Helper()
	answer := env.Post("/groups", object{"name": "Familie"}, owner.Person)
	if answer.Status != http.StatusCreated && answer.Status != http.StatusOK {
		t.Skipf("the access module does not serve POST /groups: %d", answer.Status)
	}
	id, err := db.ParseID(answer.Map(t)["id"].(string))
	if err != nil {
		t.Fatal(err)
	}
	return id
}

func TestDeletingAGroupMakesItsEntriesPrivate(t *testing.T) {
	env := testkit.New(t)
	anna := makeUser(t, env, "anna")
	group := groupByAPI(t, env, anna)
	find := env.Post("/finds", with(visFind, sharedTo(group)), anna.Person).Expect(t, http.StatusCreated).Map(t)
	marker := env.Post("/markers", with(visMarker, sharedTo(group)), anna.Person).Expect(t, http.StatusCreated).Map(t)
	env.Delete("/groups/"+group.String(), anna.Person).Expect(t, http.StatusNoContent)
	after := env.Get("/finds/"+find["id"].(string), anna.Person).Map(t)
	if after["visibility"] != "private" || after["groupId"] != nil {
		t.Fatal(after)
	}
	if m := env.Get("/markers/"+marker["id"].(string), anna.Person).Map(t); m["groupId"] != nil {
		t.Fatal(m)
	}
}

func TestRemovingAMemberMakesOnlyTheirEntriesPrivate(t *testing.T) {
	env := testkit.New(t)
	anna, bert := makeUser(t, env, "anna"), makeUser(t, env, "bert")
	group := groupByAPI(t, env, anna)
	hers := env.Post("/finds", with(visFind, sharedTo(group)), anna.Person).Expect(t, http.StatusCreated).Map(t)
	join(t, env, group, bert.ID)
	his := env.Post("/finds", with(visFind, sharedTo(group)), bert.Person).Expect(t, http.StatusCreated).Map(t)
	env.Delete("/groups/"+group.String()+"/members/"+bert.ID.String(), anna.Person).Expect(t, http.StatusNoContent)
	if after := env.Get("/finds/"+hers["id"].(string), anna.Person).Map(t); after["groupId"] != group.String() {
		t.Fatal(after)
	}
	if after := env.Get("/finds/"+his["id"].(string), bert.Person).Map(t); after["visibility"] != "private" {
		t.Fatal(after)
	}
}

func TestPutKeepsTheGroupRule(t *testing.T) {
	env := testkit.New(t)
	anna := makeUser(t, env, "anna")
	group := makeGroup(t, env, anna.ID)
	id := "33333333-3333-3333-3333-333333333333"
	env.Put("/finds/"+id, with(visFind, sharedTo(group)), anna.Person).Expect(t, http.StatusCreated)
	back := env.Put("/finds/"+id, with(visFind, object{"visibility": "private"}), anna.Person).Expect(t, http.StatusOK).Map(t)
	if back["groupId"] != nil {
		t.Fatal(back)
	}
}
