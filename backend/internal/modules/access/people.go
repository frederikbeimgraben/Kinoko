package access

import (
	"context"
	"database/sql"
	"net/http"
	"slices"
	"strings"

	"github.com/frederikbeimgraben/kinoko/backend/internal/core/auth"
	"github.com/frederikbeimgraben/kinoko/backend/internal/core/db"
	"github.com/frederikbeimgraben/kinoko/backend/internal/core/paging"
	"github.com/frederikbeimgraben/kinoko/backend/internal/core/problem"
	"github.com/frederikbeimgraben/kinoko/backend/internal/core/web"
	"github.com/frederikbeimgraben/kinoko/backend/internal/fn"
)

// maxNameIDs is the largest count of ids that /people/names accepts.
const maxNameIDs = 50

const userColumns = "id, sub, email, name, created_at"

type roleBrief struct {
	ID   db.ID  `json:"id"`
	Slug string `json:"slug"`
	Name string `json:"name"`
}

// personOut is an account with its roles.
type personOut struct {
	ID        db.ID       `json:"id"`
	Sub       string      `json:"sub"`
	Email     *string     `json:"email"`
	Name      *string     `json:"name"`
	Roles     []roleBrief `json:"roles"`
	CreatedAt db.Time     `json:"createdAt"`
}

type heldRole struct {
	user db.ID
	role roleBrief
}

func rolesFor(ctx context.Context, q db.Querier, users []db.ID) (map[db.ID][]roleBrief, error) {
	if len(users) == 0 {
		return map[db.ID][]roleBrief{}, nil
	}
	rows, err := db.All(ctx, q, func(s db.Scanner) (heldRole, error) {
		var h heldRole
		return h, s.Scan(&h.user, &h.role.ID, &h.role.Slug, &h.role.Name)
	}, `SELECT user_role.user_id, role.id, role.slug, role.name
		FROM user_role JOIN role ON role.id = user_role.role_id
		WHERE user_role.user_id IN (`+db.Placeholders(len(users))+`)`, db.Args(users)...)
	if err != nil {
		return nil, err
	}
	grouped := fn.GroupBy(rows, func(h heldRole) db.ID { return h.user })
	out := make(map[db.ID][]roleBrief, len(grouped))
	for user, held := range grouped {
		out[user] = fn.Map(held, func(h heldRole) roleBrief { return h.role })
	}
	return out, nil
}

func renderPerson(user auth.User, roles []roleBrief) personOut {
	if roles == nil {
		roles = []roleBrief{}
	}
	return personOut{ID: user.ID, Sub: user.Sub, Email: user.Email, Name: user.Name, Roles: roles, CreatedAt: user.CreatedAt}
}

func personByID(ctx context.Context, q db.Querier, id db.ID) (auth.User, error) {
	return db.One(ctx, q, auth.ScanUser, "SELECT "+userColumns+" FROM user WHERE id = ?", id)
}

func loadPerson(ctx context.Context, q db.Querier, user auth.User) (personOut, error) {
	roles, err := rolesFor(ctx, q, []db.ID{user.ID})
	return renderPerson(user, roles[user.ID]), err
}

func (m *Module) listPeople(r *http.Request) (web.Response, error) {
	ctx := r.Context()
	page, err := paging.FromRequest(r, paging.MaxLimit)
	if err != nil {
		return nil, err
	}
	limit, offset := page.SQL()
	where, args := "", []any{}
	if q := web.Query(r, "q"); q != nil && *q != "" {
		pattern := "%" + *q + "%"
		where = " WHERE lower(sub) LIKE lower(?) OR lower(email) LIKE lower(?) OR lower(name) LIKE lower(?)"
		args = []any{pattern, pattern, pattern}
	}
	people, err := db.All(ctx, m.deps.DB, auth.ScanUser,
		"SELECT "+userColumns+" FROM user"+where+" ORDER BY created_at LIMIT ? OFFSET ?",
		append(args, limit, offset)...)
	if err != nil {
		return nil, err
	}
	roles, err := rolesFor(ctx, m.deps.DB, fn.Map(people, func(u auth.User) db.ID { return u.ID }))
	if err != nil {
		return nil, err
	}
	return web.OK(paging.Wrap(fn.Map(people, func(u auth.User) personOut {
		return renderPerson(u, roles[u.ID])
	}), page)), nil
}

func (m *Module) getPerson(r *http.Request) (web.Response, error) {
	id, err := web.PathID(r, "id")
	if err != nil {
		return nil, err
	}
	user, err := personByID(r.Context(), m.deps.DB, id)
	if err != nil {
		return nil, err
	}
	out, err := loadPerson(r.Context(), m.deps.DB, user)
	if err != nil {
		return nil, err
	}
	return web.OK(out), nil
}

// adminState is what the last-admin guard needs to know.
type adminState struct {
	exists bool
	id     db.ID
	held   bool
	people int64
}

// lastAdminConflict tells if the change removes the last holder of the admin
// role. A nil next set means the account goes away.
func lastAdminConflict(state adminState, next []db.ID) bool {
	if !state.exists || !state.held {
		return false
	}
	if next != nil && slices.Contains(next, state.id) {
		return false
	}
	return state.people <= 1
}

func loadAdminState(ctx context.Context, q db.Querier, user db.ID) (adminState, error) {
	admin, found, err := roleBySlug(ctx, q, AdminSlug)
	if err != nil || !found {
		return adminState{}, err
	}
	held, err := db.Scalar[bool](ctx, q,
		"SELECT EXISTS (SELECT 1 FROM user_role WHERE user_id = ? AND role_id = ?)", user, admin.ID)
	if err != nil {
		return adminState{}, err
	}
	count, err := peopleCount(ctx, q, admin.ID)
	return adminState{exists: true, id: admin.ID, held: held, people: count}, err
}

// GuardLastAdmin gives 409 last_admin when the change removes the last
// holder of the admin role. A nil next set means the account goes away.
func GuardLastAdmin(ctx context.Context, q db.Querier, user db.ID, next []db.ID) error {
	state, err := loadAdminState(ctx, q, user)
	if err != nil {
		return err
	}
	if lastAdminConflict(state, next) {
		return problem.Conflict("last_admin", "")
	}
	return nil
}

func (m *Module) deletePerson(r *http.Request) (web.Response, error) {
	ctx := r.Context()
	id, err := web.PathID(r, "id")
	if err != nil {
		return nil, err
	}
	err = db.InTx(ctx, m.deps.DB, func(tx *sql.Tx) error {
		user, err := personByID(ctx, tx, id)
		if err != nil {
			return err
		}
		if err := GuardLastAdmin(ctx, tx, user.ID, nil); err != nil {
			return err
		}
		_, err = tx.ExecContext(ctx, "DELETE FROM user WHERE id = ?", user.ID)
		return err
	})
	if err != nil {
		return nil, err
	}
	return web.Empty(http.StatusNoContent), nil
}

type setPersonRoles struct {
	RoleIDs []db.ID `json:"roleIds"`
}

// unique keeps the first of each id, in order.
func unique(ids []db.ID) []db.ID {
	return fn.Reduce(ids, []db.ID{}, func(acc []db.ID, id db.ID) []db.ID {
		if slices.Contains(acc, id) {
			return acc
		}
		return append(acc, id)
	})
}

func (m *Module) setPersonRoles(r *http.Request) (web.Response, error) {
	ctx := r.Context()
	id, err := web.PathID(r, "id")
	if err != nil {
		return nil, err
	}
	body, err := web.Decode[setPersonRoles](r)
	if err != nil {
		return nil, err
	}
	now := m.now()
	out, err := db.InTxValue(ctx, m.deps.DB, func(tx *sql.Tx) (personOut, error) {
		user, err := personByID(ctx, tx, id)
		if err != nil {
			return personOut{}, err
		}
		ids := unique(body.RoleIDs)
		if len(ids) > 0 {
			found, err := db.Scalar[int](ctx, tx,
				"SELECT count(*) FROM role WHERE id IN ("+db.Placeholders(len(ids))+")", db.Args(ids)...)
			if err != nil {
				return personOut{}, err
			}
			if found != len(ids) {
				return personOut{}, problem.NotFound()
			}
		}
		if err := GuardLastAdmin(ctx, tx, user.ID, ids); err != nil {
			return personOut{}, err
		}
		if _, err := tx.ExecContext(ctx, "DELETE FROM user_role WHERE user_id = ?", user.ID); err != nil {
			return personOut{}, err
		}
		for _, role := range ids {
			if _, err := tx.ExecContext(ctx,
				"INSERT INTO user_role (user_id, role_id, granted_at) VALUES (?, ?, ?)", user.ID, role, now); err != nil {
				return personOut{}, err
			}
		}
		return loadPerson(ctx, tx, user)
	})
	if err != nil {
		return nil, err
	}
	return web.OK(out), nil
}

// parseNameIDs reads the comma list of /people/names: 1 to 50 UUIDs.
func parseNameIDs(raw string) ([]db.ID, error) {
	parts := fn.Filter(fn.Map(strings.Split(raw, ","), strings.TrimSpace), func(p string) bool { return p != "" })
	if len(parts) == 0 || len(parts) > maxNameIDs {
		return nil, problem.InvalidField("ids", "ids")
	}
	ids, err := fn.MapErr(parts, db.ParseID)
	if err != nil {
		return nil, problem.InvalidField("ids", "ids")
	}
	return ids, nil
}

type personName struct {
	ID   db.ID  `json:"id"`
	Name string `json:"name"`
}

func (m *Module) resolvePersonNames(r *http.Request) (web.Response, error) {
	ctx := r.Context()
	user, viewer, err := m.deps.Auth.CurrentUser(r)
	if err != nil {
		return nil, err
	}
	requested, err := parseNameIDs(fn.Deref(web.Query(r, "ids"), ""))
	if err != nil {
		return nil, err
	}
	visible := unique(requested)
	// A reviewer of finds and an assigner of roles work on the data of all persons.
	if !viewer.May("find.review") && !viewer.May("role.assign") {
		visible, err = sharedWith(ctx, m.deps.DB, user.ID, requested)
		if err != nil {
			return nil, err
		}
	}
	names, err := displayNames(ctx, m.deps.DB, visible)
	if err != nil {
		return nil, err
	}
	return web.OK(fn.FlatMap(requested, func(id db.ID) []personName {
		name, ok := names[id]
		if !ok {
			return nil
		}
		return []personName{{ID: id, Name: name}}
	})), nil
}
