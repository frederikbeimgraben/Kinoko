// Package catalog is the catalog part of the API: species, the bundle,
// taxa and terms.
package catalog

import (
	"context"
	"net/http"

	"github.com/frederikbeimgraben/kinoko/backend/internal/core/db"
	"github.com/frederikbeimgraben/kinoko/backend/internal/modules/catalog/importer"
	"github.com/frederikbeimgraben/kinoko/backend/internal/server"
)

// Module is the catalog module.
type Module struct {
	deps  server.Deps
	cache *bundleCache
}

// New makes the module.
func New(deps server.Deps) *Module { return &Module{deps: deps, cache: &bundleCache{}} }

// Routes adds the endpoints.
func (m *Module) Routes(r *server.Router) {
	r.Handle(http.MethodGet, "/species/bundle", m.bundle)
	r.Handle(http.MethodGet, "/species", m.listSpecies)
	r.Handle(http.MethodPost, "/species", m.createSpecies)
	r.Handle(http.MethodGet, "/species/{slug}", m.getSpecies)
	r.Handle(http.MethodPut, "/species/{slug}", m.replaceSpecies)
	r.Handle(http.MethodDelete, "/species/{slug}", m.deleteSpecies)
	r.Handle(http.MethodPut, "/species/{slug}/forecast", m.setForecast)
	r.Handle(http.MethodGet, "/species/{slug}/counts", m.speciesCounts)
	r.Handle(http.MethodGet, "/admin/species-counts", m.adminSpeciesCounts)
	r.Handle(http.MethodGet, "/taxa/{rank}/{slug}", m.taxonPage)
	r.Handle(http.MethodGet, "/terms", m.listTerms)
	r.Handle(http.MethodPost, "/terms", m.createTerm)
	r.Handle(http.MethodPatch, "/terms/{id}", m.updateTerm)
	r.Handle(http.MethodDelete, "/terms/{id}", m.deleteTerm)
	r.Handle(http.MethodPost, "/terms/{id}/merge", m.mergeTerm)
}

// Start imports the catalogue when the table species is empty and builds
// the bundle. The first request then finds the bundle ready.
func (m *Module) Start(ctx context.Context) error {
	if err := importer.SeedIfEmpty(ctx, m.deps.DB, m.deps.Data, m.deps.Now); err != nil {
		return err
	}
	return m.Warm(ctx)
}

func (m *Module) now() db.Time { return db.At(m.deps.Now()) }
