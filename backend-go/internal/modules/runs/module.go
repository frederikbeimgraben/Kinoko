// Package runs is the runs part of the API.
package runs

import (
	"github.com/frederikbeimgraben/kinoko/backend/internal/server"
)

// Module is the runs module.
type Module struct {
	deps server.Deps
}

// New makes the module.
func New(deps server.Deps) *Module { return &Module{deps: deps} }

// Routes adds the endpoints.
func (m *Module) Routes(r *server.Router) {}
