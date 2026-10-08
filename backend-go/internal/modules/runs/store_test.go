package runs_test

import (
	"errors"
	"net/http"
	"sync"
	"testing"

	"github.com/frederikbeimgraben/kinoko/backend/internal/core/db"
	"github.com/frederikbeimgraben/kinoko/backend/internal/core/enums"
	"github.com/frederikbeimgraben/kinoko/backend/internal/core/problem"
	"github.com/frederikbeimgraben/kinoko/backend/internal/modules/runs"
)

func TestQueueSetsProgressTotalFromForecastSpecies(t *testing.T) {
	f := newFixture(t)
	user := f.user("person")
	f.species("a", true)
	f.species("b", true)
	f.species("c", false)
	run := f.queue(enums.RunKindTraining, user)
	if run.State != enums.RunStateQueued || run.ProgressTotal != 2 {
		t.Fatalf("%+v", run)
	}
	if run.TriggeredByID == nil || *run.TriggeredByID != user {
		t.Fatalf("triggered by %v", run.TriggeredByID)
	}
	stored := f.get(run.ID)
	if stored.ProgressTotal != 2 || stored.ProgressDone != 0 || stored.QueuedAt != run.QueuedAt {
		t.Fatalf("%+v", stored)
	}
}

func TestQueueWritesARowForEveryForecastSpecies(t *testing.T) {
	f := newFixture(t)
	user := f.user("person")
	f.species("a", true)
	f.species("b", true)
	f.species("c", false)
	run := f.queue(enums.RunKindTraining, user)
	if n := f.count("SELECT count(*) FROM pipeline_run_species WHERE run_id = ?", run.ID); n != 2 {
		t.Fatalf("rows %d", n)
	}
	if n := f.count("SELECT count(*) FROM pipeline_run_species WHERE run_id = ? AND state <> 'queued'", run.ID); n != 0 {
		t.Fatalf("not queued %d", n)
	}
}

func TestQueueSignalsWake(t *testing.T) {
	f := newFixture(t)
	f.queue(enums.RunKindTraining, f.user("person"))
	f.queue(enums.RunKindRender, f.user("other"))
	select {
	case <-f.store.Wake():
	default:
		t.Fatal("no signal")
	}
	select {
	case <-f.store.Wake():
		t.Fatal("signals do not merge")
	default:
	}
}

func TestClaimTakesTheOldestQueuedRun(t *testing.T) {
	f := newFixture(t)
	user := f.user("person")
	first := f.queue(enums.RunKindTraining, user)
	f.queue(enums.RunKindRender, user)
	claimed, ok, err := f.store.Claim(f.ctx)
	must(t, err)
	if !ok || claimed.ID != first.ID || claimed.State != enums.RunStateRunning || claimed.StartedAt == nil {
		t.Fatalf("%v %+v", ok, claimed)
	}
}

func TestClaimReturnsNoneWithoutAQueuedRun(t *testing.T) {
	f := newFixture(t)
	_, ok, err := f.store.Claim(f.ctx)
	must(t, err)
	if ok {
		t.Fatal("claimed a run")
	}
}

func TestClaimHoldsTheInputFindsAndCountsThem(t *testing.T) {
	f := newFixture(t)
	user := f.user("person")
	target := f.species("a", true)
	for _, day := range []int{1, 2} {
		f.find(user, findSpec{species: &target, training: true, review: enums.ReviewStateAccepted, day: day})
	}
	run := f.queue(enums.RunKindTraining, user)
	_, ok, err := f.store.Claim(f.ctx)
	must(t, err)
	if !ok {
		t.Fatal("no run")
	}
	if n := f.count("SELECT count(*) FROM pipeline_run_find WHERE run_id = ?", run.ID); n != 2 {
		t.Fatalf("linked %d", n)
	}
	if n := f.count("SELECT find_count FROM pipeline_run_species WHERE run_id = ? AND species_id = ?", run.ID, target); n != 2 {
		t.Fatalf("find count %d", n)
	}
}

func TestTwoClaimsNeverTakeTheSameRun(t *testing.T) {
	f := newFixture(t)
	user := f.user("person")
	f.queue(enums.RunKindTraining, user)
	f.queue(enums.RunKindRender, user)
	var wg sync.WaitGroup
	taken := make([]runs.Run, 2)
	failures := make([]error, 2)
	for i := range 2 {
		wg.Go(func() {
			run, ok, err := f.store.Claim(f.ctx)
			if err == nil && !ok {
				err = errors.New("no run")
			}
			taken[i], failures[i] = run, err
		})
	}
	wg.Wait()
	must(t, errors.Join(failures...))
	if taken[0].ID == taken[1].ID {
		t.Fatal("same run twice")
	}
}

func TestFinishSetsStateAndLogPath(t *testing.T) {
	f := newFixture(t)
	run := f.queue(enums.RunKindFull, f.user("person"))
	must(t, f.store.Finish(f.ctx, run.ID, enums.RunStateFinished, "/var/log/run.log", nil))
	got := f.get(run.ID)
	if got.State != enums.RunStateFinished || got.FinishedAt == nil || got.LogPath == nil || *got.LogPath != "/var/log/run.log" {
		t.Fatalf("%+v", got)
	}
}

func TestFinishWithoutALogPathKeepsTheExistingOne(t *testing.T) {
	f := newFixture(t)
	run := f.queue(enums.RunKindFull, f.user("person"))
	must(t, f.store.Finish(f.ctx, run.ID, enums.RunStateFinished, "/var/log/run.log", nil))
	must(t, f.store.Finish(f.ctx, run.ID, enums.RunStateFailed, "", nil))
	got := f.get(run.ID)
	if got.State != enums.RunStateFailed || *got.LogPath != "/var/log/run.log" {
		t.Fatalf("%+v", got)
	}
}

func TestFinishSetsTheBrierScore(t *testing.T) {
	f := newFixture(t)
	run := f.queue(enums.RunKindTraining, f.user("person"))
	must(t, f.store.Finish(f.ctx, run.ID, enums.RunStateFinished, "", ptr(0.1234)))
	if got := f.get(run.ID); got.MetricBrier == nil || *got.MetricBrier != 0.1234 {
		t.Fatalf("%+v", got)
	}
}

func TestFinishWithoutABrierScoreKeepsTheExistingOne(t *testing.T) {
	f := newFixture(t)
	run := f.queue(enums.RunKindTraining, f.user("person"))
	must(t, f.store.Finish(f.ctx, run.ID, enums.RunStateFinished, "", ptr(0.5)))
	must(t, f.store.Finish(f.ctx, run.ID, enums.RunStateFinished, "", nil))
	if got := f.get(run.ID); got.MetricBrier == nil || *got.MetricBrier != 0.5 {
		t.Fatalf("%+v", got)
	}
}

func TestReportWritesSpeciesStateAndAdvancesProgress(t *testing.T) {
	f := newFixture(t)
	user := f.user("person")
	a, b := f.species("a", true), f.species("b", true)
	run := f.queue(enums.RunKindTraining, user)
	must(t, f.store.ReportSpecies(f.ctx, run.ID, a, enums.RunStateFinished, 12))
	if got := f.get(run.ID).ProgressDone; got != 1 {
		t.Fatalf("progress %d", got)
	}
	must(t, f.store.ReportSpecies(f.ctx, run.ID, a, enums.RunStateFinished, 20))
	must(t, f.store.ReportSpecies(f.ctx, run.ID, b, enums.RunStateFinished, 5))
	if got := f.get(run.ID).ProgressDone; got != 2 {
		t.Fatalf("progress %d", got)
	}
	if n := f.count("SELECT record_count FROM pipeline_run_species WHERE run_id = ? AND species_id = ?", run.ID, a); n != 20 {
		t.Fatalf("records %d", n)
	}
}

func TestProgressCountsOnlyFinishedSpecies(t *testing.T) {
	f := newFixture(t)
	user := f.user("person")
	a, b := f.species("a", true), f.species("b", true)
	run := f.queue(enums.RunKindTraining, user)
	steps := []struct {
		species db.ID
		state   enums.RunState
		records int
		want    int
	}{
		{a, enums.RunStateRunning, 0, 0},
		{a, enums.RunStateFinished, 9, 1},
		{b, enums.RunStateFailed, 0, 2},
	}
	for _, step := range steps {
		must(t, f.store.ReportSpecies(f.ctx, run.ID, step.species, step.state, step.records))
		if got := f.get(run.ID).ProgressDone; got != step.want {
			t.Fatalf("after %s: progress %d, expected %d", step.state, got, step.want)
		}
	}
}

func TestReportAddsARowForASpeciesWithoutOne(t *testing.T) {
	f := newFixture(t)
	run := f.queue(enums.RunKindTraining, f.user("person"))
	late := f.species("late", true)
	must(t, f.store.ReportSpecies(f.ctx, run.ID, late, enums.RunStateFinished, 3))
	if got := f.get(run.ID).ProgressDone; got != 1 {
		t.Fatalf("progress %d", got)
	}
}

func TestReportWithAnUnknownStateIsRejected(t *testing.T) {
	f := newFixture(t)
	a := f.species("a", true)
	run := f.queue(enums.RunKindTraining, f.user("person"))
	err := f.store.ReportSpecies(f.ctx, run.ID, a, enums.RunState("unsinn"), 1)
	expectProblem(t, err, http.StatusUnprocessableEntity)
	if got := problem.From(err).Errors; len(got) != 1 || got[0].Field != "state" || got[0].Code != "enum" {
		t.Fatalf("%+v", got)
	}
}

func TestReportsAreNotFoundForAnUnknownRun(t *testing.T) {
	f := newFixture(t)
	unknown := db.NewID()
	expectProblem(t, f.store.ReportSpecies(f.ctx, unknown, db.NewID(), enums.RunStateFinished, 1), http.StatusNotFound)
	expectProblem(t, f.store.ReportStep(f.ctx, unknown, 0, "run_all.sh", enums.RunStateRunning, nil), http.StatusNotFound)
	expectProblem(t, f.store.Finish(f.ctx, unknown, enums.RunStateFinished, "", nil), http.StatusNotFound)
}

func TestReportStepWritesANewStep(t *testing.T) {
	f := newFixture(t)
	run := f.queue(enums.RunKindTraining, f.user("person"))
	must(t, f.store.ReportStep(f.ctx, run.ID, 0, "run_all.sh", enums.RunStateRunning, nil))
	if n := f.count(`SELECT count(*) FROM pipeline_run_step WHERE run_id = ? AND position = 0
		AND name = 'run_all.sh' AND state = 'running' AND duration_s IS NULL`, run.ID); n != 1 {
		t.Fatal("no step")
	}
}

func TestReportStepUpdatesAnExistingStep(t *testing.T) {
	f := newFixture(t)
	run := f.queue(enums.RunKindTraining, f.user("person"))
	must(t, f.store.ReportStep(f.ctx, run.ID, 0, "run_all.sh", enums.RunStateRunning, nil))
	must(t, f.store.ReportStep(f.ctx, run.ID, 0, "run_all.sh", enums.RunStateFinished, ptr(42)))
	if n := f.count(`SELECT count(*) FROM pipeline_run_step WHERE run_id = ? AND position = 0
		AND state = 'finished' AND duration_s = 42`, run.ID); n != 1 {
		t.Fatal("step not updated")
	}
}

func TestTrainingFindsFiltersForAcceptedSpeciesFinds(t *testing.T) {
	f := newFixture(t)
	user := f.user("person")
	target := f.species("a", true)
	good := f.find(user, findSpec{species: &target, training: true, review: enums.ReviewStateAccepted})
	f.find(user, findSpec{species: &target, training: false, review: enums.ReviewStateAccepted})
	f.find(user, findSpec{species: &target, training: true, review: enums.ReviewStateOpen})
	f.find(user, findSpec{training: true, review: enums.ReviewStateAccepted})
	f.find(user, findSpec{species: &target, training: true, review: enums.ReviewStateAccepted, deleted: true})
	found, err := f.store.TrainingFinds(f.ctx)
	must(t, err)
	if len(found) != 1 || found[0].ID != good || found[0].SpeciesID != target {
		t.Fatalf("%+v", found)
	}
}

func TestTrainingFindsSkipsSpeciesWithoutForecast(t *testing.T) {
	f := newFixture(t)
	user := f.user("person")
	quiet := f.species("b", false)
	f.find(user, findSpec{species: &quiet, training: true, review: enums.ReviewStateAccepted})
	found, err := f.store.TrainingFinds(f.ctx)
	must(t, err)
	if len(found) != 0 {
		t.Fatalf("%+v", found)
	}
}

func TestTargetsAreTheForecastSpecies(t *testing.T) {
	f := newFixture(t)
	b := f.species("b", true)
	a := f.species("a", true)
	f.species("c", false)
	found, err := f.store.Targets(f.ctx)
	must(t, err)
	if len(found) != 2 || found[0].ID != a || found[1].ID != b || found[0].LatinName != "Latinus a" {
		t.Fatalf("%+v", found)
	}
}

func TestStartSetsStaleRunsToFailedAndSignalsWaitingRuns(t *testing.T) {
	f := newFixture(t)
	user := f.user("person")
	stale := f.queue(enums.RunKindTraining, user)
	_, _, err := f.store.Claim(f.ctx)
	must(t, err)
	waiting := f.queue(enums.RunKindRender, user)
	module := f.module()
	must(t, module.Start(f.ctx))
	if got := f.get(stale.ID); got.State != enums.RunStateFailed || got.FinishedAt == nil {
		t.Fatalf("%+v", got)
	}
	if got := f.get(waiting.ID); got.State != enums.RunStateQueued {
		t.Fatalf("%+v", got)
	}
	select {
	case <-module.Store().Wake():
	default:
		t.Fatal("no signal for the waiting run")
	}
}

func expectProblem(t *testing.T, err error, status int) {
	t.Helper()
	var p *problem.Problem
	if !errors.As(err, &p) || p.Status != status {
		t.Fatalf("expected problem %d, got %v", status, err)
	}
}
