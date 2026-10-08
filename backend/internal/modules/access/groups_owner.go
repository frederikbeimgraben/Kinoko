package access

import (
	"context"
	"database/sql"
	"net/http"

	"github.com/frederikbeimgraben/kinoko/backend/internal/core/auth"
	"github.com/frederikbeimgraben/kinoko/backend/internal/core/db"
	"github.com/frederikbeimgraben/kinoko/backend/internal/core/enums"
	"github.com/frederikbeimgraben/kinoko/backend/internal/core/problem"
	"github.com/frederikbeimgraben/kinoko/backend/internal/core/web"
)

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
