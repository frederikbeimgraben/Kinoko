package runner

import (
	"context"
	"errors"
	"fmt"
	"math"
	"os"
	"path/filepath"
	"runtime/debug"
	"time"

	"github.com/frederikbeimgraben/kinoko/backend/internal/core/db"
	"github.com/frederikbeimgraben/kinoko/backend/internal/core/enums"
	"github.com/frederikbeimgraben/kinoko/backend/internal/fn"
	"github.com/frederikbeimgraben/kinoko/backend/internal/modules/runs"
	"github.com/frederikbeimgraben/kinoko/backend/internal/modules/sources"
)

// speciesState is what the run knows of one species.
type speciesState struct {
	reported bool
	failed   bool
	records  int
}

// execution is one run in progress: the job, the species and the scores.
type execution struct {
	r       *Runner
	job     *Job
	species []Species
	states  map[db.ID]*speciesState
	briers  []float64
}

// execute runs the steps of a claimed run and finishes it. A failure of a
// step goes into the run state; the returned error is a failure to report.
func (r *Runner) execute(ctx context.Context, run runs.Run) (err error) {
	// The reports must reach the database also when ctx ends at a shutdown.
	report := context.WithoutCancel(ctx)
	logPath := runs.LogPath(r.logs, run.ID)
	logFile, err := openLog(logPath)
	if err != nil {
		return r.runs.Finish(report, run.ID, enums.RunStateFailed, "", nil)
	}
	defer func() { err = errors.Join(err, logFile.Close()) }()
	job := &Job{Run: run, Now: r.now(), log: logFile}
	x := &execution{r: r, job: job, states: map[db.ID]*speciesState{}}
	failed := x.prepare(report)
	if !failed {
		failed = x.steps(ctx, report, Plan(run.Kind, job.Request))
	}
	if err := x.closeSpecies(report, failed); err != nil {
		return err
	}
	state := runs.EndState(failed)
	job.Printf("run %s %s", run.Kind, state)
	return r.runs.Finish(report, run.ID, state, logPath, runs.MeanBrier(x.briers))
}

func openLog(path string) (*os.File, error) {
	if err := os.MkdirAll(filepath.Dir(path), 0o755); err != nil {
		return nil, err
	}
	return os.Create(path)
}

// prepare reads the species and the fetch request of the run. It tells if that failed.
func (x *execution) prepare(ctx context.Context) bool {
	species, err := x.r.speciesOf(ctx, x.job.Run.ID)
	if err == nil && x.job.Run.Kind == enums.RunKindFetch {
		var req sources.FetchRequest
		var found bool
		if req, found, err = x.r.sources.FetchRequestOf(ctx, x.job.Run.ID); found {
			x.job.Request = &req
		}
	}
	if err != nil {
		x.job.Printf("read the run: %v", err)
		return true
	}
	x.species, x.job.Species = species, species
	for _, sp := range species {
		x.states[sp.ID] = &speciesState{}
	}
	return false
}

// steps reports each step as queued, then runs them in order. A failed step
// that is not a species step stops the run; the steps after it fail.
func (x *execution) steps(ctx, report context.Context, plan []Step) bool {
	for i, s := range plan {
		if err := x.r.runs.ReportStep(report, x.job.Run.ID, i, string(s), enums.RunStateQueued, nil); err != nil {
			x.job.Printf("report step %s: %v", s, err)
		}
	}
	failed, stopped := false, false
	for i, s := range plan {
		if stopped {
			x.reportStep(report, i, s, enums.RunStateFailed, nil)
			continue
		}
		x.reportStep(report, i, s, enums.RunStateRunning, nil)
		x.job.Printf("step %s", s)
		start := time.Now()
		ok := x.step(ctx, report, s)
		seconds := int(math.Round(time.Since(start).Seconds()))
		x.reportStep(report, i, s, runs.EndState(!ok), &seconds)
		if !ok {
			failed = true
			stopped = !s.PerSpecies() || ctx.Err() != nil
		}
	}
	return failed
}

func (x *execution) reportStep(ctx context.Context, i int, s Step, state enums.RunState, seconds *int) {
	if err := x.r.runs.ReportStep(ctx, x.job.Run.ID, i, string(s), state, seconds); err != nil {
		x.job.Printf("report step %s: %v", s, err)
	}
}

// step runs one step. It tells if the step succeeded.
func (x *execution) step(ctx, report context.Context, s Step) bool {
	if s.PerSpecies() {
		return x.perSpecies(ctx, report, s)
	}
	err := guard(x.job, func() error { return x.single(ctx, s) })
	if err != nil {
		x.job.Printf("step %s failed: %v", s, err)
	}
	return err == nil
}

// single runs a step that is not a species step.
func (x *execution) single(ctx context.Context, s Step) error {
	st := x.r.stages
	switch s {
	case StepInputs:
		return x.inputs(ctx)
	case StepFetchWeather:
		return st.FetchWeather(ctx, x.job)
	case StepFetchOccurrences:
		return st.FetchOccurrences(ctx, x.job)
	case StepWeather:
		return st.Weather(ctx, x.job)
	case StepOccurrences:
		return st.Occurrences(ctx, x.job)
	case StepLayers:
		return st.RenderLayers(ctx, x.job)
	case StepSeason:
		return st.Season(ctx, x.job)
	}
	return fmt.Errorf("the service cannot run the step %q", s)
}

// inputs checks the preconditions of the run kind and records the provenance.
func (x *execution) inputs(ctx context.Context) error {
	kind := x.job.Run.Kind
	if err := x.r.checkInputs(ctx, kind); err != nil {
		return err
	}
	in, err := x.r.inputsOf(ctx, kind, x.species)
	if err != nil {
		return err
	}
	return x.r.writeInputs(ctx, x.job.Run.ID, in)
}

// perSpecies runs a species step for each species that did not fail before.
func (x *execution) perSpecies(ctx, report context.Context, s Step) bool {
	ok := true
	for _, sp := range x.species {
		state := x.states[sp.ID]
		if state.failed {
			continue
		}
		if ctx.Err() != nil {
			return false
		}
		x.reportSpecies(report, sp, state, enums.RunStateRunning)
		err := guard(x.job, func() error { return x.speciesStep(ctx, s, sp, state) })
		if err != nil {
			x.job.Printf("%s %s failed: %v", s, sp.Slug, err)
			state.failed, ok = true, false
		}
		x.reportSpecies(report, sp, state, runs.EndState(state.failed))
	}
	return ok
}

func (x *execution) speciesStep(ctx context.Context, s Step, sp Species, state *speciesState) error {
	if sp.Chain == nil {
		return fmt.Errorf("the species %s has no forecast chain in species_forecast", sp.Slug)
	}
	if s == StepMaps {
		return x.r.stages.RenderSpecies(ctx, x.job, sp)
	}
	trained, err := x.r.stages.Train(ctx, x.job, sp)
	if err != nil {
		return err
	}
	state.records = trained.Records
	if trained.Brier != nil {
		x.briers = append(x.briers, *trained.Brier)
	}
	return nil
}

func (x *execution) reportSpecies(ctx context.Context, sp Species, s *speciesState, state enums.RunState) {
	s.reported = true
	if err := x.r.runs.ReportSpecies(ctx, x.job.Run.ID, sp.ID, state, s.records); err != nil {
		x.job.Printf("report species %s: %v", sp.Slug, err)
	}
}

// closeSpecies gives each species that no species step reported the end
// state of the run, so that the progress of a fetch run or a stopped run ends.
func (x *execution) closeSpecies(ctx context.Context, failed bool) error {
	open := fn.Filter(x.species, func(sp Species) bool { return !x.states[sp.ID].reported })
	for _, sp := range open {
		if err := x.r.runs.ReportSpecies(ctx, x.job.Run.ID, sp.ID, runs.EndState(failed), 0); err != nil {
			return err
		}
	}
	return nil
}

// guard runs a stage and turns a panic into an error, so that one stage cannot stop the service.
func guard(j *Job, stage func() error) (err error) {
	defer func() {
		if value := recover(); value != nil {
			j.Printf("panic: %v\n%s", value, debug.Stack())
			err = fmt.Errorf("the stage stopped: %v", value)
		}
	}()
	return stage()
}
