package runs

import (
	"context"
	"database/sql"
	"time"

	"github.com/frederikbeimgraben/kinoko/backend/internal/core/db"
	"github.com/frederikbeimgraben/kinoko/backend/internal/core/enums"
	"github.com/frederikbeimgraben/kinoko/backend/internal/core/problem"
	"github.com/frederikbeimgraben/kinoko/backend/internal/fn"
)

// Run is one row of pipeline_run.
type Run struct {
	ID            db.ID
	Kind          enums.RunKind
	State         enums.RunState
	QueuedAt      db.Time
	StartedAt     *db.Time
	FinishedAt    *db.Time
	LogPath       *string
	MetricBrier   *float64
	ProgressDone  int
	ProgressTotal int
	TriggeredByID *db.ID
}

const runCols = `id, kind, state, queued_at, started_at, finished_at, log_path,
	metric_brier, progress_done, progress_total, triggered_by_id`

func scanRun(s db.Scanner) (Run, error) {
	var r Run
	err := s.Scan(&r.ID, &r.Kind, &r.State, &r.QueuedAt, &r.StartedAt, &r.FinishedAt, &r.LogPath,
		&r.MetricBrier, &r.ProgressDone, &r.ProgressTotal, &r.TriggeredByID)
	return r, err
}

// TrainingFind is a find that the chain uses as training input.
type TrainingFind struct {
	ID        db.ID   `json:"id"`
	SpeciesID db.ID   `json:"speciesId"`
	Lat       float64 `json:"lat"`
	Lon       float64 `json:"lon"`
	FoundOn   db.Date `json:"foundOn"`
	Count     *int    `json:"count"`
}

func scanTrainingFind(s db.Scanner) (TrainingFind, error) {
	var f TrainingFind
	err := s.Scan(&f.ID, &f.SpeciesID, &f.Lat, &f.Lon, &f.FoundOn, &f.Count)
	return f, err
}

// Target is a species with forecast that a run computes.
type Target struct {
	ID        db.ID
	Name      string
	LatinName string
}

// done are the species states that count as progress.
var done = []enums.RunState{enums.RunStateFinished, enums.RunStateFailed}

// Store keeps the queue and the state of the pipeline runs. The HTTP
// endpoints and the pipeline in the same process share one Store.
type Store struct {
	handle *sql.DB
	now    func() time.Time
	wake   chan struct{}
}

// NewStore makes a store on the database. The clock gives the time stamps.
func NewStore(handle *sql.DB, now func() time.Time) *Store {
	return &Store{handle: handle, now: now, wake: make(chan struct{}, 1)}
}

// Wake gives a channel that receives a value when a run is queued.
// Many signals before one receive merge into one value.
func (s *Store) Wake() <-chan struct{} { return s.wake }

func (s *Store) signal() {
	select {
	case s.wake <- struct{}{}:
	default:
	}
}

func (s *Store) stamp() db.Time { return db.At(s.now()) }

// Queue adds a run with one queued species row for each species with forecast.
func (s *Store) Queue(ctx context.Context, kind enums.RunKind, by db.ID) (Run, error) {
	return s.queue(ctx, kind, &by)
}

// QueueScheduled adds a run that no person started, for example a run of the weekly schedule.
func (s *Store) QueueScheduled(ctx context.Context, kind enums.RunKind) (Run, error) {
	return s.queue(ctx, kind, nil)
}

func (s *Store) queue(ctx context.Context, kind enums.RunKind, by *db.ID) (Run, error) {
	run, err := db.InTxValue(ctx, s.handle, func(tx *sql.Tx) (Run, error) {
		species, err := db.Column[db.ID](ctx, tx, "SELECT id FROM species WHERE forecast_enabled = 1")
		if err != nil {
			return Run{}, err
		}
		run := Run{
			ID:            db.NewID(),
			Kind:          kind,
			State:         enums.RunStateQueued,
			QueuedAt:      s.stamp(),
			ProgressTotal: len(species),
			TriggeredByID: by,
		}
		if _, err := tx.ExecContext(ctx, `INSERT INTO pipeline_run (`+runCols+`)
			VALUES (?, ?, ?, ?, NULL, NULL, NULL, NULL, 0, ?, ?)`,
			run.ID, run.Kind, run.State, run.QueuedAt, run.ProgressTotal, run.TriggeredByID); err != nil {
			return Run{}, err
		}
		for _, id := range species {
			if _, err := tx.ExecContext(ctx, `INSERT INTO pipeline_run_species
				(run_id, species_id, state, record_count, find_count) VALUES (?, ?, ?, 0, 0)`,
				run.ID, id, enums.RunStateQueued); err != nil {
				return Run{}, err
			}
		}
		return run, nil
	})
	if err == nil {
		s.signal()
	}
	return run, err
}

// Get reads one run. An unknown run gives problem.NotFound.
func (s *Store) Get(ctx context.Context, id db.ID) (Run, error) {
	return getRun(ctx, s.handle, id)
}

func getRun(ctx context.Context, q db.Querier, id db.ID) (Run, error) {
	return db.One(ctx, q, scanRun, "SELECT "+runCols+" FROM pipeline_run WHERE id = ?", id)
}

// Claim takes the oldest queued run and sets it to running. It also keeps
// the training finds as the input of the run and counts them per species.
// The bool is false when no run waits.
func (s *Store) Claim(ctx context.Context) (Run, bool, error) {
	claimed, err := db.InTxValue(ctx, s.handle, func(tx *sql.Tx) (*Run, error) {
		// The insert order breaks a tie of queued_at, so a fetch queued before a render runs first.
		id, found, err := db.Maybe(ctx, tx, func(sc db.Scanner) (db.ID, error) {
			var id db.ID
			return id, sc.Scan(&id)
		}, "SELECT id FROM pipeline_run WHERE state = ? ORDER BY queued_at, rowid LIMIT 1", enums.RunStateQueued)
		if err != nil || !found {
			return nil, err
		}
		taken, err := db.Exec(ctx, tx, `UPDATE pipeline_run SET state = ?, started_at = ?
			WHERE id = ? AND state = ?`, enums.RunStateRunning, s.stamp(), id, enums.RunStateQueued)
		if err != nil || taken != 1 {
			return nil, err
		}
		if err := link(ctx, tx, id); err != nil {
			return nil, err
		}
		run, err := getRun(ctx, tx, id)
		return &run, err
	})
	if err != nil || claimed == nil {
		return Run{}, false, err
	}
	return *claimed, true, nil
}

// link writes the input finds of a run and the find count of each species row.
func link(ctx context.Context, tx *sql.Tx, run db.ID) error {
	finds, err := trainingFinds(ctx, tx)
	if err != nil {
		return err
	}
	for _, f := range finds {
		if _, err := tx.ExecContext(ctx,
			"INSERT INTO pipeline_run_find (run_id, find_id) VALUES (?, ?)", run, f.ID); err != nil {
			return err
		}
	}
	counted := fn.GroupBy(finds, func(f TrainingFind) db.ID { return f.SpeciesID })
	for species, rows := range counted {
		if _, err := tx.ExecContext(ctx, `UPDATE pipeline_run_species SET find_count = ?
			WHERE run_id = ? AND species_id = ?`, len(rows), run, species); err != nil {
			return err
		}
	}
	return nil
}

// TrainingFinds gives the accepted training finds of the species with forecast.
func (s *Store) TrainingFinds(ctx context.Context) ([]TrainingFind, error) {
	return trainingFinds(ctx, s.handle)
}

func trainingFinds(ctx context.Context, q db.Querier) ([]TrainingFind, error) {
	return db.All(ctx, q, scanTrainingFind, `
		SELECT find.id, find.species_id, find.lat, find.lon, find.found_on, find.count
		FROM find JOIN species ON species.id = find.species_id
		WHERE find.for_training = 1 AND find.review_state = 'accepted'
			AND find.deleted_at IS NULL AND species.forecast_enabled = 1`)
}

// Targets gives the species with forecast, by name. The pipeline computes these.
func (s *Store) Targets(ctx context.Context) ([]Target, error) {
	return db.All(ctx, s.handle, func(sc db.Scanner) (Target, error) {
		var t Target
		return t, sc.Scan(&t.ID, &t.Name, &t.LatinName)
	}, "SELECT id, name, latin_name FROM species WHERE forecast_enabled = 1 ORDER BY name, id")
}

// ReportSpecies writes the state and the record count of one species in a
// run. Then it sets the progress to the count of finished or failed species.
func (s *Store) ReportSpecies(ctx context.Context, runID, speciesID db.ID, state enums.RunState, records int) error {
	return db.InTx(ctx, s.handle, func(tx *sql.Tx) error {
		if _, err := getRun(ctx, tx, runID); err != nil {
			return err
		}
		if !state.Valid() {
			return problem.InvalidField("state", "enum")
		}
		if _, err := tx.ExecContext(ctx, `INSERT INTO pipeline_run_species
			(run_id, species_id, state, record_count, find_count) VALUES (?, ?, ?, ?, 0)
			ON CONFLICT (run_id, species_id) DO UPDATE
			SET state = excluded.state, record_count = excluded.record_count`,
			runID, speciesID, state, records); err != nil {
			return err
		}
		_, err := tx.ExecContext(ctx, `UPDATE pipeline_run SET progress_done = (
				SELECT count(*) FROM pipeline_run_species
				WHERE run_id = ? AND state IN (`+db.Placeholders(len(done))+`))
			WHERE id = ?`, append(append([]any{runID}, db.Args(done)...), runID)...)
		return err
	})
}

// ReportStep writes the name, state and duration in seconds of one step.
// A nil duration means that the step has no duration yet.
func (s *Store) ReportStep(ctx context.Context, runID db.ID, position int, name string, state enums.RunState, duration *int) error {
	return db.InTx(ctx, s.handle, func(tx *sql.Tx) error {
		if _, err := getRun(ctx, tx, runID); err != nil {
			return err
		}
		if !state.Valid() {
			return problem.InvalidField("state", "enum")
		}
		_, err := tx.ExecContext(ctx, `INSERT INTO pipeline_run_step
			(run_id, position, name, state, duration_s) VALUES (?, ?, ?, ?, ?)
			ON CONFLICT (run_id, position) DO UPDATE
			SET name = excluded.name, state = excluded.state, duration_s = excluded.duration_s`,
			runID, position, name, state, duration)
		return err
	})
}

// Finish sets the end state and the end time of a run. An empty log path
// and a nil Brier score keep the values that the run has.
func (s *Store) Finish(ctx context.Context, runID db.ID, state enums.RunState, logPath string, brier *float64) error {
	return db.InTx(ctx, s.handle, func(tx *sql.Tx) error {
		if _, err := getRun(ctx, tx, runID); err != nil {
			return err
		}
		if !state.Valid() {
			return problem.InvalidField("state", "enum")
		}
		var path *string
		if logPath != "" {
			path = &logPath
		}
		_, err := tx.ExecContext(ctx, `UPDATE pipeline_run SET state = ?, finished_at = ?,
			log_path = COALESCE(?, log_path), metric_brier = COALESCE(?, metric_brier)
			WHERE id = ?`, state, s.stamp(), path, brier, runID)
		return err
	})
}

// FailStale sets each running run to failed. Only a stopped process leaves
// a run in that state, because the pipeline runs in the process.
func (s *Store) FailStale(ctx context.Context) (int64, error) {
	return db.Exec(ctx, s.handle, `UPDATE pipeline_run SET state = ?, finished_at = ? WHERE state = ?`,
		enums.RunStateFailed, s.stamp(), enums.RunStateRunning)
}

// Waiting tells if a queued run exists.
func (s *Store) Waiting(ctx context.Context) (bool, error) {
	n, err := db.Scalar[int](ctx, s.handle, "SELECT count(*) FROM pipeline_run WHERE state = ?", enums.RunStateQueued)
	return n > 0, err
}

// listRuns reads one page of runs, the newest first.
func listRuns(ctx context.Context, q db.Querier, limit, offset int) ([]Run, error) {
	return db.All(ctx, q, scanRun, "SELECT "+runCols+
		" FROM pipeline_run ORDER BY queued_at DESC LIMIT ? OFFSET ?", limit, offset)
}
