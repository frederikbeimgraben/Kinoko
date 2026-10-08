package access

import (
	"context"
	"crypto/rand"
	"database/sql"
	"encoding/hex"
	"maps"
	"math/big"
	"net/http"
	"slices"
	"strings"

	"github.com/frederikbeimgraben/kinoko/backend/internal/core/auth"
	"github.com/frederikbeimgraben/kinoko/backend/internal/core/db"
	"github.com/frederikbeimgraben/kinoko/backend/internal/core/enums"
	"github.com/frederikbeimgraben/kinoko/backend/internal/core/problem"
	"github.com/frederikbeimgraben/kinoko/backend/internal/core/web"
	"github.com/frederikbeimgraben/kinoko/backend/internal/fn"
	"github.com/frederikbeimgraben/kinoko/backend/internal/shared"
)

const (
	codePrefix   = "PILZ-"
	codeAlphabet = "ACDEFGHJKLMNPQRSTUVWXYZ2345679"
	codeBody     = 4
	codeTries    = 20
	manageGroups = "group.manage"
)

// detachedTables hold rows that a group can see. They become private when
// the group or the membership goes away.
var detachedTables = []string{"find", "marker", "zone"}

// newCode makes an invite code. pick gives a number in [0, n).
func newCode(pick func(n int) int) string {
	body := make([]byte, codeBody)
	for i := range body {
		body[i] = codeAlphabet[pick(len(codeAlphabet))]
	}
	return codePrefix + string(body)
}

func securePick(n int) int {
	value, err := rand.Int(rand.Reader, big.NewInt(int64(n)))
	if err != nil {
		panic(err)
	}
	return int(value.Int64())
}

// fallbackCode is the code when each try hits a taken code.
func fallbackCode(id db.ID) string {
	return codePrefix + strings.ToUpper(hex.EncodeToString(id[:])[:8])
}

type groupRow struct {
	ID         db.ID
	Name       string
	OwnerID    db.ID
	InviteCode string
	CreatedAt  db.Time
}

const groupColumns = `id, name, owner_id, invite_code, created_at`

func scanGroup(s db.Scanner) (groupRow, error) {
	var g groupRow
	return g, s.Scan(&g.ID, &g.Name, &g.OwnerID, &g.InviteCode, &g.CreatedAt)
}

type memberRow struct {
	GroupID  db.ID
	UserID   db.ID
	JoinedAt db.Time
}

type groupMember struct {
	UserID   db.ID   `json:"userId"`
	Name     string  `json:"name"`
	JoinedAt db.Time `json:"joinedAt"`
}

// friendGroup is a group with its members.
type friendGroup struct {
	ID         db.ID         `json:"id"`
	Name       string        `json:"name"`
	OwnerID    db.ID         `json:"ownerId"`
	InviteCode string        `json:"inviteCode"`
	Members    []groupMember `json:"members"`
	CreatedAt  db.Time       `json:"createdAt"`
}

type groupList struct {
	Items []friendGroup `json:"items"`
}

// displayName is the name, else the email, else the sub. Empty texts do not count.
func displayName(user auth.User) string {
	if user.Name != nil && *user.Name != "" {
		return *user.Name
	}
	if user.Email != nil && *user.Email != "" {
		return *user.Email
	}
	return user.Sub
}

func displayNames(ctx context.Context, q db.Querier, ids []db.ID) (map[db.ID]string, error) {
	if len(ids) == 0 {
		return map[db.ID]string{}, nil
	}
	users, err := db.All(ctx, q, auth.ScanUser,
		"SELECT "+userColumns+" FROM user WHERE id IN ("+db.Placeholders(len(ids))+")", db.Args(ids)...)
	if err != nil {
		return nil, err
	}
	return fn.ToMap(users, func(u auth.User) (db.ID, string) { return u.ID, displayName(u) }), nil
}

// sharedWith gives the ids that share a group with the user, plus the user,
// limited to the requested ids.
func sharedWith(ctx context.Context, q db.Querier, user db.ID, requested []db.ID) ([]db.ID, error) {
	held, err := shared.MemberGroupIDs(ctx, q, user)
	if err != nil {
		return nil, err
	}
	ids := unique(requested)
	found := []db.ID{}
	if len(held) > 0 {
		groups := slices.Collect(maps.Keys(held))
		found, err = db.Column[db.ID](ctx, q, `SELECT user_id FROM group_member
			WHERE group_id IN (`+db.Placeholders(len(groups))+`) AND user_id IN (`+db.Placeholders(len(ids))+`)`,
			append(db.Args(groups), db.Args(ids)...)...)
		if err != nil {
			return nil, err
		}
	}
	visible := append(found, user)
	return fn.Filter(ids, func(id db.ID) bool { return slices.Contains(visible, id) }), nil
}

// renderGroups loads the members of the groups and builds the answer.
func renderGroups(ctx context.Context, q db.Querier, groups []groupRow) ([]friendGroup, error) {
	if len(groups) == 0 {
		return []friendGroup{}, nil
	}
	ids := fn.Map(groups, func(g groupRow) db.ID { return g.ID })
	members, err := db.All(ctx, q, func(s db.Scanner) (memberRow, error) {
		var m memberRow
		return m, s.Scan(&m.GroupID, &m.UserID, &m.JoinedAt)
	}, `SELECT group_id, user_id, joined_at FROM group_member
		WHERE group_id IN (`+db.Placeholders(len(ids))+`) ORDER BY joined_at`, db.Args(ids)...)
	if err != nil {
		return nil, err
	}
	names, err := displayNames(ctx, q, unique(fn.Map(members, func(m memberRow) db.ID { return m.UserID })))
	if err != nil {
		return nil, err
	}
	byGroup := fn.GroupBy(members, func(m memberRow) db.ID { return m.GroupID })
	return fn.Map(groups, func(g groupRow) friendGroup {
		return friendGroup{
			ID:         g.ID,
			Name:       g.Name,
			OwnerID:    g.OwnerID,
			InviteCode: g.InviteCode,
			Members: fn.Map(byGroup[g.ID], func(m memberRow) groupMember {
				return groupMember{UserID: m.UserID, Name: names[m.UserID], JoinedAt: m.JoinedAt}
			}),
			CreatedAt: g.CreatedAt,
		}
	}), nil
}

func renderGroup(ctx context.Context, q db.Querier, group groupRow) (friendGroup, error) {
	out, err := renderGroups(ctx, q, []groupRow{group})
	if err != nil {
		return friendGroup{}, err
	}
	return out[0], nil
}

func groupByID(ctx context.Context, q db.Querier, id db.ID) (groupRow, error) {
	return db.One(ctx, q, scanGroup, `SELECT `+groupColumns+` FROM "group" WHERE id = ?`, id)
}

func isMember(ctx context.Context, q db.Querier, group, user db.ID) (bool, error) {
	return db.Scalar[bool](ctx, q,
		"SELECT EXISTS (SELECT 1 FROM group_member WHERE group_id = ? AND user_id = ?)", group, user)
}

// laxBool reads a query flag as pydantic reads a lax bool.
func laxBool(raw string) bool {
	switch strings.ToLower(raw) {
	case "true", "1", "yes", "on", "t", "y":
		return true
	default:
		return false
	}
}

func (m *Module) listGroups(r *http.Request) (web.Response, error) {
	ctx := r.Context()
	user, viewer, err := m.deps.Auth.CurrentUser(r)
	if err != nil {
		return nil, err
	}
	var groups []groupRow
	if laxBool(fn.Deref(web.Query(r, "all"), "")) {
		if !viewer.May(manageGroups) {
			return nil, problem.Forbidden()
		}
		groups, err = db.All(ctx, m.deps.DB, scanGroup, `SELECT `+groupColumns+` FROM "group" ORDER BY name`)
	} else {
		groups, err = db.All(ctx, m.deps.DB, scanGroup, `SELECT `+groupColumns+` FROM "group"
			WHERE id IN (SELECT group_id FROM group_member WHERE user_id = ?) ORDER BY name`, user.ID)
	}
	if err != nil {
		return nil, err
	}
	items, err := renderGroups(ctx, m.deps.DB, groups)
	if err != nil {
		return nil, err
	}
	return web.OK(groupList{Items: items}), nil
}

type groupWrite struct {
	Name string `json:"name"`
}

type groupJoin struct {
	InviteCode string `json:"inviteCode"`
}

func freeCode(ctx context.Context, tx *sql.Tx) (string, error) {
	for range codeTries {
		code := newCode(securePick)
		taken, err := db.Scalar[bool](ctx, tx, `SELECT EXISTS (SELECT 1 FROM "group" WHERE invite_code = ?)`, code)
		if err != nil {
			return "", err
		}
		if !taken {
			return code, nil
		}
	}
	return fallbackCode(db.NewID()), nil
}

func (m *Module) createGroup(r *http.Request) (web.Response, error) {
	ctx := r.Context()
	user, _, err := m.deps.Auth.CurrentUser(r)
	if err != nil {
		return nil, err
	}
	body, err := web.Decode[groupWrite](r)
	if err != nil {
		return nil, err
	}
	now := m.now()
	out, err := db.InTxValue(ctx, m.deps.DB, func(tx *sql.Tx) (friendGroup, error) {
		code, err := freeCode(ctx, tx)
		if err != nil {
			return friendGroup{}, err
		}
		group := groupRow{ID: db.NewID(), Name: body.Name, OwnerID: user.ID, InviteCode: code, CreatedAt: now}
		if _, err := tx.ExecContext(ctx, `INSERT INTO "group" (`+groupColumns+`) VALUES (?, ?, ?, ?, ?)`,
			group.ID, group.Name, group.OwnerID, group.InviteCode, group.CreatedAt); err != nil {
			return friendGroup{}, err
		}
		if _, err := tx.ExecContext(ctx, "INSERT INTO group_member (group_id, user_id, joined_at) VALUES (?, ?, ?)",
			group.ID, user.ID, now); err != nil {
			return friendGroup{}, err
		}
		return renderGroup(ctx, tx, group)
	})
	if err != nil {
		return nil, err
	}
	return web.Created(out), nil
}

func (m *Module) joinGroup(r *http.Request) (web.Response, error) {
	ctx := r.Context()
	user, _, err := m.deps.Auth.CurrentUser(r)
	if err != nil {
		return nil, err
	}
	body, err := web.Decode[groupJoin](r)
	if err != nil {
		return nil, err
	}
	code := strings.ToUpper(strings.TrimSpace(body.InviteCode))
	now := m.now()
	out, err := db.InTxValue(ctx, m.deps.DB, func(tx *sql.Tx) (friendGroup, error) {
		group, err := db.One(ctx, tx, scanGroup, `SELECT `+groupColumns+` FROM "group" WHERE invite_code = ?`, code)
		if err != nil {
			return friendGroup{}, err
		}
		if _, err := tx.ExecContext(ctx, `INSERT INTO group_member (group_id, user_id, joined_at) VALUES (?, ?, ?)
			ON CONFLICT (group_id, user_id) DO NOTHING`, group.ID, user.ID, now); err != nil {
			return friendGroup{}, err
		}
		return renderGroup(ctx, tx, group)
	})
	if err != nil {
		return nil, err
	}
	return web.OK(out), nil
}

func (m *Module) getGroup(r *http.Request) (web.Response, error) {
	ctx := r.Context()
	user, viewer, err := m.deps.Auth.CurrentUser(r)
	if err != nil {
		return nil, err
	}
	id, err := web.PathID(r, "id")
	if err != nil {
		return nil, err
	}
	group, err := groupByID(ctx, m.deps.DB, id)
	if err != nil {
		return nil, err
	}
	if !viewer.May(manageGroups) {
		member, err := isMember(ctx, m.deps.DB, group.ID, user.ID)
		if err != nil {
			return nil, err
		}
		if !member {
			return nil, problem.NotFound()
		}
	}
	out, err := renderGroup(ctx, m.deps.DB, group)
	if err != nil {
		return nil, err
	}
	return web.OK(out), nil
}

// ownedGroup reads a group that the user leads: 404 when unknown, 403 when
// another person leads it and the viewer may not manage groups.
func ownedGroup(ctx context.Context, q db.Querier, user db.ID, viewer auth.Viewer, id db.ID) (groupRow, error) {
	group, err := groupByID(ctx, q, id)
	if err != nil {
		return group, err
	}
	if !viewer.May(manageGroups) && group.OwnerID != user {
		return group, problem.Forbidden()
	}
	return group, nil
}

func (m *Module) updateGroup(r *http.Request) (web.Response, error) {
	ctx := r.Context()
	user, viewer, err := m.deps.Auth.CurrentUser(r)
	if err != nil {
		return nil, err
	}
	id, err := web.PathID(r, "id")
	if err != nil {
		return nil, err
	}
	body, err := web.Decode[groupWrite](r)
	if err != nil {
		return nil, err
	}
	out, err := db.InTxValue(ctx, m.deps.DB, func(tx *sql.Tx) (friendGroup, error) {
		group, err := ownedGroup(ctx, tx, user.ID, viewer, id)
		if err != nil {
			return friendGroup{}, err
		}
		group.Name = body.Name
		if _, err := tx.ExecContext(ctx, `UPDATE "group" SET name = ? WHERE id = ?`, group.Name, group.ID); err != nil {
			return friendGroup{}, err
		}
		return renderGroup(ctx, tx, group)
	})
	if err != nil {
		return nil, err
	}
	return web.OK(out), nil
}

// detach makes the rows of the group private again. A non-nil owner limits
// it to the rows of that person.
func detach(ctx context.Context, tx *sql.Tx, group db.ID, owner *db.ID, now db.Time) error {
	for _, table := range detachedTables {
		query := "UPDATE " + table + " SET group_id = NULL, visibility = ?, updated_at = ? WHERE group_id = ?"
		args := []any{string(enums.VisibilityPrivate), now, group}
		if owner != nil {
			query += " AND owner_id = ?"
			args = append(args, *owner)
		}
		if _, err := tx.ExecContext(ctx, query, args...); err != nil {
			return err
		}
	}
	return nil
}

func (m *Module) deleteGroup(r *http.Request) (web.Response, error) {
	ctx := r.Context()
	user, viewer, err := m.deps.Auth.CurrentUser(r)
	if err != nil {
		return nil, err
	}
	id, err := web.PathID(r, "id")
	if err != nil {
		return nil, err
	}
	now := m.now()
	err = db.InTx(ctx, m.deps.DB, func(tx *sql.Tx) error {
		group, err := ownedGroup(ctx, tx, user.ID, viewer, id)
		if err != nil {
			return err
		}
		if err := detach(ctx, tx, group.ID, nil, now); err != nil {
			return err
		}
		_, err = tx.ExecContext(ctx, `DELETE FROM "group" WHERE id = ?`, group.ID)
		return err
	})
	if err != nil {
		return nil, err
	}
	return web.Empty(http.StatusNoContent), nil
}

func (m *Module) removeGroupMember(r *http.Request) (web.Response, error) {
	ctx := r.Context()
	user, viewer, err := m.deps.Auth.CurrentUser(r)
	if err != nil {
		return nil, err
	}
	id, err := web.PathID(r, "id")
	if err != nil {
		return nil, err
	}
	member, err := web.PathID(r, "userId")
	if err != nil {
		return nil, err
	}
	now := m.now()
	err = db.InTx(ctx, m.deps.DB, func(tx *sql.Tx) error {
		group, err := groupByID(ctx, tx, id)
		if err != nil {
			return err
		}
		if member == group.OwnerID {
			return problem.Forbidden()
		}
		if !viewer.May(manageGroups) && user.ID != group.OwnerID && user.ID != member {
			return problem.Forbidden()
		}
		removed, err := db.Exec(ctx, tx, "DELETE FROM group_member WHERE group_id = ? AND user_id = ?", group.ID, member)
		if err != nil {
			return err
		}
		if removed == 0 {
			return problem.NotFound()
		}
		return detach(ctx, tx, group.ID, &member, now)
	})
	if err != nil {
		return nil, err
	}
	return web.Empty(http.StatusNoContent), nil
}
