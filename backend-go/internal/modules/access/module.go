// Package access is the access part of the API.
package access

import (
	"github.com/frederikbeimgraben/kinoko/backend/internal/server"
)

// Module is the access module.
type Module struct {
	deps server.Deps
}

// New makes the module.
func New(deps server.Deps) *Module { return &Module{deps: deps} }

// Routes adds the endpoints.
func (m *Module) Routes(r *server.Router) {}
