// Package photos is the photos part of the API: uploads at finds and
// species, the review of photos and the image files.
package photos

import (
	"context"
	"database/sql"
	"net/http"
	"os"
	"strings"

	"github.com/frederikbeimgraben/kinoko/backend/internal/core/auth"
	"github.com/frederikbeimgraben/kinoko/backend/internal/core/db"
	"github.com/frederikbeimgraben/kinoko/backend/internal/core/enums"
	"github.com/frederikbeimgraben/kinoko/backend/internal/core/paging"
	"github.com/frederikbeimgraben/kinoko/backend/internal/core/problem"
	"github.com/frederikbeimgraben/kinoko/backend/internal/core/web"
	"github.com/frederikbeimgraben/kinoko/backend/internal/server"
)

// CacheControl is the cache header of an image file. A file of a key never changes.
const CacheControl = "public, max-age=31536000, immutable"

// Module is the photos module.
type Module struct {
	deps server.Deps
}

// New makes the module.
func New(deps server.Deps) *Module { return &Module{deps: deps} }

// Routes adds the endpoints.
func (m *Module) Routes(r *server.Router) {
	r.Handle(http.MethodGet, "/photos", m.list)
	r.Handle(http.MethodPost, "/photos", m.upload)
	r.Handle(http.MethodGet, "/photos/{id}", m.get)
	r.Handle(http.MethodDelete, "/photos/{id}", m.remove)
	r.Handle(http.MethodGet, "/photos/{id}/{size}", m.file)
	r.Handle(http.MethodPost, "/photos/{id}/approval", m.approve)
	r.Handle(http.MethodPost, "/photos/{id}/rejection", m.reject)
	r.Handle(http.MethodDelete, "/photos/{id}/review", m.reopen)
	r.Handle(http.MethodPut, "/photos/{id}/lead", m.lead)
}

func (m *Module) list(r *http.Request) (web.Response, error) {
	viewer, err := auth.From(r)
	if err != nil {
		return nil, err
	}
	page, err := paging.FromRequest(r, paging.MaxLimit)
	if err != nil {
		return nil, err
	}
	filter, err := filterOf(r)
	if err != nil {
		return nil, err
	}
	if filter.Mine && viewer.User == nil {
		return nil, problem.Unauthorized()
	}
	rows, err := listPhotos(r.Context(), m.deps.DB, filter, viewer, page)
	if err != nil {
		return nil, err
	}
	wrapped := paging.Wrap(rows, page)
	return web.OK(paging.Page[Out]{Items: mapOut(wrapped.Items), NextCursor: wrapped.NextCursor}), nil
}

func mapOut(rows []Photo) []Out {
	out := make([]Out, len(rows))
	for i, row := range rows {
		out[i] = ToOut(row)
	}
	return out
}

// filterOf reads the query of the list. The contract has checked the types.
func filterOf(r *http.Request) (Filter, error) {
	errs := []problem.FieldError{}
	out := Filter{}
	if v := web.Query(r, "state"); v != nil {
		state := enums.PhotoState(*v)
		if state.Valid() {
			out.State = &state
		} else {
			errs = append(errs, problem.FieldError{Field: "state", Code: "enum"})
		}
	}
	for _, name := range []string{"speciesId", "findId"} {
		v := web.Query(r, name)
		if v == nil {
			continue
		}
		id, err := db.ParseID(*v)
		if err != nil {
			errs = append(errs, problem.FieldError{Field: name, Code: "uuid_parsing"})
			continue
		}
		if name == "speciesId" {
			out.SpeciesID = &id
		} else {
			out.FindID = &id
		}
	}
	if v := web.Query(r, "mine"); v != nil {
		mine, ok := laxBool(*v)
		if !ok {
			errs = append(errs, problem.FieldError{Field: "mine", Code: "bool_parsing"})
		}
		out.Mine = mine
	}
	if len(errs) > 0 {
		return out, problem.Invalid(errs...)
	}
	return out, nil
}

// laxBool reads a boolean as pydantic does in lax mode.
func laxBool(v string) (bool, bool) {
	switch strings.ToLower(v) {
	case "1", "true", "t", "yes", "y", "on":
		return true, true
	case "0", "false", "f", "no", "n", "off":
		return false, true
	}
	return false, false
}

func (m *Module) upload(r *http.Request) (web.Response, error) {
	user, _, err := m.deps.Auth.CurrentUser(r)
	if err != nil {
		return nil, err
	}
	raw, err := readForm(r, m.deps.Settings.MaxPhotoBytes)
	if err != nil {
		return nil, err
	}
	arrival, err := check(raw)
	if err != nil {
		return nil, err
	}
	id, err := m.create(r.Context(), user, arrival)
	if err != nil {
		return nil, err
	}
	photo, err := m.load(r.Context(), id)
	if err != nil {
		return nil, err
	}
	return web.Created(ToOut(photo)), nil
}

func (m *Module) load(ctx context.Context, id db.ID) (Photo, error) {
	photo, ok, err := photoByID(ctx, m.deps.DB, id)
	if err == nil && !ok {
		err = problem.NotFound()
	}
	return photo, err
}

// visibleOr404 reads a photo that the viewer can see, else 404.
func (m *Module) visibleOr404(ctx context.Context, id db.ID, viewer auth.Viewer) (Photo, error) {
	photo, err := m.load(ctx, id)
	if err != nil {
		return photo, err
	}
	if !Visible(photo, viewer) {
		return photo, problem.NotFound()
	}
	return photo, nil
}

func (m *Module) get(r *http.Request) (web.Response, error) {
	viewer, err := auth.From(r)
	if err != nil {
		return nil, err
	}
	id, err := web.PathID(r, "id")
	if err != nil {
		return nil, err
	}
	photo, err := m.visibleOr404(r.Context(), id, viewer)
	if err != nil {
		return nil, err
	}
	return web.OK(ToOut(photo)), nil
}

func (m *Module) file(r *http.Request) (web.Response, error) {
	viewer, err := auth.From(r)
	if err != nil {
		return nil, err
	}
	id, err := web.PathID(r, "id")
	if err != nil {
		return nil, err
	}
	size := enums.PhotoSize(r.PathValue("size"))
	if !size.Valid() {
		return nil, problem.InvalidField("size", "enum")
	}
	photo, err := m.visibleOr404(r.Context(), id, viewer)
	if err != nil {
		return nil, err
	}
	path, ok := PathOf(m.deps.Settings.Photos, photo.ID, size)
	if !ok {
		return nil, problem.NotFound()
	}
	return fileResponse{path: path, request: r}, nil
}

// fileResponse serves a JPEG with the request, so that ranges and
// conditional requests work.
type fileResponse struct {
	path    string
	request *http.Request
}

func (f fileResponse) Send(w http.ResponseWriter) {
	file, err := os.Open(f.path)
	if err != nil {
		problem.Write(w, problem.NotFound())
		return
	}
	defer func() { _ = file.Close() }()
	info, err := file.Stat()
	if err != nil {
		problem.Write(w, problem.NotFound())
		return
	}
	w.Header().Set("Content-Type", "image/jpeg")
	w.Header().Set("Cache-Control", CacheControl)
	http.ServeContent(w, f.request, "", info.ModTime(), file)
}

func (m *Module) remove(r *http.Request) (web.Response, error) {
	_, viewer, err := m.deps.Auth.CurrentUser(r)
	if err != nil {
		return nil, err
	}
	id, err := web.PathID(r, "id")
	if err != nil {
		return nil, err
	}
	photo, err := m.visibleOr404(r.Context(), id, viewer)
	if err != nil {
		return nil, err
	}
	if !mayChange(photo, viewer) {
		return nil, problem.Forbidden()
	}
	if _, err := db.Exec(r.Context(), m.deps.DB, "DELETE FROM photo WHERE id = ?", photo.ID); err != nil {
		return nil, err
	}
	if err := RemoveFiles(m.deps.Settings.Photos, []db.ID{photo.ID}); err != nil {
		return nil, err
	}
	return web.Empty(http.StatusNoContent), nil
}

func (m *Module) approve(r *http.Request) (web.Response, error) {
	user, _, err := m.deps.Auth.CurrentUser(r)
	if err != nil {
		return nil, err
	}
	id, err := web.PathID(r, "id")
	if err != nil {
		return nil, err
	}
	now := db.At(m.deps.Now())
	err = db.InTx(r.Context(), m.deps.DB, func(tx *sql.Tx) error {
		photo, ok, err := photoByID(r.Context(), tx, id)
		if err != nil {
			return err
		}
		if !ok {
			return problem.NotFound()
		}
		lead := photo.Lead
		if photo.SpeciesID != nil && !photo.Lead {
			taken, err := db.Scalar[bool](r.Context(), tx,
				"SELECT EXISTS (SELECT 1 FROM photo WHERE species_id = ? AND lead = 1)", *photo.SpeciesID)
			if err != nil {
				return err
			}
			lead = !taken
		}
		_, err = tx.ExecContext(r.Context(), `UPDATE photo SET state = 'approved', reviewed_by_id = ?,
			reviewed_at = ?, reject_reason = NULL, lead = ?, updated_at = ? WHERE id = ?`,
			user.ID, now, lead, now, id)
		return err
	})
	if err != nil {
		return nil, err
	}
	return m.answer(r.Context(), id)
}

func (m *Module) answer(ctx context.Context, id db.ID) (web.Response, error) {
	photo, err := m.load(ctx, id)
	if err != nil {
		return nil, err
	}
	return web.OK(ToOut(photo)), nil
}

type rejection struct {
	Reason string `json:"reason"`
}

func (m *Module) reject(r *http.Request) (web.Response, error) {
	user, _, err := m.deps.Auth.CurrentUser(r)
	if err != nil {
		return nil, err
	}
	id, err := web.PathID(r, "id")
	if err != nil {
		return nil, err
	}
	body, err := web.Decode[rejection](r)
	if err != nil {
		return nil, err
	}
	now := db.At(m.deps.Now())
	changed, err := db.Exec(r.Context(), m.deps.DB, `UPDATE photo SET state = 'rejected',
		reviewed_by_id = ?, reviewed_at = ?, reject_reason = ?, updated_at = ? WHERE id = ?`,
		user.ID, now, body.Reason, now, id)
	if err != nil {
		return nil, err
	}
	if changed == 0 {
		return nil, problem.NotFound()
	}
	return m.answer(r.Context(), id)
}

func (m *Module) lead(r *http.Request) (web.Response, error) {
	_, viewer, err := m.deps.Auth.CurrentUser(r)
	if err != nil {
		return nil, err
	}
	id, err := web.PathID(r, "id")
	if err != nil {
		return nil, err
	}
	now := db.At(m.deps.Now())
	err = db.InTx(r.Context(), m.deps.DB, func(tx *sql.Tx) error {
		photo, ok, err := photoByID(r.Context(), tx, id)
		if err != nil {
			return err
		}
		if !ok || !Visible(photo, viewer) {
			return problem.NotFound()
		}
		if !mayChange(photo, viewer) {
			return problem.Forbidden()
		}
		if !Public(photo) {
			return problem.Conflict("", "")
		}
		previous, found, err := db.Maybe(r.Context(), tx, func(s db.Scanner) (db.ID, error) {
			var p db.ID
			return p, s.Scan(&p)
		}, "SELECT id FROM photo WHERE species_id = ? AND lead = 1 LIMIT 1", *photo.SpeciesID)
		if err != nil {
			return err
		}
		if found && previous != photo.ID {
			if _, err := tx.ExecContext(r.Context(),
				"UPDATE photo SET lead = 0, updated_at = ? WHERE id = ?", now, previous); err != nil {
				return err
			}
		}
		_, err = tx.ExecContext(r.Context(),
			"UPDATE photo SET lead = 1, updated_at = ? WHERE id = ? AND lead = 0", now, photo.ID)
		return err
	})
	if err != nil {
		return nil, err
	}
	return m.answer(r.Context(), id)
}
