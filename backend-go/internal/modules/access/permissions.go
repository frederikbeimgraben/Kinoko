package access

import (
	"context"
	"database/sql"
	"net/http"
	"slices"

	"github.com/frederikbeimgraben/kinoko/backend/internal/core/auth"
	"github.com/frederikbeimgraben/kinoko/backend/internal/core/db"
	"github.com/frederikbeimgraben/kinoko/backend/internal/core/enums"
	"github.com/frederikbeimgraben/kinoko/backend/internal/core/web"
	"github.com/frederikbeimgraben/kinoko/backend/internal/fn"
)

// PermissionEntry is a permission with its area.
type PermissionEntry struct {
	Key  string     `json:"key"`
	Area enums.Area `json:"area"`
}

// Permissions lists each known permission in the order of the overview.
var Permissions = []PermissionEntry{
	{"species.edit", enums.AreaSpecies},
	{"image.submit", enums.AreaSpecies},
	{"image.review", enums.AreaSpecies},
	{"text.edit", enums.AreaInterface},
	{"role.manage", enums.AreaAccess},
	{"role.assign", enums.AreaAccess},
	{"find.review", enums.AreaData},
	{"run.manage", enums.AreaData},
	{"group.manage", enums.AreaAccess},
}

// AdminSlug is the slug of the role that the last-admin guard protects.
const AdminSlug = "admin"

// BuiltInRole is a role that the seed keeps. Name is a text key.
type BuiltInRole struct {
	Slug        string
	Name        string
	Permissions []string
}

func permissionKeys() []string {
	return fn.Map(Permissions, func(p PermissionEntry) string { return p.Key })
}

// BuiltInRoles lists the roles that the seed creates.
var BuiltInRoles = []BuiltInRole{
	{AdminSlug, "account.role.admin", permissionKeys()},
	{auth.BaseRole, "account.role.user", []string{"image.submit"}},
	{"editorial", "account.role.editorial", []string{"species.edit", "text.edit", "image.review", "image.submit"}},
	{"reviewer", "account.role.reviewer", []string{"image.review", "find.review"}},
}

func knownPermission(key string) bool {
	return fn.Any(Permissions, func(p PermissionEntry) bool { return p.Key == key })
}

type permissionPlan struct {
	upsert []PermissionEntry
	drop   []string
}

// planPermissions compares the stored permissions with the known ones.
func planPermissions(stored map[string]string) permissionPlan {
	return permissionPlan{
		upsert: fn.Filter(Permissions, func(p PermissionEntry) bool {
			area, ok := stored[p.Key]
			return !ok || area != string(p.Area)
		}),
		drop: fn.Filter(fn.SortedKeys(stored), func(key string) bool { return !knownPermission(key) }),
	}
}

// missingGrants gives the permissions of the role that the role does not hold.
func missingGrants(role BuiltInRole, held []string) []string {
	return fn.Filter(role.Permissions, func(key string) bool { return !slices.Contains(held, key) })
}

type storedPermission struct {
	key  string
	area string
}

// Seed writes the known permissions and the built-in roles. It removes
// unknown permissions but never removes a permission from a role.
func Seed(ctx context.Context, handle *sql.DB, now db.Time) error {
	return db.InTx(ctx, handle, func(tx *sql.Tx) error {
		if err := seedPermissions(ctx, tx); err != nil {
			return err
		}
		return seedRoles(ctx, tx, now)
	})
}

func seedPermissions(ctx context.Context, tx *sql.Tx) error {
	rows, err := db.All(ctx, tx, func(s db.Scanner) (storedPermission, error) {
		var p storedPermission
		return p, s.Scan(&p.key, &p.area)
	}, `SELECT "key", area FROM permission`)
	if err != nil {
		return err
	}
	stored := fn.Reduce(rows, map[string]string{}, func(acc map[string]string, p storedPermission) map[string]string {
		acc[p.key] = p.area
		return acc
	})
	plan := planPermissions(stored)
	for _, entry := range plan.upsert {
		if _, err := tx.ExecContext(ctx, `INSERT INTO permission ("key", area) VALUES (?, ?)
			ON CONFLICT ("key") DO UPDATE SET area = excluded.area`, entry.Key, string(entry.Area)); err != nil {
			return err
		}
	}
	for _, key := range plan.drop {
		if _, err := tx.ExecContext(ctx, `DELETE FROM permission WHERE "key" = ?`, key); err != nil {
			return err
		}
	}
	return nil
}

func seedRoles(ctx context.Context, tx *sql.Tx, now db.Time) error {
	for _, role := range BuiltInRoles {
		id, found, err := db.Maybe(ctx, tx, func(s db.Scanner) (db.ID, error) {
			var id db.ID
			return id, s.Scan(&id)
		}, "SELECT id FROM role WHERE slug = ?", role.Slug)
		if err != nil {
			return err
		}
		if !found {
			id = db.NewID()
			if _, err := tx.ExecContext(ctx, `INSERT INTO role (id, slug, name, description, built_in, created_at, updated_at)
				VALUES (?, ?, ?, NULL, 1, ?, ?)`, id, role.Slug, role.Name, now, now); err != nil {
				return err
			}
		} else if _, err := tx.ExecContext(ctx,
			"UPDATE role SET built_in = 1, updated_at = ? WHERE id = ? AND built_in = 0", now, id); err != nil {
			return err
		}
		held, err := db.Column[string](ctx, tx, "SELECT permission_key FROM role_permission WHERE role_id = ?", id)
		if err != nil {
			return err
		}
		for _, key := range missingGrants(role, held) {
			if _, err := tx.ExecContext(ctx,
				"INSERT INTO role_permission (role_id, permission_key) VALUES (?, ?)", id, key); err != nil {
				return err
			}
		}
	}
	return nil
}

type permissionList struct {
	Items []PermissionEntry `json:"items"`
}

func (m *Module) listPermissions(*http.Request) (web.Response, error) {
	return web.OK(permissionList{Items: Permissions}), nil
}
