package access_test

import (
	"context"
	"strings"
	"testing"

	"github.com/frederikbeimgraben/kinoko/backend/internal/core/db"
	"github.com/frederikbeimgraben/kinoko/backend/internal/testkit"
)

// user is a person row with its token claims, as make_user builds it.
type user struct {
	ID     db.ID
	Sub    string
	Person testkit.Person
}

func exec(t testing.TB, env *testkit.Env, query string, args ...any) {
	t.Helper()
	if _, err := env.DB.ExecContext(context.Background(), query, args...); err != nil {
		t.Fatalf("%s: %v", query, err)
	}
}

func scalar[T any](t testing.TB, env *testkit.Env, query string, args ...any) T {
	t.Helper()
	value, err := db.Scalar[T](context.Background(), env.DB, query, args...)
	if err != nil {
		t.Fatalf("%s: %v", query, err)
	}
	return value
}

// makeUser writes a person row whose email and name match its token.
func makeUser(t testing.TB, env *testkit.Env, sub string) user {
	t.Helper()
	id := db.NewID()
	email := sub + "@example.test"
	exec(t, env, "INSERT INTO user (id, sub, email, name, created_at) VALUES (?, ?, ?, ?, ?)",
		id, sub, email, sub, db.Now())
	return user{ID: id, Sub: sub, Person: testkit.Person{Sub: sub, Email: email, Name: sub, Groups: []string{}}}
}

func roleID(t testing.TB, env *testkit.Env, slug string) db.ID {
	t.Helper()
	return scalar[db.ID](t, env, "SELECT id FROM role WHERE slug = ?", slug)
}

// newRole writes a role with the permissions.
func newRole(t testing.TB, env *testkit.Env, slug string, permissions ...string) db.ID {
	t.Helper()
	id := db.NewID()
	now := db.Now()
	exec(t, env, "INSERT INTO role (id, slug, name, description, built_in, created_at, updated_at) VALUES (?, ?, ?, NULL, 0, ?, ?)",
		id, slug, slug, now, now)
	for _, key := range permissions {
		exec(t, env, "INSERT INTO role_permission (role_id, permission_key) VALUES (?, ?)", id, key)
	}
	return id
}

func grantRole(t testing.TB, env *testkit.Env, u user, slug string) {
	t.Helper()
	exec(t, env, "INSERT INTO user_role (user_id, role_id, granted_at) VALUES (?, ?, ?)", u.ID, roleID(t, env, slug), db.Now())
}

const rightsPrefix = "test-rights-"

// signIn gives the person exactly the rights on top of its other roles and
// the base role. It replaces the rights of an earlier signIn.
func signIn(t testing.TB, env *testkit.Env, u user, rights ...string) *testkit.Person {
	t.Helper()
	exec(t, env, `DELETE FROM role WHERE slug LIKE ? AND id IN (SELECT role_id FROM user_role WHERE user_id = ?)`,
		rightsPrefix+"%", u.ID)
	if len(rights) > 0 {
		slug := rightsPrefix + strings.ToLower(db.NewID().String())
		newRole(t, env, slug, rights...)
		grantRole(t, env, u, slug)
	}
	return testkit.Ptr(u.Person)
}
