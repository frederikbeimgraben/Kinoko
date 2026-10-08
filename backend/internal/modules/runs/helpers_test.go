package runs_test

import (
	"context"
	"sync"
	"testing"
	"time"

	"github.com/frederikbeimgraben/kinoko/backend/internal/core/db"
	"github.com/frederikbeimgraben/kinoko/backend/internal/core/enums"
	"github.com/frederikbeimgraben/kinoko/backend/internal/modules/runs"
	"github.com/frederikbeimgraben/kinoko/backend/internal/testkit"
)

// fixture is a test service with an empty species table and a store with a
// clock that goes one second forward at each call.
type fixture struct {
	t     *testing.T
	env   *testkit.Env
	store *runs.Store
	ctx   context.Context
}

func newFixture(t *testing.T) *fixture {
	t.Helper()
	env := testkit.New(t)
	f := &fixture{t: t, env: env, store: runs.NewStore(env.DB, steppingClock()), ctx: context.Background()}
	// The catalog seed can add species. These tests choose their own species.
	f.exec("DELETE FROM species")
	f.exec(`INSERT OR IGNORE INTO permission ("key", area) VALUES ('run.manage', 'data')`)
	return f
}

func steppingClock() func() time.Time {
	var mu sync.Mutex
	at := time.Date(2026, 6, 1, 8, 0, 0, 0, time.UTC)
	return func() time.Time {
		mu.Lock()
		defer mu.Unlock()
		at = at.Add(time.Second)
		return at
	}
}

func (f *fixture) exec(query string, args ...any) {
	f.t.Helper()
	if _, err := f.env.DB.ExecContext(f.ctx, query, args...); err != nil {
		f.t.Fatal(err)
	}
}

func (f *fixture) module() *runs.Module {
	f.t.Helper()
	for _, m := range f.env.Service.Modules {
		if found, ok := m.(*runs.Module); ok {
			return found
		}
	}
	f.t.Fatal("no runs module")
	return nil
}

func (f *fixture) user(sub string) db.ID {
	f.t.Helper()
	id := db.NewID()
	f.exec("INSERT INTO user (id, sub, email, name, created_at) VALUES (?, ?, NULL, NULL, ?)", id, sub, db.Now())
	return id
}

func (f *fixture) species(slug string, forecast bool) db.ID {
	f.t.Helper()
	id := db.NewID()
	f.exec(`INSERT INTO species (id, slug, name, latin_name, group_key, edibility, marketable,
		forecast_enabled, protection, updated_at) VALUES (?, ?, ?, ?, ?, ?, 0, ?, 'none', ?)`,
		id, slug, slug, "Latinus "+slug, enums.GroupBolete, "edible", forecast, db.Now())
	return id
}

type findSpec struct {
	species  *db.ID
	training bool
	review   enums.ReviewState
	deleted  bool
	day      int
}

func (f *fixture) find(owner db.ID, spec findSpec) db.ID {
	f.t.Helper()
	id := db.NewID()
	var deleted *db.Time
	if spec.deleted {
		now := db.Now()
		deleted = &now
	}
	day := max(spec.day, 1)
	f.exec(`INSERT INTO find (id, owner_id, species_id, lat, lon, found_on, count, for_training,
		review_state, visibility, created_at, updated_at, deleted_at)
		VALUES (?, ?, ?, 1.0, 2.0, ?, NULL, ?, ?, 'private', ?, ?, ?)`,
		id, owner, spec.species, db.DateOf(time.Date(2026, 6, day, 0, 0, 0, 0, time.UTC)),
		spec.training, spec.review, db.Now(), db.Now(), deleted)
	return id
}

func (f *fixture) queue(kind enums.RunKind, by db.ID) runs.Run {
	f.t.Helper()
	run, err := f.store.Queue(f.ctx, kind, by)
	if err != nil {
		f.t.Fatal(err)
	}
	return run
}

func (f *fixture) get(id db.ID) runs.Run {
	f.t.Helper()
	run, err := f.store.Get(f.ctx, id)
	if err != nil {
		f.t.Fatal(err)
	}
	return run
}

func (f *fixture) count(query string, args ...any) int {
	f.t.Helper()
	n, err := db.Scalar[int](f.ctx, f.env.DB, query, args...)
	if err != nil {
		f.t.Fatal(err)
	}
	return n
}

func must(t *testing.T, err error) {
	t.Helper()
	if err != nil {
		t.Fatal(err)
	}
}

func ptr[T any](v T) *T { return &v }
