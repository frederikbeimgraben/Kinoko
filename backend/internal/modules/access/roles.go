package access

import (
	"context"
	"database/sql"
	"encoding/json"
	"net/http"
	"slices"

	"github.com/frederikbeimgraben/kinoko/backend/internal/core/auth"
	"github.com/frederikbeimgraben/kinoko/backend/internal/core/db"
	"github.com/frederikbeimgraben/kinoko/backend/internal/core/paging"
	"github.com/frederikbeimgraben/kinoko/backend/internal/core/problem"
	"github.com/frederikbeimgraben/kinoko/backend/internal/core/web"
	"github.com/frederikbeimgraben/kinoko/backend/internal/fn"
)

type roleRow struct {
	ID          db.ID
	Slug        string
	Name        string
	Description *string
	BuiltIn     bool
	CreatedAt   db.Time
	UpdatedAt   db.Time
}

const roleColumns = "id, slug, name, description, built_in, created_at, updated_at"

func scanRole(s db.Scanner) (roleRow, error) {
	var r roleRow
	return r, s.Scan(&r.ID, &r.Slug, &r.Name, &r.Description, &r.BuiltIn, &r.CreatedAt, &r.UpdatedAt)
}

// roleOut is a role with its permissions and the count of its people.
type roleOut struct {
	ID          db.ID    `json:"id"`
	Slug        string   `json:"slug"`
	Name        string   `json:"name"`
	Description *string  `json:"description"`
	BuiltIn     bool     `json:"builtIn"`
	Permissions []string `json:"permissions"`
	PeopleCount int64    `json:"peopleCount"`
	CreatedAt   db.Time  `json:"createdAt"`
	UpdatedAt   db.Time  `json:"updatedAt"`
}

func renderRole(role roleRow, permissions []string, people int64) roleOut {
	return roleOut{
		ID:          role.ID,
		Slug:        role.Slug,
		Name:        role.Name,
		Description: role.Description,
		BuiltIn:     role.BuiltIn,
		Permissions: permissions,
		PeopleCount: people,
		CreatedAt:   role.CreatedAt,
		UpdatedAt:   role.UpdatedAt,
	}
}

func roleByID(ctx context.Context, q db.Querier, id db.ID) (roleRow, error) {
	return db.One(ctx, q, scanRole, "SELECT "+roleColumns+" FROM role WHERE id = ?", id)
}

func roleBySlug(ctx context.Context, q db.Querier, slug string) (roleRow, bool, error) {
	return db.Maybe(ctx, q, scanRole, "SELECT "+roleColumns+" FROM role WHERE slug = ?", slug)
}

// roleCount counts the people of the role r. A person in the admin group of
// the SSO holds the admin role, and each person holds the base role, without a stored row.
const roleCount = `SELECT count(*) FROM user u
	WHERE u.id IN (SELECT user_id FROM user_role WHERE role_id = r.id)
		OR (r.slug = '` + AdminSlug + `' AND u.group_admin)
		OR r.slug = '` + auth.BaseRole + `'`

func peopleCount(ctx context.Context, q db.Querier, role db.ID) (int64, error) {
	return db.Scalar[int64](ctx, q, "SELECT ("+roleCount+") FROM role r WHERE r.id = ?", role)
}

func permissionsOf(ctx context.Context, q db.Querier, role db.ID) ([]string, error) {
	return db.Column[string](ctx, q, "SELECT permission_key FROM role_permission WHERE role_id = ?", role)
}

func loadRoleOut(ctx context.Context, q db.Querier, role roleRow) (roleOut, error) {
	keys, err := permissionsOf(ctx, q, role.ID)
	if err != nil {
		return roleOut{}, err
	}
	count, err := peopleCount(ctx, q, role.ID)
	return renderRole(role, sorted(keys), count), err
}

// sorted gives a sorted copy that is never nil.
func sorted(keys []string) []string { return slices.Sorted(slices.Values(append([]string{}, keys...))) }

type keyed[V any] struct {
	id    db.ID
	value V
}

func scanKeyed[V any](s db.Scanner) (keyed[V], error) {
	var k keyed[V]
	return k, s.Scan(&k.id, &k.value)
}

func (m *Module) listRoles(r *http.Request) (web.Response, error) {
	ctx := r.Context()
	page, err := paging.FromRequest(r, paging.MaxLimit)
	if err != nil {
		return nil, err
	}
	limit, offset := page.SQL()
	roles, err := db.All(ctx, m.deps.DB, scanRole,
		"SELECT "+roleColumns+" FROM role ORDER BY slug LIMIT ? OFFSET ?", limit, offset)
	if err != nil {
		return nil, err
	}
	ids := db.Args(fn.Map(roles, func(r roleRow) db.ID { return r.ID }))
	grants, counts := []keyed[string]{}, []keyed[int64]{}
	if len(ids) > 0 {
		in := db.Placeholders(len(ids))
		if grants, err = db.All(ctx, m.deps.DB, scanKeyed[string],
			"SELECT role_id, permission_key FROM role_permission WHERE role_id IN ("+in+")", ids...); err != nil {
			return nil, err
		}
		if counts, err = db.All(ctx, m.deps.DB, scanKeyed[int64],
			"SELECT r.id, ("+roleCount+") FROM role r WHERE r.id IN ("+in+")", ids...); err != nil {
			return nil, err
		}
	}
	byRole := fn.GroupBy(grants, func(k keyed[string]) db.ID { return k.id })
	countOf := fn.KeyBy(counts, func(k keyed[int64]) db.ID { return k.id })
	return web.OK(paging.Wrap(fn.Map(roles, func(role roleRow) roleOut {
		keys := fn.Map(byRole[role.ID], func(k keyed[string]) string { return k.value })
		return renderRole(role, sorted(keys), countOf[role.ID].value)
	}), page)), nil
}

type roleCreate struct {
	Slug        string   `json:"slug"`
	Name        string   `json:"name"`
	Description *string  `json:"description"`
	Permissions []string `json:"permissions"`
}

func validatePermissions(keys []string) error {
	if !fn.All(keys, knownPermission) {
		return problem.InvalidField("permissions", "unknown_permission")
	}
	return nil
}

func setPermissions(ctx context.Context, tx *sql.Tx, role db.ID, keys []string) error {
	if _, err := tx.ExecContext(ctx, "DELETE FROM role_permission WHERE role_id = ?", role); err != nil {
		return err
	}
	for _, key := range slices.Compact(sorted(keys)) {
		if _, err := tx.ExecContext(ctx,
			"INSERT INTO role_permission (role_id, permission_key) VALUES (?, ?)", role, key); err != nil {
			return err
		}
	}
	return nil
}

func (m *Module) createRole(r *http.Request) (web.Response, error) {
	ctx := r.Context()
	body, err := web.Decode[roleCreate](r)
	if err != nil {
		return nil, err
	}
	keys := body.Permissions
	if err := validatePermissions(keys); err != nil {
		return nil, err
	}
	now := m.now()
	made, err := db.InTxValue(ctx, m.deps.DB, func(tx *sql.Tx) (roleRow, error) {
		_, taken, err := roleBySlug(ctx, tx, body.Slug)
		if err != nil {
			return roleRow{}, err
		}
		if taken {
			return roleRow{}, problem.Conflict("slug_taken", "")
		}
		role := roleRow{ID: db.NewID(), Slug: body.Slug, Name: body.Name, Description: body.Description, CreatedAt: now, UpdatedAt: now}
		if _, err := tx.ExecContext(ctx, "INSERT INTO role ("+roleColumns+") VALUES (?, ?, ?, ?, 0, ?, ?)",
			role.ID, role.Slug, role.Name, role.Description, role.CreatedAt, role.UpdatedAt); err != nil {
			return roleRow{}, err
		}
		return role, setPermissions(ctx, tx, role.ID, keys)
	})
	if err != nil {
		return nil, err
	}
	// The response keeps the request order, but shows each key once, as
	// setPermissions stores it.
	return web.Created(renderRole(made, fn.Unique(keys), 0)), nil
}

func (m *Module) getRole(r *http.Request) (web.Response, error) {
	id, err := web.PathID(r, "id")
	if err != nil {
		return nil, err
	}
	role, err := roleByID(r.Context(), m.deps.DB, id)
	if err != nil {
		return nil, err
	}
	out, err := loadRoleOut(r.Context(), m.deps.DB, role)
	if err != nil {
		return nil, err
	}
	return web.OK(out), nil
}

// rolePatch holds only the fields that the body sets.
type rolePatch struct {
	Name        *string
	Description *string
	ClearDesc   bool
	Permissions *[]string
}

func parseRolePatch(raw map[string]json.RawMessage) (rolePatch, error) {
	var patch rolePatch
	if value, ok := raw["name"]; ok {
		if err := json.Unmarshal(value, &patch.Name); err != nil {
			return patch, problem.InvalidField("name", "string_type")
		}
	}
	if value, ok := raw["description"]; ok {
		if err := json.Unmarshal(value, &patch.Description); err != nil {
			return patch, problem.InvalidField("description", "string_type")
		}
		patch.ClearDesc = patch.Description == nil
	}
	if value, ok := raw["permissions"]; ok {
		var keys []string
		if err := json.Unmarshal(value, &keys); err != nil {
			return patch, problem.InvalidField("permissions", "list_type")
		}
		patch.Permissions = &keys
	}
	return patch, nil
}

// applyRolePatch gives the role with the patch applied, and whether a column changed.
func applyRolePatch(role roleRow, patch rolePatch) (roleRow, bool) {
	out := role
	if patch.Name != nil {
		out.Name = *patch.Name
	}
	if patch.Description != nil || patch.ClearDesc {
		out.Description = patch.Description
	}
	changed := out.Name != role.Name || !sameText(out.Description, role.Description)
	return out, changed
}

func sameText(a, b *string) bool {
	if a == nil || b == nil {
		return a == b
	}
	return *a == *b
}

func (m *Module) updateRole(r *http.Request) (web.Response, error) {
	ctx := r.Context()
	id, err := web.PathID(r, "id")
	if err != nil {
		return nil, err
	}
	raw, err := web.Decode[map[string]json.RawMessage](r)
	if err != nil {
		return nil, err
	}
	patch, err := parseRolePatch(raw)
	if err != nil {
		return nil, err
	}
	now := m.now()
	out, err := db.InTxValue(ctx, m.deps.DB, func(tx *sql.Tx) (roleOut, error) {
		role, err := roleByID(ctx, tx, id)
		if err != nil {
			return roleOut{}, err
		}
		if patch.Permissions != nil {
			if err := validatePermissions(*patch.Permissions); err != nil {
				return roleOut{}, err
			}
		}
		next, changed := applyRolePatch(role, patch)
		if changed {
			next.UpdatedAt = now
			if _, err := tx.ExecContext(ctx, "UPDATE role SET name = ?, description = ?, updated_at = ? WHERE id = ?",
				next.Name, next.Description, next.UpdatedAt, next.ID); err != nil {
				return roleOut{}, err
			}
		}
		if patch.Permissions != nil {
			if err := setPermissions(ctx, tx, next.ID, *patch.Permissions); err != nil {
				return roleOut{}, err
			}
		}
		return loadRoleOut(ctx, tx, next)
	})
	if err != nil {
		return nil, err
	}
	return web.OK(out), nil
}

func (m *Module) deleteRole(r *http.Request) (web.Response, error) {
	ctx := r.Context()
	id, err := web.PathID(r, "id")
	if err != nil {
		return nil, err
	}
	err = db.InTx(ctx, m.deps.DB, func(tx *sql.Tx) error {
		role, err := roleByID(ctx, tx, id)
		if err != nil {
			return err
		}
		count, err := peopleCount(ctx, tx, role.ID)
		if err != nil {
			return err
		}
		if role.BuiltIn || count > 0 {
			return problem.Conflict("in_use", "")
		}
		_, err = tx.ExecContext(ctx, "DELETE FROM role WHERE id = ?", role.ID)
		return err
	})
	if err != nil {
		return nil, err
	}
	return web.Empty(http.StatusNoContent), nil
}
