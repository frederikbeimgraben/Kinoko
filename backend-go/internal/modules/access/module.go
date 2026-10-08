// Package access is the access part of the API: the own account, permissions,
// roles, people, friend groups and the counts of the admin overview.
package access

import (
	"context"
	"net/http"

	"github.com/frederikbeimgraben/kinoko/backend/internal/core/db"
	"github.com/frederikbeimgraben/kinoko/backend/internal/server"
)

// Module is the access module.
type Module struct {
	deps server.Deps
}

// New makes the module.
func New(deps server.Deps) *Module { return &Module{deps: deps} }

// Routes adds the endpoints.
func (m *Module) Routes(r *server.Router) {
	r.Handle(http.MethodGet, "/me", m.getMe)
	r.Handle(http.MethodGet, "/me/permissions", m.getMyPermissions)
	r.Handle(http.MethodGet, "/me/export", m.exportMyData)
	r.Handle(http.MethodDelete, "/me/data", m.deleteMyData)

	r.Handle(http.MethodGet, "/admin/summary", m.getAdminSummary)
	r.Handle(http.MethodGet, "/admin/species-counts", m.getAdminSpeciesCounts)
	r.Handle(http.MethodGet, "/permissions", m.listPermissions)

	r.Handle(http.MethodGet, "/roles", m.listRoles)
	r.Handle(http.MethodPost, "/roles", m.createRole)
	r.Handle(http.MethodGet, "/roles/{id}", m.getRole)
	r.Handle(http.MethodPatch, "/roles/{id}", m.updateRole)
	r.Handle(http.MethodDelete, "/roles/{id}", m.deleteRole)

	r.Handle(http.MethodGet, "/people", m.listPeople)
	r.Handle(http.MethodGet, "/people/names", m.resolvePersonNames)
	r.Handle(http.MethodGet, "/people/{id}", m.getPerson)
	r.Handle(http.MethodDelete, "/people/{id}", m.deletePerson)
	r.Handle(http.MethodPut, "/people/{id}/roles", m.setPersonRoles)

	r.Handle(http.MethodGet, "/groups", m.listGroups)
	r.Handle(http.MethodPost, "/groups", m.createGroup)
	r.Handle(http.MethodPost, "/groups/join", m.joinGroup)
	r.Handle(http.MethodGet, "/groups/{id}", m.getGroup)
	r.Handle(http.MethodPut, "/groups/{id}", m.updateGroup)
	r.Handle(http.MethodDelete, "/groups/{id}", m.deleteGroup)
	r.Handle(http.MethodDelete, "/groups/{id}/members/{userId}", m.removeGroupMember)
}

// Start writes the permissions and the built-in roles.
func (m *Module) Start(ctx context.Context) error {
	return Seed(ctx, m.deps.DB, db.At(m.deps.Now()))
}

func (m *Module) now() db.Time { return db.At(m.deps.Now()) }
