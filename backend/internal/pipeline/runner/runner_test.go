package runner_test

import (
	"context"
	"math"
	"slices"
	"strings"
	"testing"
	"time"

	"github.com/frederikbeimgraben/kinoko/backend/internal/core/db"
	"github.com/frederikbeimgraben/kinoko/backend/internal/core/enums"
	"github.com/frederikbeimgraben/kinoko/backend/internal/modules/sources"
	"github.com/frederikbeimgraben/kinoko/backend/internal/testkit"
)

func TestFetchRunReportsEachStepAndEndsEachSpecies(t *testing.T) {
	f := newFixture(t, 2)
	run := f.queue(enums.RunKindFetch)
	f.runNext()
	got := f.get(run.ID)
	if got.State != enums.RunStateFinished || got.FinishedAt == nil || got.ProgressDone != 2 || got.MetricBrier != nil {
		t.Fatalf("run = %+v", got)
	}
	f.expectSteps(run.ID, "check inputs=finished", "fetch weather=finished", "fetch occurrences=finished")
	for _, s := range f.steps(run.ID) {
		if s.Duration == nil {
			t.Errorf("step %s has no duration", s.Name)
		}
	}
	for _, sp := range f.species(run.ID) {
		if sp.State != enums.RunStateFinished {
			t.Errorf("species %s is %s", sp.Slug, sp.State)
		}
	}
	if calls := f.stages.Calls(); !slices.Equal(calls, []string{"fetch weather", "fetch occurrences"}) {
		t.Errorf("calls = %v", calls)
	}
	if log := f.logOf(run.ID); !strings.Contains(log, "run fetch finished") {
		t.Errorf("log = %q", log)
	}
}

func TestFetchRunOfOneSourceRunsOnlyItsStep(t *testing.T) {
	f := newFixture(t, 1)
	run := f.queue(enums.RunKindFetch)
	f.exec("INSERT INTO remote_fetch_request (run_id, source, from_year, to_year, force) VALUES (?, 'gbif-occurrences', 2024, 2025, 1)", run.ID)
	f.runNext()
	f.expectSteps(run.ID, "check inputs=finished", "fetch occurrences=finished")
}

func TestFetchOfASourceWithoutFetcherFails(t *testing.T) {
	f := newFixture(t, 1)
	run := f.queue(enums.RunKindFetch)
	f.exec("INSERT INTO remote_fetch_request (run_id, source, force) VALUES (?, 'retired-source', 0)", run.ID)
	f.runNext()
	f.expectSteps(run.ID, "check inputs=finished", "fetch retired-source=failed")
	if got := f.get(run.ID); got.State != enums.RunStateFailed {
		t.Fatalf("state = %s", got.State)
	}
}

func TestMissingInputsFailTheRunFast(t *testing.T) {
	f := newFixture(t, 2)
	run := f.queue(enums.RunKindTraining)
	f.runNext()
	if got := f.get(run.ID); got.State != enums.RunStateFailed || got.ProgressDone != 2 {
		t.Fatalf("run = %+v", got)
	}
	f.expectSteps(run.ID, "check inputs=failed", "weather checkpoints=failed", "occurrences=failed", "train models=failed")
	if calls := f.stages.Calls(); len(calls) != 0 {
		t.Errorf("stages ran: %v", calls)
	}
	if log := f.logOf(run.ID); !strings.Contains(log, "inputs_missing: tree-scales") {
		t.Errorf("log = %q", log)
	}
	for _, sp := range f.species(run.ID) {
		if sp.State != enums.RunStateFailed {
			t.Errorf("species %s is %s", sp.Slug, sp.State)
		}
	}
}

func TestTrainingRunWritesProvenanceRecordsAndTheMeanBrier(t *testing.T) {
	f := newFixture(t, 2)
	scales := f.install(sources.KindTreeScales, "tree_scales", nil)
	f.exec(`INSERT INTO remote_cache_file (source, "key", url, size_bytes, fetched_at, checked_at, state)
		VALUES ('dwd-hyras', 'dwd/hyras/precipitation/pr_hyras_1_2026_v6-0_de.nc', 'u', 3,
		'2026-10-05 01:00:00.000000', '2026-10-05 01:00:00.000000', 'ok')`)
	run := f.queue(enums.RunKindTraining)
	species := slugs(f.species(run.ID))
	f.stages.brier = map[string]float64{species[0]: 0.1, species[1]: 0.2}
	f.runNext()
	got := f.get(run.ID)
	if got.State != enums.RunStateFinished || got.MetricBrier == nil || math.Abs(*got.MetricBrier-0.15) > 1e-12 {
		t.Fatalf("run = %+v", got)
	}
	f.expectSteps(run.ID, "check inputs=finished", "weather checkpoints=finished", "occurrences=finished", "train models=finished")
	for _, sp := range f.species(run.ID) {
		if sp.State != enums.RunStateFinished || sp.Records != len(sp.Slug)*10 {
			t.Errorf("species = %+v", sp)
		}
	}
	admin := testkit.Admin()
	detail := f.env.Get("/pipeline-runs/"+run.ID.String(), &admin)
	if detail.Status != 200 {
		t.Fatalf("detail: %d %s", detail.Status, detail.Body)
	}
	inputs := detail.Map(t)["inputs"].([]any)
	kinds := map[string]map[string]any{}
	for _, in := range inputs {
		row := in.(map[string]any)
		kinds[row["kind"].(string)] = row
	}
	if row := kinds["tree-scales"]; row == nil || row["versionId"] != scales.ID.String() || row["version"] != 1.0 {
		t.Errorf("tree-scales input = %v", row)
	}
	if row := kinds["dwd-hyras"]; row == nil || row["versionId"] != nil {
		t.Errorf("dwd-hyras input = %v", row)
	}
	snapshot, err := db.Scalar[string](context.Background(), f.env.DB,
		"SELECT remote_snapshot FROM pipeline_run_input WHERE run_id = ? AND kind = 'dwd-hyras'", run.ID)
	if err != nil || !strings.Contains(snapshot, `"files":1`) || !strings.Contains(snapshot, "2026-10-05") {
		t.Errorf("snapshot = %s, %v", snapshot, err)
	}
	if len(inputs) != 4 {
		t.Errorf("inputs = %v", inputs)
	}
}

func TestAFailedSpeciesKeepsTheOthersAndSkipsItsMap(t *testing.T) {
	f := newFixture(t, 3)
	for _, k := range []sources.Kind{sources.KindTreesGrid, sources.KindTreeScales, sources.KindSiteGrid} {
		f.install(k, "x", nil)
	}
	run := f.queue(enums.RunKindFull)
	species := slugs(f.species(run.ID))
	f.stages.fail = map[string]bool{"train:" + species[0]: true}
	f.stages.panic = map[string]bool{"maps:" + species[1]: true}
	f.runNext()
	if got := f.get(run.ID); got.State != enums.RunStateFailed || got.ProgressDone != 3 {
		t.Fatalf("run = %+v", got)
	}
	f.expectSteps(run.ID, "check inputs=finished", "weather checkpoints=finished", "occurrences=finished",
		"train models=failed", "render maps=failed", "render layers=finished", "season table=finished")
	want := append(append([]string{"weather", "occurrences"}, prefixed("train", species)...),
		"maps:"+species[1], "maps:"+species[2], "layers", "season")
	if calls := f.stages.Calls(); !slices.Equal(calls, want) {
		t.Errorf("calls = %v, want %v", calls, want)
	}
	states := f.species(run.ID)
	if states[0].State != enums.RunStateFailed || states[1].State != enums.RunStateFailed || states[2].State != enums.RunStateFinished {
		t.Errorf("species = %+v", states)
	}
	if states[2].Records != len(species[2])*10 {
		t.Errorf("the render step lost the record count: %+v", states[2])
	}
	if log := f.logOf(run.ID); !strings.Contains(log, "panic: stub maps:"+species[1]) {
		t.Errorf("log has no panic: %q", log)
	}
}

func TestAFailedStepStopsTheRun(t *testing.T) {
	f := newFixture(t, 1)
	f.install(sources.KindTreeScales, "tree_scales", nil)
	f.stages.fail = map[string]bool{"weather": true}
	run := f.queue(enums.RunKindTraining)
	f.runNext()
	f.expectSteps(run.ID, "check inputs=finished", "weather checkpoints=failed", "occurrences=failed", "train models=failed")
	if calls := f.stages.Calls(); !slices.Equal(calls, []string{"weather"}) {
		t.Errorf("calls = %v", calls)
	}
	if sp := f.species(run.ID); sp[0].State != enums.RunStateFailed {
		t.Errorf("species = %+v", sp)
	}
}

func TestARenderRunNeedsAModel(t *testing.T) {
	f := newFixture(t, 1)
	for _, k := range []sources.Kind{sources.KindTreesGrid, sources.KindTreeScales, sources.KindSiteGrid} {
		f.install(k, "x", nil)
	}
	run := f.queue(enums.RunKindRender)
	f.runNext()
	if log := f.logOf(run.ID); !strings.Contains(log, "inputs_missing: model-bundle") {
		t.Errorf("log = %q", log)
	}
	var id db.ID
	if err := f.env.DB.QueryRow("SELECT species_id FROM pipeline_run_species WHERE run_id = ?", run.ID).Scan(&id); err != nil {
		t.Fatal(err)
	}
	model := f.install(sources.KindModelBundle, "bundle", &id)
	again := f.queue(enums.RunKindRender)
	f.runNext()
	f.expectSteps(again.ID, "check inputs=finished", "weather checkpoints=finished", "occurrences=finished",
		"render maps=finished", "render layers=finished", "season table=finished")
	version, err := db.Scalar[string](context.Background(), f.env.DB,
		"SELECT version_id FROM pipeline_run_input WHERE run_id = ? AND kind LIKE 'model-bundle:%'", again.ID)
	if err != nil || version != strings.ReplaceAll(model.ID.String(), "-", "") {
		t.Errorf("model input = %s, %v", version, err)
	}
}

func TestTheRunWaitsForTheJobLock(t *testing.T) {
	f := newFixture(t, 1)
	run := f.queue(enums.RunKindFetch)
	sources.JobLock.Lock()
	done := make(chan error, 1)
	go func() {
		_, err := f.runner.RunNext(context.Background())
		done <- err
	}()
	time.Sleep(500 * time.Millisecond)
	if got := f.get(run.ID); got.State != enums.RunStateQueued {
		sources.JobLock.Unlock()
		t.Fatalf("the run started while a version held the lock: %s", got.State)
	}
	sources.JobLock.Unlock()
	if err := <-done; err != nil {
		t.Fatal(err)
	}
	if got := f.get(run.ID); got.State != enums.RunStateFinished {
		t.Fatalf("state = %s", got.State)
	}
	if !sources.JobLock.TryLock() {
		t.Fatal("the runner kept the lock")
	}
	sources.JobLock.Unlock()
}

func TestAStoppedProcessLeavesNoRunningRun(t *testing.T) {
	f := newFixture(t, 1)
	crashed := f.queue(enums.RunKindFetch)
	if _, found, err := f.runs.Claim(context.Background()); err != nil || !found {
		t.Fatal(err)
	}
	next := f.queue(enums.RunKindFetch)
	if err := f.runMod.Start(context.Background()); err != nil {
		t.Fatal(err)
	}
	if got := f.get(crashed.ID); got.State != enums.RunStateFailed {
		t.Fatalf("crashed run = %s", got.State)
	}
	f.runNext()
	if got := f.get(next.ID); got.State != enums.RunStateFinished {
		t.Fatalf("next run = %s", got.State)
	}
}

func TestAShutdownFailsTheRunningRun(t *testing.T) {
	f := newFixture(t, 1)
	f.install(sources.KindTreeScales, "tree_scales", nil)
	f.stages.block, f.stages.started = true, make(chan struct{})
	run := f.queue(enums.RunKindTraining)
	ctx, cancel := context.WithCancel(context.Background())
	done := make(chan error, 1)
	go func() {
		_, err := f.runner.RunNext(ctx)
		done <- err
	}()
	<-f.stages.started
	cancel()
	if err := <-done; err != nil {
		t.Fatal(err)
	}
	if got := f.get(run.ID); got.State != enums.RunStateFailed || got.FinishedAt == nil {
		t.Fatalf("run = %+v", got)
	}
	f.expectSteps(run.ID, "check inputs=finished", "weather checkpoints=failed", "occurrences=failed", "train models=failed")
}

func TestTheLoopTakesQueuedRunsUntilTheContextEnds(t *testing.T) {
	f := newFixture(t, 1)
	ctx, cancel := context.WithCancel(context.Background())
	stopped := make(chan struct{})
	go func() {
		f.runner.Loop(ctx)
		close(stopped)
	}()
	first := f.queue(enums.RunKindFetch)
	second := f.queue(enums.RunKindFetch)
	deadline := time.Now().Add(10 * time.Second)
	for f.get(second.ID).State != enums.RunStateFinished && time.Now().Before(deadline) {
		time.Sleep(20 * time.Millisecond)
	}
	cancel()
	<-stopped
	for _, id := range []db.ID{first.ID, second.ID} {
		if got := f.get(id); got.State != enums.RunStateFinished {
			t.Fatalf("run %s = %s", id, got.State)
		}
	}
}
