package runner_test

import (
	"context"
	"errors"
	"fmt"
	"log/slog"
	"os"
	"path/filepath"
	"slices"
	"sync"
	"testing"
	"time"

	"github.com/frederikbeimgraben/kinoko/backend/internal/core/db"
	"github.com/frederikbeimgraben/kinoko/backend/internal/core/enums"
	"github.com/frederikbeimgraben/kinoko/backend/internal/modules/runs"
	"github.com/frederikbeimgraben/kinoko/backend/internal/modules/sources"
	"github.com/frederikbeimgraben/kinoko/backend/internal/pipeline/runner"
	"github.com/frederikbeimgraben/kinoko/backend/internal/server"
	"github.com/frederikbeimgraben/kinoko/backend/internal/testkit"
)

// fixture is a service with a runner on stub stages and a data folder of the test.
type fixture struct {
	t       *testing.T
	env     *testkit.Env
	runs    *runs.Store
	runMod  *runs.Module
	sources *sources.Module
	stages  *stubStages
	runner  *runner.Runner
	data    string
}

// newFixture builds the service and keeps the forecast of the first n species by name.
func newFixture(t *testing.T, n int) *fixture {
	t.Helper()
	env := testkit.New(t)
	f := &fixture{t: t, env: env, data: t.TempDir(), stages: &stubStages{}}
	for _, m := range env.Service.Modules {
		if rm, ok := m.(*runs.Module); ok {
			f.runMod, f.runs = rm, rm.Store()
		}
	}
	settings := env.Settings
	settings.DataRoot = f.data
	f.sources = sources.New(server.Deps{DB: env.DB, Settings: settings, Now: time.Now, Log: slog.Default()}, f.runs)
	f.keepSpecies(n)
	f.runner = runner.New(runner.Config{
		DB: env.DB, Runs: f.runs, Sources: f.sources, Stages: f.stages, Logs: env.Settings.RunLogs,
	})
	return f
}

// keepSpecies leaves the forecast on for the first n species with a chain, by name.
func (f *fixture) keepSpecies(n int) {
	f.t.Helper()
	ids, err := db.Column[db.ID](context.Background(), f.env.DB, `SELECT s.id FROM species s
		JOIN species_forecast c ON c.species_id = s.id ORDER BY s.name, s.id LIMIT ?`, n)
	if err != nil || len(ids) != n {
		f.t.Fatalf("species with a chain: %d, %v", len(ids), err)
	}
	f.exec("UPDATE species SET forecast_enabled = 0")
	for _, id := range ids {
		f.exec("UPDATE species SET forecast_enabled = 1 WHERE id = ?", id)
	}
}

func (f *fixture) exec(query string, args ...any) {
	f.t.Helper()
	if _, err := f.env.DB.Exec(query, args...); err != nil {
		f.t.Fatal(err)
	}
}

func (f *fixture) queue(kind enums.RunKind) runs.Run {
	f.t.Helper()
	run, err := f.runs.QueueScheduled(context.Background(), kind)
	if err != nil {
		f.t.Fatal(err)
	}
	return run
}

// runNext executes the next run and fails the test when none waits.
func (f *fixture) runNext() {
	f.t.Helper()
	ran, err := f.runner.RunNext(context.Background())
	if err != nil || !ran {
		f.t.Fatalf("RunNext = %v, %v", ran, err)
	}
}

// install makes an active ready version of a kind from a small file.
func (f *fixture) install(kind sources.Kind, artifact string, species *db.ID) sources.Version {
	f.t.Helper()
	dir := filepath.Join(f.data, "staging-"+db.NewID().String())
	if err := os.MkdirAll(dir, 0o755); err != nil {
		f.t.Fatal(err)
	}
	file := filepath.Join(dir, "file")
	if err := os.WriteFile(file, []byte("x"), 0o644); err != nil {
		f.t.Fatal(err)
	}
	v, err := f.sources.Install(context.Background(), sources.Install{
		Kind: kind, SpeciesID: species, Origin: sources.OriginUpload, From: file, Artifact: artifact, Activate: true,
	})
	if err != nil {
		f.t.Fatal(err)
	}
	return v
}

type stepRow struct {
	Name     string
	State    enums.RunState
	Duration *int
}

func (f *fixture) steps(run db.ID) []stepRow {
	f.t.Helper()
	rows, err := db.All(context.Background(), f.env.DB, func(s db.Scanner) (stepRow, error) {
		var r stepRow
		return r, s.Scan(&r.Name, &r.State, &r.Duration)
	}, "SELECT name, state, duration_s FROM pipeline_run_step WHERE run_id = ? ORDER BY position", run)
	if err != nil {
		f.t.Fatal(err)
	}
	return rows
}

type speciesRow struct {
	Slug    string
	State   enums.RunState
	Records int
}

func (f *fixture) species(run db.ID) []speciesRow {
	f.t.Helper()
	rows, err := db.All(context.Background(), f.env.DB, func(s db.Scanner) (speciesRow, error) {
		var r speciesRow
		return r, s.Scan(&r.Slug, &r.State, &r.Records)
	}, `SELECT s.slug, p.state, p.record_count FROM pipeline_run_species p JOIN species s ON s.id = p.species_id
		WHERE p.run_id = ? ORDER BY s.name, s.id`, run)
	if err != nil {
		f.t.Fatal(err)
	}
	return rows
}

func (f *fixture) get(id db.ID) runs.Run {
	f.t.Helper()
	run, err := f.runs.Get(context.Background(), id)
	if err != nil {
		f.t.Fatal(err)
	}
	return run
}

// expectSteps compares the names and states of the steps of a run.
func (f *fixture) expectSteps(run db.ID, want ...string) {
	f.t.Helper()
	got := f.steps(run)
	names := make([]string, len(got))
	for i, s := range got {
		names[i] = s.Name + "=" + string(s.State)
	}
	if !slices.Equal(names, want) {
		f.t.Fatalf("steps = %v, want %v", names, want)
	}
}

func (f *fixture) logOf(id db.ID) string {
	f.t.Helper()
	run := f.get(id)
	if run.LogPath == nil {
		f.t.Fatal("the run has no log path")
	}
	data, err := os.ReadFile(*run.LogPath)
	if err != nil {
		f.t.Fatal(err)
	}
	return string(data)
}

// stubStages records the calls and fails or blocks where the test asks.
type stubStages struct {
	mu    sync.Mutex
	calls []string
	// fail names the calls that fail ("weather", "train:<slug>" …); panic names those that panic.
	fail  map[string]bool
	panic map[string]bool
	// block makes the weather stage wait until ctx ends.
	block   bool
	started chan struct{}
	brier   map[string]float64
	// chains keeps the chain of each trained species, by slug.
	chains map[string]sources.Chain
}

func (s *stubStages) call(name string) error {
	s.mu.Lock()
	s.calls = append(s.calls, name)
	s.mu.Unlock()
	if s.panic[name] {
		panic("stub " + name)
	}
	if s.fail[name] {
		return errors.New("stub failure " + name)
	}
	return nil
}

func (s *stubStages) Calls() []string {
	s.mu.Lock()
	defer s.mu.Unlock()
	return slices.Clone(s.calls)
}

func (s *stubStages) FetchWeather(_ context.Context, _ *runner.Job) error {
	return s.call("fetch weather")
}
func (s *stubStages) FetchOccurrences(_ context.Context, _ *runner.Job) error {
	return s.call("fetch occurrences")
}

func (s *stubStages) Weather(ctx context.Context, _ *runner.Job) error {
	if s.block {
		close(s.started)
		<-ctx.Done()
		return ctx.Err()
	}
	return s.call("weather")
}

func (s *stubStages) Occurrences(_ context.Context, _ *runner.Job) error {
	return s.call("occurrences")
}

func (s *stubStages) Train(_ context.Context, _ *runner.Job, sp runner.Species) (runner.Trained, error) {
	if sp.Chain != nil {
		s.mu.Lock()
		if s.chains == nil {
			s.chains = map[string]sources.Chain{}
		}
		s.chains[sp.Slug] = *sp.Chain
		s.mu.Unlock()
	}
	if err := s.call("train:" + sp.Slug); err != nil {
		return runner.Trained{}, err
	}
	out := runner.Trained{Records: len(sp.Slug) * 10}
	if b, ok := s.brier[sp.Slug]; ok {
		out.Brier = &b
	}
	return out, nil
}

func (s *stubStages) RenderSpecies(_ context.Context, _ *runner.Job, sp runner.Species) error {
	return s.call("maps:" + sp.Slug)
}
func (s *stubStages) RenderLayers(_ context.Context, _ *runner.Job) error { return s.call("layers") }
func (s *stubStages) Season(_ context.Context, _ *runner.Job) error       { return s.call("season") }

// slugs gives the slugs of the species rows of a run.
func slugs(rows []speciesRow) []string {
	out := make([]string, len(rows))
	for i, r := range rows {
		out[i] = r.Slug
	}
	return out
}

func prefixed(prefix string, names []string) []string {
	out := make([]string, len(names))
	for i, n := range names {
		out[i] = fmt.Sprintf("%s:%s", prefix, n)
	}
	return out
}

// dbKinds gives the kinds of the runs in queue order.
func dbKinds(f *fixture) ([]string, error) {
	return db.Column[string](context.Background(), f.env.DB, "SELECT kind FROM pipeline_run ORDER BY queued_at, rowid")
}

// mustClaimed gives the run that left the queue.
func mustClaimed(t *testing.T, f *fixture) db.ID {
	t.Helper()
	id, err := db.Scalar[db.ID](context.Background(), f.env.DB, "SELECT id FROM pipeline_run WHERE state != 'queued'")
	if err != nil {
		t.Fatal(err)
	}
	return id
}
