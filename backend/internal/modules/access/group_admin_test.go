package access_test

import (
	"net/http"
	"testing"

	"github.com/frederikbeimgraben/kinoko/backend/internal/testkit"
)

func adminCount(t *testing.T, env *testkit.Env, as *testkit.Person) any {
	t.Helper()
	return countOf(t, env, as, "admin")
}

func countOf(t *testing.T, env *testkit.Env, as *testkit.Person, slug string) any {
	t.Helper()
	body := env.Get("/roles", as).Expect(t, http.StatusOK).Map(t)
	for _, item := range body["items"].([]any) {
		row := item.(map[string]any)
		if row["slug"] == slug {
			return row["peopleCount"]
		}
	}
	t.Fatal("role missing", slug, body)
	return nil
}

func TestTheSSOAdminGroupCountsForTheAdminRole(t *testing.T) {
	env := testkit.New(t)
	admin := testkit.Admin()
	env.Get("/me/permissions", &admin).Expect(t, http.StatusOK)

	if count := adminCount(t, env, &admin); count != 1.0 {
		t.Fatal(count)
	}
	body := env.Get("/people", &admin).Expect(t, http.StatusOK).Map(t)
	person := body["items"].([]any)[0].(map[string]any)
	if person["sub"] != "admin-sub" || person["groupAdmin"] != true || len(person["roles"].([]any)) != 0 {
		t.Fatal(person)
	}
}

func TestLeavingTheSSOAdminGroupClearsTheFlag(t *testing.T) {
	env := testkit.New(t)
	admin := testkit.Admin()
	env.Get("/me/permissions", &admin).Expect(t, http.StatusOK)
	admin.Groups = []string{}
	env.Get("/me/permissions", &admin).Expect(t, http.StatusOK)

	if flag := scalar[bool](t, env, "SELECT group_admin FROM user WHERE sub = ?", "admin-sub"); flag {
		t.Fatal("flag stays set")
	}
	other := testkit.Admin()
	other.Sub = "other-admin"
	if count := adminCount(t, env, &other); count != 0.0 {
		t.Fatal(count)
	}
}

func TestEachPersonCountsForTheBaseRole(t *testing.T) {
	env := testkit.New(t)
	admin := testkit.Admin()
	env.Get("/me/permissions", &admin).Expect(t, http.StatusOK)
	makeUser(t, env, "person-1")

	if count := countOf(t, env, &admin, "user"); count != 2.0 {
		t.Fatal(count)
	}
}
