// Package system gives the health check and the values that the frontend
// reads at start.
package system

import (
	"net/http"

	"github.com/frederikbeimgraben/kinoko/backend/internal/core/config"
	"github.com/frederikbeimgraben/kinoko/backend/internal/core/web"
	"github.com/frederikbeimgraben/kinoko/backend/internal/server"
)

// Module is the system module.
type Module struct {
	settings config.Settings
}

// New makes the module.
func New(deps server.Deps) *Module { return &Module{settings: deps.Settings} }

// Routes adds the endpoints.
func (m *Module) Routes(r *server.Router) {
	r.Handle(http.MethodGet, "/health", m.health)
	r.Handle(http.MethodGet, "/config", m.config)
}

type health struct {
	Status string `json:"status"`
}

func (m *Module) health(*http.Request) (web.Response, error) {
	return web.OK(health{Status: "ok"}), nil
}

type frontendConfig struct {
	OIDCIssuer   string `json:"oidcIssuer"`
	OIDCName     string `json:"oidcName"`
	OIDCClientID string `json:"oidcClientId"`
	Origin       string `json:"origin"`
	Version      string `json:"version"`
}

func (m *Module) config(*http.Request) (web.Response, error) {
	return web.OK(frontendConfig{
		OIDCIssuer:   m.settings.OIDCIssuer,
		OIDCName:     m.settings.ProviderName(),
		OIDCClientID: m.settings.OIDCClientID,
		Origin:       m.settings.Origin,
		Version:      config.Version,
	}), nil
}
