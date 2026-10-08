// Package texts gives the text catalogue of the user interface and the glossary.
package texts

import (
	"context"
	"net/http"

	"github.com/frederikbeimgraben/kinoko/backend/internal/core/db"
	"github.com/frederikbeimgraben/kinoko/backend/internal/core/problem"
	"github.com/frederikbeimgraben/kinoko/backend/internal/server"
)

// Module is the texts module.
type Module struct {
	deps server.Deps
}

// New makes the module.
func New(deps server.Deps) *Module { return &Module{deps: deps} }

// Routes adds the endpoints.
func (m *Module) Routes(r *server.Router) {
	r.Handle(http.MethodGet, "/texts", m.listTexts)
	r.Handle(http.MethodPut, "/texts/{key}", m.putText)
	r.Handle(http.MethodDelete, "/texts/{key}", m.resetText)
	r.Handle(http.MethodGet, "/glossary", m.listGlossary)
	r.Handle(http.MethodPost, "/glossary", m.createGlossaryEntry)
	r.Handle(http.MethodPut, "/glossary/{id}", m.updateGlossaryEntry)
	r.Handle(http.MethodDelete, "/glossary/{id}", m.deleteGlossaryEntry)
}

// Start writes the text seed and gives the errors their titles.
// The titles stay as they are until the next start.
func (m *Module) Start(ctx context.Context) error {
	report, err := Seed(ctx, m.deps.DB, m.deps.Data, m.now())
	if err != nil {
		return err
	}
	if report.Touched() > 0 && m.deps.Log != nil {
		m.deps.Log.Info("text seed", "added", report.Added, "updated", report.Updated, "removed", report.Removed)
	}
	titles, err := LoadTitles(ctx, m.deps.DB)
	if err != nil {
		return err
	}
	problem.SetTitles(titles)
	return nil
}

func (m *Module) now() db.Time {
	if m.deps.Now == nil {
		return db.Now()
	}
	return db.At(m.deps.Now())
}
