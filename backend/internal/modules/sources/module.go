// Package sources keeps the data sources of the forecast pipeline: admin
// uploads in resumable parts, their versions with validation and derived
// files, the activation of one version per kind, and the cache state of the
// public sources. The pipeline reads the active inputs through Resolver.
package sources

import (
	"context"
	"net/http"
	"path/filepath"
	"sync"
	"time"

	"github.com/frederikbeimgraben/kinoko/backend/internal/core/db"
	"github.com/frederikbeimgraben/kinoko/backend/internal/modules/runs"
	"github.com/frederikbeimgraben/kinoko/backend/internal/server"
)

// janitorEvery is the interval of the sweep of expired upload sessions.
const janitorEvery = 15 * time.Minute

// Module is the sources module.
type Module struct {
	deps      server.Deps
	runs      *runs.Store
	files     files
	free      func(path string) (uint64, error)
	builtins  map[Kind]Processor
	overrides map[Kind]Processor
	locks     sync.Map
	work      sync.WaitGroup
	activated func(ctx context.Context, kind Kind)
}

// New makes the module. The run store queues the fetch runs; it must be
// the store of the runs module, so that the pipeline gets the signal.
func New(deps server.Deps, runStore *runs.Store) *Module {
	root := deps.Settings.DataRoot
	if abs, err := filepath.Abs(root); err == nil {
		root = abs
	}
	m := &Module{
		deps:  deps,
		runs:  runStore,
		files: files{root: root},
		free:  freeBytes,
	}
	m.builtins = builtinProcessors(m)
	m.overrides = map[Kind]Processor{}
	return m
}

// Root gives the absolute data folder (setting PILZE_DATA).
func (m *Module) Root() string { return m.files.root }

// Routes adds the endpoints.
func (m *Module) Routes(r *server.Router) {
	r.Handle(http.MethodGet, "/data-sources", m.listSources)
	r.Handle(http.MethodGet, "/data-sources/{kind}", m.getSource)
	r.Handle(http.MethodPost, "/data-sources/{kind}/uploads", m.createUpload)
	r.Handle(http.MethodGet, "/data-source-uploads/{id}", m.getUpload)
	r.Handle(http.MethodPatch, "/data-source-uploads/{id}", m.appendUpload)
	r.Handle(http.MethodDelete, "/data-source-uploads/{id}", m.abortUpload)
	r.Handle(http.MethodPost, "/data-source-uploads/{id}/complete", m.completeUpload)
	r.Handle(http.MethodGet, "/data-sources/{kind}/versions/{versionId}", m.getVersion)
	r.Handle(http.MethodDelete, "/data-sources/{kind}/versions/{versionId}", m.deleteVersion)
	r.Handle(http.MethodPost, "/data-sources/{kind}/versions/{versionId}/activate", m.activateVersion)
	r.Handle(http.MethodPost, "/data-sources/{kind}/versions/{versionId}/reprocess", m.reprocessVersion)
	r.Handle(http.MethodGet, "/data-sources/{kind}/versions/{versionId}/log", m.versionLog)
	r.Handle(http.MethodGet, "/remote-sources", m.listRemote)
	r.Handle(http.MethodPost, "/remote-sources/{source}/refresh", m.refreshRemote)
}

// Start seeds the forecast chains, ends expired uploads and starts the
// processing that a stopped process left. It writes no file.
func (m *Module) Start(ctx context.Context) error {
	if err := seedForecasts(ctx, m.deps.DB); err != nil {
		return err
	}
	if _, err := m.Sweep(ctx); err != nil {
		return err
	}
	if err := m.resume(ctx); err != nil {
		return err
	}
	go m.janitor(ctx)
	return nil
}

// OnActivate sets a function that runs in the background each time a version of a kind
// becomes active. The pipeline uses it to publish the static layers. Set it before Start.
func (m *Module) OnActivate(hook func(ctx context.Context, kind Kind)) { m.activated = hook }

// notifyActive starts the hook of OnActivate for a kind.
func (m *Module) notifyActive(kind Kind) {
	if m.activated == nil {
		return
	}
	m.work.Add(1)
	go func() {
		defer m.work.Done()
		m.activated(context.Background(), kind)
	}()
}

// Wait blocks until the processing in the background is done.
func (m *Module) Wait() { m.work.Wait() }

func (m *Module) now() db.Time { return db.At(m.deps.Now()) }

func (m *Module) janitor(ctx context.Context) {
	ticker := time.NewTicker(janitorEvery)
	defer ticker.Stop()
	for {
		select {
		case <-ctx.Done():
			return
		case <-ticker.C:
			if _, err := m.Sweep(ctx); err != nil && ctx.Err() == nil {
				m.deps.Log.Warn("sweep expired uploads", "error", err)
			}
		}
	}
}

// lock gives the lock of one upload session. Parts of one session must not overlap.
func (m *Module) lock(id db.ID) *sync.Mutex {
	value, _ := m.locks.LoadOrStore(id, &sync.Mutex{})
	return value.(*sync.Mutex)
}
