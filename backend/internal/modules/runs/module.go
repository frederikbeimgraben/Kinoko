// Package runs keeps the runs of the forecast pipeline: the queue, the
// state of each species and step, and the endpoints under /pipeline-runs.
package runs

import (
	"context"
	"net/http"

	"github.com/frederikbeimgraben/kinoko/backend/internal/core/db"
	"github.com/frederikbeimgraben/kinoko/backend/internal/core/enums"
	"github.com/frederikbeimgraben/kinoko/backend/internal/core/paging"
	"github.com/frederikbeimgraben/kinoko/backend/internal/core/web"
	"github.com/frederikbeimgraben/kinoko/backend/internal/fn"
	"github.com/frederikbeimgraben/kinoko/backend/internal/server"
)

// Module is the runs module.
type Module struct {
	deps  server.Deps
	store *Store
}

// New makes the module.
func New(deps server.Deps) *Module {
	return &Module{deps: deps, store: NewStore(deps.DB, deps.Now)}
}

// Store gives the store that the pipeline in the process uses.
func (m *Module) Store() *Store { return m.store }

// Routes adds the endpoints.
func (m *Module) Routes(r *server.Router) {
	r.Handle(http.MethodGet, "/pipeline-runs", m.list)
	r.Handle(http.MethodPost, "/pipeline-runs", m.create)
	r.Handle(http.MethodGet, "/pipeline-runs/{id}", m.get)
}

// Start sets the runs that a stopped process left running to failed.
// When runs wait, it signals the pipeline.
func (m *Module) Start(ctx context.Context) error {
	failed, err := m.store.FailStale(ctx)
	if err != nil {
		return err
	}
	if failed > 0 && m.deps.Log != nil {
		m.deps.Log.Warn("set stale pipeline runs to failed", "count", failed)
	}
	waiting, err := m.store.Waiting(ctx)
	if waiting {
		m.store.signal()
	}
	return err
}

func (m *Module) list(r *http.Request) (web.Response, error) {
	page, err := paging.FromRequest(r, paging.MaxLimit)
	if err != nil {
		return nil, err
	}
	limit, offset := page.SQL()
	ctx := r.Context()
	found, err := listRuns(ctx, m.deps.DB, limit, offset)
	if err != nil {
		return nil, err
	}
	counted, err := tallies(ctx, m.deps.DB, fn.Map(found, func(run Run) db.ID { return run.ID }))
	if err != nil {
		return nil, err
	}
	shown := fn.Map(found, func(run Run) Summary { return summaryOf(run, counted[run.ID]) })
	return web.OK(paging.Wrap(shown, page)), nil
}

type createBody struct {
	Kind enums.RunKind `json:"kind"`
}

func (m *Module) create(r *http.Request) (web.Response, error) {
	user, _, err := m.deps.Auth.CurrentUser(r)
	if err != nil {
		return nil, err
	}
	body, err := web.Decode[createBody](r)
	if err != nil {
		return nil, err
	}
	run, err := m.store.Queue(r.Context(), body.Kind, user.ID)
	if err != nil {
		return nil, err
	}
	return web.Created(summaryOf(run, tally{})), nil
}

func (m *Module) get(r *http.Request) (web.Response, error) {
	id, err := web.PathID(r, "id")
	if err != nil {
		return nil, err
	}
	ctx := r.Context()
	run, err := m.store.Get(ctx, id)
	if err != nil {
		return nil, err
	}
	detail, err := detailOf(ctx, m.deps.DB, run)
	if err != nil {
		return nil, err
	}
	return web.OK(detail), nil
}
