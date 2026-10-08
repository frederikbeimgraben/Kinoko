package access_test

import (
	"net/http"
	"slices"
	"strings"
	"testing"

	"github.com/frederikbeimgraben/kinoko/backend/internal/core/db"
	"github.com/frederikbeimgraben/kinoko/backend/internal/testkit"
)

func aGroup(t testing.TB, env *testkit.Env, as *testkit.Person, name string) map[string]any {
	t.Helper()
	return env.Post("/groups", map[string]any{"name": name}, as).Expect(t, http.StatusCreated).Map(t)
}

func join(t testing.TB, env *testkit.Env, as *testkit.Person, group map[string]any) testkit.Response {
	t.Helper()
	return env.Post("/groups/join", map[string]any{"inviteCode": group["inviteCode"]}, as)
}

func memberNames(group map[string]any) []string { return field(group["members"], "name") }

func TestCreatePutsTheOwnerInTheGroup(t *testing.T) {
	env := testkit.New(t)
	anna := makeUser(t, env, "anna")
	body := aGroup(t, env, signIn(t, env, anna), "Familie")
	if body["name"] != "Familie" || body["ownerId"] != anna.ID.String() {
		t.Fatal(body)
	}
	if !strings.HasPrefix(body["inviteCode"].(string), "PILZ-") || len(body["inviteCode"].(string)) != 9 {
		t.Fatal(body)
	}
	if !slices.Equal(memberNames(body), []string{"anna"}) {
		t.Fatal(body)
	}
}

func TestListShowsOnlyOwnGroups(t *testing.T) {
	env := testkit.New(t)
	anna := makeUser(t, env, "anna")
	bert := makeUser(t, env, "bert")
	aGroup(t, env, signIn(t, env, anna), "Anna")
	aGroup(t, env, signIn(t, env, bert), "Bert")
	listed := env.Get("/groups", signIn(t, env, bert)).Expect(t, http.StatusOK).Map(t)
	if got := field(listed["items"], "name"); !slices.Equal(got, []string{"Bert"}) {
		t.Fatal(got)
	}
}

func TestListAllNeedsTheRight(t *testing.T) {
	env := testkit.New(t)
	anna := makeUser(t, env, "anna")
	aGroup(t, env, signIn(t, env, anna), "Anna")
	bert := makeUser(t, env, "bert")
	env.Get("/groups?all=true", signIn(t, env, bert)).Expect(t, http.StatusForbidden)
	every := env.Get("/groups?all=true", signIn(t, env, bert, "group.manage")).Expect(t, http.StatusOK).Map(t)
	if got := field(every["items"], "name"); !slices.Equal(got, []string{"Anna"}) {
		t.Fatal(got)
	}
}

func TestListRequiresLogin(t *testing.T) {
	env := testkit.New(t)
	env.Get("/groups", nil).Expect(t, http.StatusUnauthorized)
}

func TestJoinWithTheInviteCode(t *testing.T) {
	env := testkit.New(t)
	anna := makeUser(t, env, "anna")
	bert := makeUser(t, env, "bert")
	group := aGroup(t, env, signIn(t, env, anna), "Familie")
	joined := join(t, env, signIn(t, env, bert), group).Expect(t, http.StatusOK).Map(t)
	if got := sortedField(joined["members"], "name"); !slices.Equal(got, []string{"anna", "bert"}) {
		t.Fatal(got)
	}
	lower := map[string]any{"inviteCode": "  " + strings.ToLower(group["inviteCode"].(string)) + " "}
	again := join(t, env, signIn(t, env, bert), lower).Expect(t, http.StatusOK).Map(t)
	if len(again["members"].([]any)) != 2 {
		t.Fatal(again)
	}
}

func TestJoinWithAnUnknownCode(t *testing.T) {
	env := testkit.New(t)
	anna := makeUser(t, env, "anna")
	join(t, env, signIn(t, env, anna), map[string]any{"inviteCode": "PILZ-0000"}).Expect(t, http.StatusNotFound)
}

func TestReadNeedsMembership(t *testing.T) {
	env := testkit.New(t)
	anna := makeUser(t, env, "anna")
	bert := makeUser(t, env, "bert")
	group := aGroup(t, env, signIn(t, env, anna), "Familie")
	path := "/groups/" + group["id"].(string)
	env.Get(path, signIn(t, env, anna)).Expect(t, http.StatusOK)
	env.Get(path, signIn(t, env, bert)).Expect(t, http.StatusNotFound)
	env.Get(path, signIn(t, env, bert, "group.manage")).Expect(t, http.StatusOK)
}

func TestRenameBelongsToTheOwner(t *testing.T) {
	env := testkit.New(t)
	anna := makeUser(t, env, "anna")
	bert := makeUser(t, env, "bert")
	group := aGroup(t, env, signIn(t, env, anna), "Familie")
	join(t, env, signIn(t, env, bert), group).Expect(t, http.StatusOK)
	path := "/groups/" + group["id"].(string)
	env.Put(path, map[string]any{"name": "Neu"}, signIn(t, env, bert)).Expect(t, http.StatusForbidden)
	renamed := env.Put(path, map[string]any{"name": "Neu"}, signIn(t, env, anna)).Expect(t, http.StatusOK).Map(t)
	if renamed["name"] != "Neu" {
		t.Fatal(renamed)
	}
}

func TestOwnerRemovesAMember(t *testing.T) {
	env := testkit.New(t)
	anna := makeUser(t, env, "anna")
	bert := makeUser(t, env, "bert")
	group := aGroup(t, env, signIn(t, env, anna), "Familie")
	join(t, env, signIn(t, env, bert), group).Expect(t, http.StatusOK)
	path := "/groups/" + group["id"].(string)
	env.Delete(path+"/members/"+bert.ID.String(), signIn(t, env, anna)).Expect(t, http.StatusNoContent)
	read := env.Get(path, signIn(t, env, anna)).Expect(t, http.StatusOK).Map(t)
	if len(read["members"].([]any)) != 1 {
		t.Fatal(read)
	}
}

func TestAMemberLeaves(t *testing.T) {
	env := testkit.New(t)
	anna := makeUser(t, env, "anna")
	bert := makeUser(t, env, "bert")
	group := aGroup(t, env, signIn(t, env, anna), "Familie")
	join(t, env, signIn(t, env, bert), group).Expect(t, http.StatusOK)
	now := db.Now()
	shared := db.NewID()
	exec(t, env, `INSERT INTO marker (id, owner_id, name, lat, lon, colour, visibility, group_id, created_at, updated_at)
		VALUES (?, ?, 'Spot', 1.0, 2.0, 'green', 'group', ?, ?, ?)`, shared, bert.ID, db.MustID(group["id"].(string)), now, now)
	env.Delete("/groups/"+group["id"].(string)+"/members/"+bert.ID.String(), signIn(t, env, bert)).Expect(t, http.StatusNoContent)
	listed := env.Get("/groups", signIn(t, env, bert)).Expect(t, http.StatusOK)
	if string(listed.Body) != `{"items":[]}` {
		t.Fatalf("%s", listed.Body)
	}
	if v := scalar[string](t, env, "SELECT visibility FROM marker WHERE id = ? AND group_id IS NULL", shared); v != "private" {
		t.Fatal(v)
	}
}

func TestTheOwnerCannotLeave(t *testing.T) {
	env := testkit.New(t)
	anna := makeUser(t, env, "anna")
	group := aGroup(t, env, signIn(t, env, anna), "Familie")
	env.Delete("/groups/"+group["id"].(string)+"/members/"+anna.ID.String(), signIn(t, env, anna)).
		Expect(t, http.StatusForbidden)
}

func TestRemovingSomeoneOutsideTheGroup(t *testing.T) {
	env := testkit.New(t)
	anna := makeUser(t, env, "anna")
	bert := makeUser(t, env, "bert")
	group := aGroup(t, env, signIn(t, env, anna), "Familie")
	env.Delete("/groups/"+group["id"].(string)+"/members/"+bert.ID.String(), signIn(t, env, anna)).
		Expect(t, http.StatusNotFound)
}

func TestAStrangerRemovesNobody(t *testing.T) {
	env := testkit.New(t)
	anna := makeUser(t, env, "anna")
	bert := makeUser(t, env, "bert")
	carl := makeUser(t, env, "carl")
	group := aGroup(t, env, signIn(t, env, anna), "Familie")
	join(t, env, signIn(t, env, bert), group).Expect(t, http.StatusOK)
	env.Delete("/groups/"+group["id"].(string)+"/members/"+bert.ID.String(), signIn(t, env, carl)).
		Expect(t, http.StatusForbidden)
}

func TestDeleteBelongsToTheOwner(t *testing.T) {
	env := testkit.New(t)
	anna := makeUser(t, env, "anna")
	bert := makeUser(t, env, "bert")
	group := aGroup(t, env, signIn(t, env, anna), "Familie")
	path := "/groups/" + group["id"].(string)
	now := db.Now()
	find := db.NewID()
	exec(t, env, `INSERT INTO find (id, owner_id, lat, lon, found_on, for_training, review_state, visibility, group_id,
		created_at, updated_at) VALUES (?, ?, 1.0, 2.0, '2026-06-01', 0, 'open', 'group', ?, ?, ?)`,
		find, anna.ID, db.MustID(group["id"].(string)), now, now)
	env.Delete(path, signIn(t, env, bert)).Expect(t, http.StatusForbidden)
	env.Delete(path, signIn(t, env, bert, "group.manage")).Expect(t, http.StatusNoContent)
	env.Get(path, signIn(t, env, anna)).Expect(t, http.StatusNotFound)
	if v := scalar[string](t, env, "SELECT visibility FROM find WHERE id = ? AND group_id IS NULL", find); v != "private" {
		t.Fatal(v)
	}
}

func TestAnUnknownGroup(t *testing.T) {
	env := testkit.New(t)
	anna := makeUser(t, env, "anna")
	as := signIn(t, env, anna)
	missing := "/groups/11111111-1111-1111-1111-111111111111"
	env.Get(missing, as).Expect(t, http.StatusNotFound)
	env.Put(missing, map[string]any{"name": "X"}, as).Expect(t, http.StatusNotFound)
	env.Delete(missing, as).Expect(t, http.StatusNotFound)
}
