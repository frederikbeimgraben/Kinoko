package access

import (
	"database/sql"
	"net/http"

	"github.com/frederikbeimgraben/kinoko/backend/internal/core/auth"
	"github.com/frederikbeimgraben/kinoko/backend/internal/core/db"
	"github.com/frederikbeimgraben/kinoko/backend/internal/core/problem"
	"github.com/frederikbeimgraben/kinoko/backend/internal/core/web"
	"github.com/frederikbeimgraben/kinoko/backend/internal/fn"
	"github.com/frederikbeimgraben/kinoko/backend/internal/modules/photos"
)

// Me is the signed-in account.
type Me struct {
	ID    db.ID   `json:"id"`
	Sub   string  `json:"sub"`
	Email *string `json:"email"`
	Name  *string `json:"name"`
}

func meOf(user auth.User) Me {
	return Me{ID: user.ID, Sub: user.Sub, Email: user.Email, Name: user.Name}
}

func (m *Module) getMe(r *http.Request) (web.Response, error) {
	user, _, err := m.deps.Auth.CurrentUser(r)
	if err != nil {
		return nil, err
	}
	return web.OK(meOf(user)), nil
}

type myPermissions struct {
	Permissions []string `json:"permissions"`
}

func (m *Module) getMyPermissions(r *http.Request) (web.Response, error) {
	viewer, err := auth.From(r)
	if err != nil {
		return nil, err
	}
	if err := auth.RequireSignIn(viewer); err != nil {
		return nil, err
	}
	return web.OK(myPermissions{Permissions: fn.SortedKeys(viewer.Rights)}), nil
}

func (m *Module) exportMyData(r *http.Request) (web.Response, error) {
	user, _, err := m.deps.Auth.CurrentUser(r)
	if err != nil {
		return nil, err
	}
	export, err := buildExport(r.Context(), m.deps.DB, user)
	if err != nil {
		return nil, err
	}
	return web.OK(export), nil
}

// ownedTables are the tables whose rows DELETE /me/data removes, in order.
var ownedTables = []string{"photo", "find", "marker", "zone", "combination"}

func (m *Module) deleteMyData(r *http.Request) (web.Response, error) {
	ctx := r.Context()
	user, _, err := m.deps.Auth.CurrentUser(r)
	if err != nil {
		return nil, err
	}
	owned, err := db.InTxValue(ctx, m.deps.DB, func(tx *sql.Tx) ([]db.ID, error) {
		ids, err := photos.OwnerPhotoIDs(ctx, tx, user.ID)
		if err != nil {
			return nil, err
		}
		for _, table := range ownedTables {
			if _, err := tx.ExecContext(ctx, "DELETE FROM "+table+" WHERE owner_id = ?", user.ID); err != nil {
				return nil, err
			}
		}
		return ids, nil
	})
	if err != nil {
		return nil, err
	}
	if err := photos.RemoveFiles(m.deps.Settings.Photos, owned); err != nil {
		return nil, problem.Internal()
	}
	return web.Empty(http.StatusNoContent), nil
}
