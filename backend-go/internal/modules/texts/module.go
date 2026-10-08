// Package texts is the texts part of the API.
package texts

import (
	"github.com/frederikbeimgraben/kinoko/backend/internal/server"
)

// Module is the texts module.
type Module struct {
	deps server.Deps
}

// New makes the module.
func New(deps server.Deps) *Module { return &Module{deps: deps} }

// Routes adds the endpoints.
func (m *Module) Routes(r *server.Router) {}
