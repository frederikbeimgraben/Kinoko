// Package runner executes the runs of the forecast pipeline in the process.
// It takes the queued runs of the runs module one at a time, checks their
// inputs, records the provenance, executes the steps of the run kind and
// reports the state of each step and species. A weekly schedule queues a
// fetch run and a render run.
package runner

import (
	"context"
	"database/sql"
	"log/slog"
	"net/http"
	"sync"
	"time"

	"github.com/frederikbeimgraben/kinoko/backend/internal/core/db"
	"github.com/frederikbeimgraben/kinoko/backend/internal/core/enums"
	"github.com/frederikbeimgraben/kinoko/backend/internal/modules/runs"
	"github.com/frederikbeimgraben/kinoko/backend/internal/modules/sources"
	"github.com/frederikbeimgraben/kinoko/backend/internal/server"
)

// poll is the interval of the queue check when no signal comes.
const poll = time.Minute

// lockPoll is the interval of the attempts to get sources.JobLock.
const lockPoll = 200 * time.Millisecond

// Config holds what the runner needs. A nil Stages uses a Chain.
type Config struct {
	DB      *sql.DB
	Runs    *runs.Store
	Sources *sources.Module
	Stages  Stages
	// Logs is the folder of the run logs (setting PILZE_RUN_LOGS).
	Logs string
	// Enabled starts the loop and the schedule (setting PILZE_PIPELINE).
	Enabled bool
	// Schedule is the weekly start in the form of ParseSchedule. Empty means no schedule.
	Schedule string
	Now      func() time.Time
	Log      *slog.Logger
}

// Runner executes the pipeline runs. It is a server.Module without endpoints:
// the runs module owns /pipeline-runs.
type Runner struct {
	db       *sql.DB
	runs     *runs.Store
	sources  *sources.Module
	stages   Stages
	logs     string
	enabled  bool
	schedule string
	now      func() time.Time
	log      *slog.Logger
	work     sync.WaitGroup
}

// New makes a runner.
func New(cfg Config) *Runner {
	now := cfg.Now
	if now == nil {
		now = time.Now
	}
	log := cfg.Log
	if log == nil {
		log = slog.Default()
	}
	return &Runner{db: cfg.DB, runs: cfg.Runs, sources: cfg.Sources, stages: cfg.Stages, logs: cfg.Logs,
		enabled: cfg.Enabled, schedule: cfg.Schedule, now: now, log: log}
}

// FromDeps makes the runner of the service: a Chain on the data folder of
// the sources module and the maps folder of the settings.
func FromDeps(deps server.Deps, store *runs.Store, src *sources.Module) *Runner {
	chain := &Chain{
		DB: deps.DB, Sources: src, Data: src.Root(), Maps: deps.Settings.Maps,
		HTTP: &http.Client{}, Now: deps.Now, Renderer: NewMaps(),
	}
	return New(Config{
		DB: deps.DB, Runs: store, Sources: src, Stages: chain, Logs: deps.Settings.RunLogs,
		Enabled: deps.Settings.PipelineEnable, Schedule: deps.Settings.Schedule, Now: deps.Now, Log: deps.Log,
	})
}

// Routes adds no endpoint.
func (r *Runner) Routes(*server.Router) {}

// Start starts the loop and the weekly schedule when the pipeline is on.
// The runs module sets the runs of a stopped process to failed before.
func (r *Runner) Start(ctx context.Context) error {
	if !r.enabled {
		return nil
	}
	var plan *Schedule
	if r.schedule != "" {
		parsed, err := ParseSchedule(r.schedule)
		if err != nil {
			return err
		}
		plan = &parsed
	}
	r.work.Add(1)
	go func() {
		defer r.work.Done()
		r.Loop(ctx)
	}()
	if plan != nil {
		r.work.Add(1)
		go func() {
			defer r.work.Done()
			r.Scheduled(ctx, *plan, timerAfter)
		}()
	}
	return nil
}

// Wait blocks until the loop and the schedule stop. They stop with the context of Start.
func (r *Runner) Wait() { r.work.Wait() }

// Loop executes the queued runs one after the other until ctx ends.
func (r *Runner) Loop(ctx context.Context) {
	for {
		for {
			ran, err := r.RunNext(ctx)
			if err != nil && ctx.Err() == nil {
				r.log.Error("pipeline run", "error", err)
			}
			if err != nil || !ran {
				break
			}
		}
		select {
		case <-ctx.Done():
			return
		case <-r.runs.Wake():
		case <-time.After(poll):
		}
	}
}

// RunNext takes the oldest queued run and executes it. The bool is false
// when no run waits. The run holds sources.JobLock, so it never overlaps the
// processing of a data source version; the run stays queued while it waits.
func (r *Runner) RunNext(ctx context.Context) (bool, error) {
	if err := lock(ctx, &sources.JobLock); err != nil {
		return false, err
	}
	defer sources.JobLock.Unlock()
	run, found, err := r.runs.Claim(ctx)
	if err != nil || !found {
		return false, err
	}
	return true, r.execute(ctx, run)
}

// lock gets the mutex or stops when ctx ends.
func lock(ctx context.Context, mu *sync.Mutex) error {
	for !mu.TryLock() {
		select {
		case <-ctx.Done():
			return ctx.Err()
		case <-time.After(lockPoll):
		}
	}
	return nil
}

// timerAfter waits on a real timer.
func timerAfter(d time.Duration) <-chan time.Time { return time.After(d) }

// Scheduled queues a fetch run and a render run at each start time of the
// schedule until ctx ends. A run of a kind that already waits is not queued again.
func (r *Runner) Scheduled(ctx context.Context, plan Schedule, after func(time.Duration) <-chan time.Time) {
	for {
		next := plan.Next(r.now())
		select {
		case <-ctx.Done():
			return
		case <-after(next.Sub(r.now())):
		}
		if err := r.QueueWeekly(ctx); err != nil && ctx.Err() == nil {
			r.log.Error("queue the weekly runs", "error", err)
		}
	}
}

// weeklyKinds are the run kinds of the weekly schedule, in queue order.
var weeklyKinds = []enums.RunKind{enums.RunKindFetch, enums.RunKindRender}

// QueueWeekly queues the runs of the weekly schedule.
func (r *Runner) QueueWeekly(ctx context.Context) error {
	for _, kind := range weeklyKinds {
		waiting, err := db.Scalar[int](ctx, r.db, "SELECT count(*) FROM pipeline_run WHERE kind = ? AND state = ?",
			kind, enums.RunStateQueued)
		if err != nil {
			return err
		}
		if waiting > 0 {
			continue
		}
		if _, err := r.runs.QueueScheduled(ctx, kind); err != nil {
			return err
		}
	}
	return nil
}
