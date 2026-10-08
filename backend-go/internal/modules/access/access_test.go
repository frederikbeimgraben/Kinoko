package access_test

import (
	"context"
	"errors"
	"net/http"
	"net/url"
	"os"
	"path/filepath"
	"slices"
	"strings"
	"testing"

	"github.com/frederikbeimgraben/kinoko/backend/internal/core/db"
	"github.com/frederikbeimgraben/kinoko/backend/internal/core/problem"
	"github.com/frederikbeimgraben/kinoko/backend/internal/modules/access"
	"github.com/frederikbeimgraben/kinoko/backend/internal/testkit"
)

func code(t testing.TB, r testkit.Response) string {
	t.Helper()
	value, _ := r.Map(t)["code"].(string)
	return value
}

func ids(t testing.TB, items any) []string {
	t.Helper()
	out := []string{}
	for _, item := range items.([]any) {
		out = append(out, item.(map[string]any)["id"].(string))
	}
	return out
}

func field(items any, name string) []string {
	out := []string{}
	for _, item := range items.([]any) {
		out = append(out, item.(map[string]any)[name].(string))
	}
	return out
}

func sortedField(items any, name string) []string {
	return slices.Sorted(slices.Values(field(items, name)))
}

func insertFind(t testing.TB, env *testkit.Env, owner db.ID, review string, deleted bool) db.ID {
	t.Helper()
	id := db.NewID()
	now := db.Now()
	var deletedAt *db.Time
	if deleted {
		deletedAt = &now
	}
	exec(t, env, `INSERT INTO find (id, owner_id, lat, lon, found_on, for_training, review_state, visibility,
		created_at, updated_at, deleted_at) VALUES (?, ?, 1.0, 2.0, '2026-06-01', 0, ?, 'private', ?, ?, ?)`,
		id, owner, review, now, now, deletedAt)
	return id
}

func insertMarker(t testing.TB, env *testkit.Env, owner db.ID, name string) db.ID {
	t.Helper()
	id := db.NewID()
	now := db.Now()
	exec(t, env, `INSERT INTO marker (id, owner_id, name, lat, lon, colour, visibility, created_at, updated_at)
		VALUES (?, ?, ?, 1.0, 2.0, 'green', 'private', ?, ?)`, id, owner, name, now, now)
	return id
}

func insertPhoto(t testing.TB, env *testkit.Env, owner db.ID, state string) db.ID {
	t.Helper()
	id := db.NewID()
	now := db.Now()
	exec(t, env, `INSERT INTO photo (id, owner_id, width, height, photographer, licence, lead, state, created_at, updated_at)
		VALUES (?, ?, 10, 10, 'Owner', 'own', 0, ?, ?, ?)`, id, owner, state, now, now)
	return id
}

func TestMeReturnsTheSignedInAccount(t *testing.T) {
	env := testkit.New(t)
	u := makeUser(t, env, "person-a")
	body := env.Get("/me", signIn(t, env, u)).Expect(t, http.StatusOK)
	expected := `{"id":"` + u.ID.String() + `","sub":"person-a","email":"person-a@example.test","name":"person-a"}`
	if string(body.Body) != expected {
		t.Fatalf("%s", body.Body)
	}
}

func TestMeNeedsASignedInAccount(t *testing.T) {
	env := testkit.New(t)
	env.Get("/me", nil).Expect(t, http.StatusUnauthorized)
}

func TestMyPermissionsEndpointNeedsASignedInAccount(t *testing.T) {
	env := testkit.New(t)
	env.Get("/me/permissions", nil).Expect(t, http.StatusUnauthorized)
}

func TestExportContainsOwnObjectsAndSkipsDeletedOnes(t *testing.T) {
	env := testkit.New(t)
	u := makeUser(t, env, "owner")
	other := makeUser(t, env, "other")
	find := insertFind(t, env, u.ID, "open", false)
	insertFind(t, env, u.ID, "open", true)
	marker := insertMarker(t, env, u.ID, "Spot")
	now := db.Now()
	exec(t, env, `INSERT INTO zone (id, owner_id, name, polygon, area_ha, colour, visibility, created_at, updated_at)
		VALUES (?, ?, 'Wald', ?, 1.5, 'green', 'private', ?, ?)`, db.NewID(), u.ID,
		`{"type": "Polygon", "coordinates": [[[0, 0], [1, 0], [1, 1], [0, 0]]]}`, now, now)
	exec(t, env, `INSERT INTO combination (id, owner_id, name, rule, factors, created_at, updated_at)
		VALUES (?, ?, 'Regel', 'intersection', ?, ?, ?)`, db.NewID(), u.ID,
		`[{"source": "temp", "condition": "above", "low": 10.0, "active": true}]`, now, now)
	photo := insertPhoto(t, env, u.ID, "private")
	insertMarker(t, env, other.ID, "Fremd")

	body := env.Get("/me/export", signIn(t, env, u)).Expect(t, http.StatusOK).Map(t)
	if body["me"].(map[string]any)["sub"] != "owner" {
		t.Fatal(body["me"])
	}
	if got := ids(t, body["finds"]); !slices.Equal(got, []string{find.String()}) {
		t.Fatal(got)
	}
	if got := ids(t, body["markers"]); !slices.Equal(got, []string{marker.String()}) {
		t.Fatal(got)
	}
	zone := body["zones"].([]any)[0].(map[string]any)
	if len(zone["polygon"].(map[string]any)["coordinates"].([]any)) == 0 || zone["deleted"] != false {
		t.Fatal(zone)
	}
	factor := body["combinations"].([]any)[0].(map[string]any)["factors"].([]any)[0].(map[string]any)
	if factor["source"] != "temp" || factor["high"] != nil {
		t.Fatal(factor)
	}
	if got := ids(t, body["photos"]); !slices.Equal(got, []string{photo.String()}) {
		t.Fatal(got)
	}
}

func TestDeleteMyDataRemovesOwnedRowsButKeepsTheAccount(t *testing.T) {
	env := testkit.New(t)
	u := makeUser(t, env, "owner")
	insertMarker(t, env, u.ID, "Spot")
	photo := insertPhoto(t, env, u.ID, "private")
	folder := filepath.Join(env.Settings.Photos, photo.String())
	if err := os.MkdirAll(folder, 0o755); err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(filepath.Join(folder, "full.jpg"), []byte("x"), 0o644); err != nil {
		t.Fatal(err)
	}

	env.Delete("/me/data", signIn(t, env, u)).Expect(t, http.StatusNoContent)
	if n := scalar[int](t, env, "SELECT count(*) FROM marker WHERE owner_id = ?", u.ID); n != 0 {
		t.Fatal(n)
	}
	if n := scalar[int](t, env, "SELECT count(*) FROM photo WHERE owner_id = ?", u.ID); n != 0 {
		t.Fatal(n)
	}
	if n := scalar[int](t, env, "SELECT count(*) FROM user WHERE id = ?", u.ID); n != 1 {
		t.Fatal(n)
	}
	if _, err := os.Stat(folder); !errors.Is(err, os.ErrNotExist) {
		t.Fatalf("photo folder stays: %v", err)
	}
}

func TestListPermissionsNeedsRoleManage(t *testing.T) {
	env := testkit.New(t)
	u := makeUser(t, env, "person-1")
	body := env.Get("/permissions", signIn(t, env, u, "role.manage")).Expect(t, http.StatusOK).Map(t)
	if !slices.Contains(field(body["items"], "key"), "role.manage") {
		t.Fatal(body)
	}
}

func TestListPermissionsReportsAreasByContract(t *testing.T) {
	env := testkit.New(t)
	u := makeUser(t, env, "person-1")
	answer := env.Get("/permissions", signIn(t, env, u, "role.manage")).Expect(t, http.StatusOK)
	expected := `{"items":[{"key":"species.edit","area":"species"},{"key":"image.submit","area":"species"},` +
		`{"key":"image.review","area":"species"},{"key":"text.edit","area":"interface"},` +
		`{"key":"role.manage","area":"access"},{"key":"role.assign","area":"access"},` +
		`{"key":"find.review","area":"data"},{"key":"run.manage","area":"data"},{"key":"group.manage","area":"access"},` +
		`{"key":"data.manage","area":"data"}]}`
	if string(answer.Body) != expected {
		t.Fatalf("%s", answer.Body)
	}
}

func TestSeedGrantsImageSubmitToTheUserRole(t *testing.T) {
	env := testkit.New(t)
	held, err := db.Column[string](context.Background(), env.DB,
		"SELECT permission_key FROM role_permission WHERE role_id = ?", roleID(t, env, "user"))
	if err != nil {
		t.Fatal(err)
	}
	if !slices.Equal(held, []string{"image.submit"}) {
		t.Fatal(held)
	}
}

func TestSeedIsRepeatableAndKeepsExtraGrants(t *testing.T) {
	env := testkit.New(t)
	exec(t, env, "INSERT INTO role_permission (role_id, permission_key) VALUES (?, 'text.edit')", roleID(t, env, "user"))
	exec(t, env, "INSERT INTO permission (\"key\", area) VALUES ('old.right', 'data')")
	exec(t, env, "UPDATE permission SET area = 'data' WHERE \"key\" = 'species.edit'")
	if err := access.Seed(context.Background(), env.DB, db.Now()); err != nil {
		t.Fatal(err)
	}
	if n := scalar[int](t, env, "SELECT count(*) FROM role_permission WHERE role_id = ?", roleID(t, env, "user")); n != 2 {
		t.Fatal(n)
	}
	if n := scalar[int](t, env, "SELECT count(*) FROM permission"); n != len(access.Permissions) {
		t.Fatal(n)
	}
	if area := scalar[string](t, env, "SELECT area FROM permission WHERE \"key\" = 'species.edit'"); area != "species" {
		t.Fatal(area)
	}
}

func TestListPermissionsIsForbiddenWithoutTheRight(t *testing.T) {
	env := testkit.New(t)
	u := makeUser(t, env, "person-1")
	env.Get("/permissions", signIn(t, env, u)).Expect(t, http.StatusForbidden)
}

func TestCreateRoleThenReadItBack(t *testing.T) {
	env := testkit.New(t)
	u := makeUser(t, env, "person-1")
	as := signIn(t, env, u, "role.manage")
	body := env.Post("/roles", map[string]any{"slug": "scout", "name": "Scout", "permissions": []string{"find.review"}}, as).
		Expect(t, http.StatusCreated).Map(t)
	if body["slug"] != "scout" || body["peopleCount"] != 0.0 || body["builtIn"] != false || body["description"] != nil {
		t.Fatal(body)
	}
	back := env.Get("/roles/"+body["id"].(string), as).Expect(t, http.StatusOK).Map(t)
	if perms := back["permissions"].([]any); len(perms) != 1 || perms[0] != "find.review" {
		t.Fatal(back)
	}
}

func TestCreateRoleRejectsATakenSlug(t *testing.T) {
	env := testkit.New(t)
	u := makeUser(t, env, "person-1")
	as := signIn(t, env, u, "role.manage")
	newRole(t, env, "scout")
	answer := env.Post("/roles", map[string]any{"slug": "scout", "name": "Scout"}, as).Expect(t, http.StatusConflict)
	if code(t, answer) != "slug_taken" {
		t.Fatal(string(answer.Body))
	}
}

func TestCreateRoleRejectsAnUnknownPermission(t *testing.T) {
	env := testkit.New(t)
	u := makeUser(t, env, "person-1")
	env.Post("/roles", map[string]any{"slug": "scout", "name": "Scout", "permissions": []string{"no.such"}},
		signIn(t, env, u, "role.manage")).Expect(t, http.StatusUnprocessableEntity)
}

func TestGetRoleIsNotFoundForAnUnknownID(t *testing.T) {
	env := testkit.New(t)
	u := makeUser(t, env, "person-1")
	env.Get("/roles/"+db.NewID().String(), signIn(t, env, u, "role.manage")).Expect(t, http.StatusNotFound)
}

func TestListRolesReportsPeopleCount(t *testing.T) {
	env := testkit.New(t)
	u := makeUser(t, env, "person-1")
	role := newRole(t, env, "scout")
	grantRole(t, env, u, "scout")
	body := env.Get("/roles", signIn(t, env, u, "role.manage")).Expect(t, http.StatusOK).Map(t)
	for _, item := range body["items"].([]any) {
		row := item.(map[string]any)
		if row["id"] == role.String() {
			if row["peopleCount"] != 1.0 {
				t.Fatal(row)
			}
			return
		}
	}
	t.Fatal("role missing", body)
}

func TestUpdateRoleChangesNameAndPermissions(t *testing.T) {
	env := testkit.New(t)
	u := makeUser(t, env, "person-1")
	role := newRole(t, env, "scout", "find.review")
	body := env.Patch("/roles/"+role.String(), map[string]any{
		"name": "Späher", "description": "Beobachtet Funde", "permissions": []string{"image.review"},
	}, signIn(t, env, u, "role.manage")).Expect(t, http.StatusOK).Map(t)
	if body["name"] != "Späher" || body["description"] != "Beobachtet Funde" {
		t.Fatal(body)
	}
	if perms := body["permissions"].([]any); len(perms) != 1 || perms[0] != "image.review" {
		t.Fatal(body)
	}
}

func TestUpdateRoleRejectsAnUnknownPermission(t *testing.T) {
	env := testkit.New(t)
	u := makeUser(t, env, "person-1")
	role := newRole(t, env, "scout")
	env.Patch("/roles/"+role.String(), map[string]any{"permissions": []string{"no.such"}},
		signIn(t, env, u, "role.manage")).Expect(t, http.StatusUnprocessableEntity)
}

func TestDeleteRoleRefusesABuiltInRole(t *testing.T) {
	env := testkit.New(t)
	u := makeUser(t, env, "person-1")
	answer := env.Delete("/roles/"+roleID(t, env, "admin").String(), signIn(t, env, u, "role.manage")).
		Expect(t, http.StatusConflict)
	if code(t, answer) != "in_use" {
		t.Fatal(string(answer.Body))
	}
}

func TestDeleteRoleRefusesARoleWithPeople(t *testing.T) {
	env := testkit.New(t)
	u := makeUser(t, env, "person-1")
	role := newRole(t, env, "scout")
	grantRole(t, env, u, "scout")
	answer := env.Delete("/roles/"+role.String(), signIn(t, env, u, "role.manage")).Expect(t, http.StatusConflict)
	if code(t, answer) != "in_use" {
		t.Fatal(string(answer.Body))
	}
}

func TestDeleteRoleRemovesAnUnusedRole(t *testing.T) {
	env := testkit.New(t)
	u := makeUser(t, env, "person-1")
	role := newRole(t, env, "scout")
	env.Delete("/roles/"+role.String(), signIn(t, env, u, "role.manage")).Expect(t, http.StatusNoContent)
	if n := scalar[int](t, env, "SELECT count(*) FROM role WHERE id = ?", role); n != 0 {
		t.Fatal(n)
	}
}

func TestListPeopleSearchesByQ(t *testing.T) {
	env := testkit.New(t)
	u := makeUser(t, env, "person-1")
	makeUser(t, env, "birke")
	makeUser(t, env, "fliege")
	body := env.Get("/people?q=BIRKE", signIn(t, env, u, "role.assign")).Expect(t, http.StatusOK).Map(t)
	if got := sortedField(body["items"], "sub"); !slices.Equal(got, []string{"birke"}) {
		t.Fatal(got)
	}
}

func TestListPeopleWithoutAQueryListsEveryone(t *testing.T) {
	env := testkit.New(t)
	u := makeUser(t, env, "person-1")
	makeUser(t, env, "birke")
	body := env.Get("/people", signIn(t, env, u, "role.assign")).Expect(t, http.StatusOK).Map(t)
	if got := sortedField(body["items"], "sub"); !slices.Equal(got, []string{"birke", "person-1"}) {
		t.Fatal(got)
	}
}

func TestGetPersonIsNotFoundForAnUnknownID(t *testing.T) {
	env := testkit.New(t)
	u := makeUser(t, env, "person-1")
	env.Get("/people/"+db.NewID().String(), signIn(t, env, u, "role.assign")).Expect(t, http.StatusNotFound)
}

func TestGetPersonReturnsThePersonWithRoles(t *testing.T) {
	env := testkit.New(t)
	u := makeUser(t, env, "person-1")
	target := makeUser(t, env, "scout-person")
	grantRole(t, env, target, "reviewer")
	body := env.Get("/people/"+target.ID.String(), signIn(t, env, u, "role.assign")).Expect(t, http.StatusOK).Map(t)
	if body["sub"] != "scout-person" || !slices.Equal(field(body["roles"], "slug"), []string{"reviewer"}) {
		t.Fatal(body)
	}
}

func names(env *testkit.Env, ids string, as *testkit.Person) testkit.Response {
	return env.Get("/people/names?ids="+url.QueryEscape(ids), as)
}

func TestPersonNamesResolveForASharedGroup(t *testing.T) {
	env := testkit.New(t)
	anna := makeUser(t, env, "anna")
	bert := makeUser(t, env, "bert")
	group := env.Post("/groups", map[string]any{"name": "Familie"}, signIn(t, env, anna)).Expect(t, http.StatusCreated).Map(t)
	env.Post("/groups/join", map[string]any{"inviteCode": group["inviteCode"]}, signIn(t, env, bert)).Expect(t, http.StatusOK)
	answer := names(env, anna.ID.String(), signIn(t, env, bert)).Expect(t, http.StatusOK)
	if string(answer.Body) != `[{"id":"`+anna.ID.String()+`","name":"anna"}]` {
		t.Fatalf("%s", answer.Body)
	}
}

func TestPersonNamesOmitAPersonWithoutASharedGroup(t *testing.T) {
	env := testkit.New(t)
	anna := makeUser(t, env, "anna")
	bert := makeUser(t, env, "bert")
	answer := names(env, bert.ID.String(), signIn(t, env, anna)).Expect(t, http.StatusOK)
	if string(answer.Body) != `[]` {
		t.Fatalf("%s", answer.Body)
	}
}

func TestPersonNamesResolveForTheOwnID(t *testing.T) {
	env := testkit.New(t)
	anna := makeUser(t, env, "anna")
	answer := names(env, anna.ID.String()+","+anna.ID.String(), signIn(t, env, anna)).Expect(t, http.StatusOK)
	one := `{"id":"` + anna.ID.String() + `","name":"anna"}`
	if string(answer.Body) != "["+one+","+one+"]" {
		t.Fatalf("%s", answer.Body)
	}
}

func TestPersonNamesNeedsASignedInAccount(t *testing.T) {
	env := testkit.New(t)
	anna := makeUser(t, env, "anna")
	names(env, anna.ID.String(), nil).Expect(t, http.StatusUnauthorized)
}

func TestPersonNamesRejectsMoreThanFiftyIDs(t *testing.T) {
	env := testkit.New(t)
	anna := makeUser(t, env, "anna")
	many := []string{}
	for range 51 {
		many = append(many, db.NewID().String())
	}
	answer := names(env, strings.Join(many, ","), signIn(t, env, anna)).Expect(t, http.StatusUnprocessableEntity)
	errs := answer.Map(t)["errors"].([]any)[0].(map[string]any)
	if errs["field"] != "ids" || errs["code"] != "ids" {
		t.Fatal(errs)
	}
}

func TestPersonNamesRejectsABrokenID(t *testing.T) {
	env := testkit.New(t)
	anna := makeUser(t, env, "anna")
	names(env, "not-a-uuid", signIn(t, env, anna)).Expect(t, http.StatusUnprocessableEntity)
}

func TestDeletePersonRemovesANonAdminAccount(t *testing.T) {
	env := testkit.New(t)
	admin := makeUser(t, env, "admin-person")
	grantRole(t, env, admin, "admin")
	target := makeUser(t, env, "scout-person")
	env.Delete("/people/"+target.ID.String(), signIn(t, env, admin, "role.assign")).Expect(t, http.StatusNoContent)
	if n := scalar[int](t, env, "SELECT count(*) FROM user WHERE id = ?", target.ID); n != 0 {
		t.Fatal(n)
	}
}

func TestDeletePersonRefusesToDropTheLastAdmin(t *testing.T) {
	env := testkit.New(t)
	admin := makeUser(t, env, "admin-person")
	grantRole(t, env, admin, "admin")
	answer := env.Delete("/people/"+admin.ID.String(), signIn(t, env, admin, "role.assign")).Expect(t, http.StatusConflict)
	if code(t, answer) != "last_admin" {
		t.Fatal(string(answer.Body))
	}
}

func TestSetPersonRolesRefusesAnUnknownRole(t *testing.T) {
	env := testkit.New(t)
	admin := makeUser(t, env, "admin-person")
	grantRole(t, env, admin, "admin")
	target := makeUser(t, env, "scout-person")
	env.Put("/people/"+target.ID.String()+"/roles", map[string]any{"roleIds": []string{db.NewID().String()}},
		signIn(t, env, admin, "role.assign")).Expect(t, http.StatusNotFound)
}

func TestSetPersonRolesRefusesToDropTheLastAdmin(t *testing.T) {
	env := testkit.New(t)
	admin := makeUser(t, env, "admin-person")
	grantRole(t, env, admin, "admin")
	answer := env.Put("/people/"+admin.ID.String()+"/roles", map[string]any{"roleIds": []string{}},
		signIn(t, env, admin, "role.assign")).Expect(t, http.StatusConflict)
	if code(t, answer) != "last_admin" {
		t.Fatal(string(answer.Body))
	}
}

func TestSetPersonRolesReplacesThem(t *testing.T) {
	env := testkit.New(t)
	admin := makeUser(t, env, "admin-person")
	grantRole(t, env, admin, "admin")
	scout := newRole(t, env, "scout")
	target := makeUser(t, env, "scout-person")
	grantRole(t, env, target, "reviewer")
	body := env.Put("/people/"+target.ID.String()+"/roles", map[string]any{"roleIds": []string{scout.String(), scout.String()}},
		signIn(t, env, admin, "role.assign")).Expect(t, http.StatusOK).Map(t)
	if got := field(body["roles"], "slug"); !slices.Equal(got, []string{"scout"}) {
		t.Fatal(got)
	}
}

func isConflict(err error, code string) bool {
	var p *problem.Problem
	return errors.As(err, &p) && p.Code == code
}

func TestGuardLastAdminAllowsASecondAdminToLoseTheRole(t *testing.T) {
	env := testkit.New(t)
	first := makeUser(t, env, "first-admin")
	second := makeUser(t, env, "second-admin")
	grantRole(t, env, first, "admin")
	grantRole(t, env, second, "admin")
	if err := access.GuardLastAdmin(context.Background(), env.DB, second.ID, []db.ID{}); err != nil {
		t.Fatal(err)
	}
}

func TestGuardLastAdminBlocksTheOnlyAdmin(t *testing.T) {
	env := testkit.New(t)
	only := makeUser(t, env, "only-admin")
	grantRole(t, env, only, "admin")
	err := access.GuardLastAdmin(context.Background(), env.DB, only.ID, []db.ID{})
	if !isConflict(err, "last_admin") {
		t.Fatal(err)
	}
}

func TestGuardLastAdminIsANoOpWithoutAnAdminRole(t *testing.T) {
	env := testkit.New(t)
	exec(t, env, "DELETE FROM role WHERE slug = 'admin'")
	someone := makeUser(t, env, "someone")
	if err := access.GuardLastAdmin(context.Background(), env.DB, someone.ID, []db.ID{}); err != nil {
		t.Fatal(err)
	}
}

func TestSummaryCountsOnlyWhatTheViewerMaySee(t *testing.T) {
	env := testkit.New(t)
	u := makeUser(t, env, "person-summary")
	insertPhoto(t, env, u.ID, "private")
	insertPhoto(t, env, u.ID, "submitted")
	answer := env.Get("/admin/summary", signIn(t, env, u, "image.review")).Expect(t, http.StatusOK)
	if string(answer.Body) != `{"photos":2,"photosPending":1}` {
		t.Fatalf("%s", answer.Body)
	}
}

func TestSummaryCountsRolesAndPeople(t *testing.T) {
	env := testkit.New(t)
	u := makeUser(t, env, "person-counts")
	body := env.Get("/admin/summary", signIn(t, env, u, "role.manage", "role.assign")).Expect(t, http.StatusOK).Map(t)
	if body["people"] != 1.0 {
		t.Fatal(body)
	}
	if body["roles"] != float64(scalar[int](t, env, "SELECT count(*) FROM role")) {
		t.Fatal(body)
	}
	if body["permissions"] != float64(len(access.Permissions)) {
		t.Fatal(body)
	}
}

func TestSummaryCountsFindsAndRuns(t *testing.T) {
	env := testkit.New(t)
	u := makeUser(t, env, "person-runs")
	insertFind(t, env, u.ID, "open", false)
	insertFind(t, env, u.ID, "accepted", false)
	now := db.Now()
	for _, run := range [][2]string{{"training", "running"}, {"render", "finished"}} {
		exec(t, env, `INSERT INTO pipeline_run (id, kind, state, queued_at, progress_done, progress_total)
			VALUES (?, ?, ?, ?, 0, 0)`, db.NewID(), run[0], run[1], now)
	}
	body := env.Get("/admin/summary", signIn(t, env, u, "find.review", "run.manage")).Expect(t, http.StatusOK).Map(t)
	if body["finds"] != 2.0 || body["findsPending"] != 1.0 || body["runs"] != 2.0 || body["runsRunning"] != 1.0 {
		t.Fatal(body)
	}
}

func TestSummaryCountsGroupsAndTheGlossary(t *testing.T) {
	env := testkit.New(t)
	anna := makeUser(t, env, "anna")
	bert := makeUser(t, env, "bert")
	first := env.Post("/groups", map[string]any{"name": "Familie"}, signIn(t, env, anna)).Expect(t, http.StatusCreated).Map(t)
	env.Post("/groups", map[string]any{"name": "Karlsruhe"}, signIn(t, env, anna)).Expect(t, http.StatusCreated)
	env.Post("/groups/join", map[string]any{"inviteCode": first["inviteCode"]}, signIn(t, env, bert)).Expect(t, http.StatusOK)
	exec(t, env, "INSERT INTO glossary_entry (id, term, definition, updated_at) VALUES (?, 'Hymenium', 'Die Fruchtschicht.', ?)",
		db.NewID(), db.Now())
	body := env.Get("/admin/summary", signIn(t, env, anna, "group.manage", "text.edit")).Expect(t, http.StatusOK).Map(t)
	if body["groups"] != 2.0 || body["groupMembers"] != 3.0 || body["glossary"] != 1.0 {
		t.Fatal(body)
	}
}

func TestSummaryHidesTheGroupCountsWithoutTheRight(t *testing.T) {
	env := testkit.New(t)
	u := makeUser(t, env, "anna")
	body := env.Get("/admin/summary", signIn(t, env, u, "role.assign")).Expect(t, http.StatusOK).Map(t)
	for _, key := range []string{"groups", "groupMembers", "glossary"} {
		if _, ok := body[key]; ok {
			t.Fatal(body)
		}
	}
}

func TestSummaryNeedsAtLeastOneRight(t *testing.T) {
	env := testkit.New(t)
	exec(t, env, "DELETE FROM role_permission WHERE role_id = ?", roleID(t, env, "user"))
	u := makeUser(t, env, "person-plain")
	env.Get("/admin/summary", signIn(t, env, u)).Expect(t, http.StatusForbidden)
	env.Get("/admin/summary", nil).Expect(t, http.StatusUnauthorized)
}

func TestSpeciesCountsNeedTheRightToEditSpecies(t *testing.T) {
	env := testkit.New(t)
	exec(t, env, "DELETE FROM species")
	u := makeUser(t, env, "person-arten")
	env.Get("/admin/species-counts", signIn(t, env, u)).Expect(t, http.StatusForbidden)
	answer := env.Get("/admin/species-counts", signIn(t, env, u, "species.edit")).Expect(t, http.StatusOK)
	if string(answer.Body) != `{"items":[]}` {
		t.Fatalf("%s", answer.Body)
	}
}
