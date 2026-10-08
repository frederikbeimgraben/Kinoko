// Package objects holds the things that a person keeps: finds, markers,
// zones and combinations. Each has an owner, a soft delete and a sync by
// time for the offline devices.
package objects

import (
	"context"
	"net/http"
	"strconv"
	"strings"
	"time"

	"github.com/frederikbeimgraben/kinoko/backend/internal/core/db"
	"github.com/frederikbeimgraben/kinoko/backend/internal/core/enums"
	"github.com/frederikbeimgraben/kinoko/backend/internal/core/paging"
	"github.com/frederikbeimgraben/kinoko/backend/internal/core/problem"
	"github.com/frederikbeimgraben/kinoko/backend/internal/core/web"
	"github.com/frederikbeimgraben/kinoko/backend/internal/server"
	"github.com/frederikbeimgraben/kinoko/backend/internal/shared"
)

// Module is the objects module.
type Module struct {
	deps server.Deps
}

// New makes the module.
func New(deps server.Deps) *Module { return &Module{deps: deps} }

// Routes adds the endpoints.
func (m *Module) Routes(r *server.Router) {
	r.Handle(http.MethodGet, "/finds", m.listFinds)
	r.Handle(http.MethodPost, "/finds", m.createFind)
	r.Handle(http.MethodGet, "/finds/{id}", m.getFind)
	r.Handle(http.MethodPut, "/finds/{id}", m.putFind)
	r.Handle(http.MethodDelete, "/finds/{id}", m.deleteFind)
	r.Handle(http.MethodPost, "/finds/{id}/review", m.reviewFind)
	r.Handle(http.MethodGet, "/finds/reviews/open", m.openFinds)
	r.Handle(http.MethodPost, "/finds/reviews/accept-all", m.acceptAll)

	r.Handle(http.MethodGet, "/markers", m.listMarkers)
	r.Handle(http.MethodPost, "/markers", m.createMarker)
	r.Handle(http.MethodGet, "/markers/{id}", m.getMarker)
	r.Handle(http.MethodPut, "/markers/{id}", m.putMarker)
	r.Handle(http.MethodDelete, "/markers/{id}", m.deleteMarker)

	r.Handle(http.MethodGet, "/zones", m.listZones)
	r.Handle(http.MethodPost, "/zones", m.createZone)
	r.Handle(http.MethodGet, "/zones/{id}", m.getZone)
	r.Handle(http.MethodPut, "/zones/{id}", m.putZone)
	r.Handle(http.MethodDelete, "/zones/{id}", m.deleteZone)
	r.Handle(http.MethodGet, "/zones/{id}/value", m.zoneValue)

	r.Handle(http.MethodGet, "/combinations", m.listCombinations)
	r.Handle(http.MethodPost, "/combinations", m.createCombination)
	r.Handle(http.MethodGet, "/combinations/{id}", m.getCombination)
	r.Handle(http.MethodPut, "/combinations/{id}", m.putCombination)
	r.Handle(http.MethodDelete, "/combinations/{id}", m.deleteCombination)
}

func (m *Module) now() db.Time { return db.At(m.deps.Now()) }

// userID gives the signed-in person and creates the row at the first call.
func (m *Module) userID(r *http.Request) (db.ID, error) {
	user, _, err := m.deps.Auth.CurrentUser(r)
	return user.ID, err
}

// groupOf checks the group of an entry. A private entry has no group; a
// shared entry needs a group of which the person is a member.
func (m *Module) groupOf(ctx context.Context, user db.ID, visibility enums.Visibility, group *db.ID) (*db.ID, error) {
	if visibility != enums.VisibilityShared {
		return nil, nil
	}
	if group == nil {
		return nil, problem.InvalidField("groupId", "group")
	}
	held, err := shared.MemberGroupIDs(ctx, m.deps.DB, user)
	if err != nil {
		return nil, err
	}
	if _, ok := held[*group]; !ok {
		return nil, problem.InvalidField("groupId", "group")
	}
	return group, nil
}

func visibilityOr(v *enums.Visibility) enums.Visibility {
	if v == nil {
		return enums.VisibilityPrivate
	}
	return *v
}

func colourOr(c *enums.MarkerColour) enums.MarkerColour {
	if c == nil {
		return enums.MarkerColourGreen
	}
	return *c
}

var sinceLayouts = []string{
	time.RFC3339Nano,
	"2006-01-02 15:04:05.999999999Z07:00",
	"2006-01-02T15:04:05.999999999",
	"2006-01-02 15:04:05.999999999",
	"2006-01-02T15:04",
	"2006-01-02 15:04",
	"2006-01-02",
}

// sinceOf reads the query value "since". A value with an offset becomes
// UTC; a value without a zone is UTC.
func sinceOf(r *http.Request) (*db.Time, error) {
	raw := web.Query(r, "since")
	if raw == nil {
		return nil, nil
	}
	text := strings.TrimSpace(*raw)
	for _, layout := range sinceLayouts {
		if parsed, err := time.Parse(layout, text); err == nil {
			stamp := db.At(parsed)
			return &stamp, nil
		}
	}
	return nil, problem.InvalidField("since", "datetime_from_date_parsing")
}

// boolOf reads a query flag with the values that pydantic accepts.
func boolOf(r *http.Request, name string, fallback bool) (bool, error) {
	raw := web.Query(r, name)
	if raw == nil {
		return fallback, nil
	}
	switch strings.ToLower(strings.TrimSpace(*raw)) {
	case "1", "true", "t", "yes", "y", "on":
		return true, nil
	case "0", "false", "f", "no", "n", "off":
		return false, nil
	}
	return false, problem.InvalidField(name, "bool_parsing")
}

func idOf(r *http.Request, name string) (*db.ID, error) {
	raw := web.Query(r, name)
	if raw == nil {
		return nil, nil
	}
	id, err := db.ParseID(*raw)
	if err != nil {
		return nil, problem.InvalidField(name, "uuid_parsing")
	}
	return &id, nil
}

func intOf(r *http.Request, name string) (int, error) {
	raw := web.Query(r, name)
	if raw == nil {
		return 0, problem.InvalidField(name, "missing")
	}
	value, err := strconv.Atoi(strings.TrimSpace(*raw))
	if err != nil {
		return 0, problem.InvalidField(name, "int_parsing")
	}
	return value, nil
}

// ownList is the shared list endpoint of markers, zones and combinations.
func ownList[T, O any](m *Module, r *http.Request, k kind[T], out func(T) O) (web.Response, error) {
	user, err := m.userID(r)
	if err != nil {
		return nil, err
	}
	p, err := paging.FromRequest(r, paging.MaxLimit)
	if err != nil {
		return nil, err
	}
	since, err := sinceOf(r)
	if err != nil {
		return nil, err
	}
	rows, err := k.mine(r.Context(), m.deps.DB, user, since, p)
	if err != nil {
		return nil, err
	}
	return web.OK(pageOf(rows, p, out)), nil
}

func ownGet[T, O any](m *Module, r *http.Request, k kind[T], out func(T) O) (web.Response, error) {
	user, err := m.userID(r)
	if err != nil {
		return nil, err
	}
	id, err := web.PathID(r, "id")
	if err != nil {
		return nil, err
	}
	row, err := k.own(r.Context(), m.deps.DB, user, id)
	if err != nil {
		return nil, err
	}
	return web.OK(out(row)), nil
}

func ownDelete[T any](m *Module, r *http.Request, k kind[T]) (web.Response, error) {
	user, err := m.userID(r)
	if err != nil {
		return nil, err
	}
	id, err := web.PathID(r, "id")
	if err != nil {
		return nil, err
	}
	if err := k.remove(r.Context(), m.deps.DB, user, id, m.now()); err != nil {
		return nil, err
	}
	return web.Empty(http.StatusNoContent), nil
}

// ownWrite is the shared create and replace flow. values reads the body and
// gives the columns; it runs before the row is read, as in the Python service.
func ownWrite[T, O any](m *Module, r *http.Request, k kind[T], replace bool,
	values func(user db.ID) ([]column, error), out func(T) O,
) (web.Response, error) {
	user, err := m.userID(r)
	if err != nil {
		return nil, err
	}
	var id db.ID
	if replace {
		if id, err = web.PathID(r, "id"); err != nil {
			return nil, err
		}
	}
	cols, err := values(user)
	if err != nil {
		return nil, err
	}
	if !replace {
		row, err := k.create(r.Context(), m.deps.DB, user, cols, m.now())
		if err != nil {
			return nil, err
		}
		return web.Created(out(row)), nil
	}
	result, err := k.upsert(r.Context(), m.deps.DB, user, id, cols, m.now())
	if err != nil {
		return nil, err
	}
	if result.created {
		return web.Created(out(result.row)), nil
	}
	return web.OK(out(result.row)), nil
}
