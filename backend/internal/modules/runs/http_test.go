package runs_test

import (
	"net/http"
	"os"
	"path/filepath"
	"slices"
	"testing"

	"github.com/frederikbeimgraben/kinoko/backend/internal/core/db"
	"github.com/frederikbeimgraben/kinoko/backend/internal/core/enums"
	"github.com/frederikbeimgraben/kinoko/backend/internal/testkit"
)

var admin = testkit.Ptr(testkit.Admin())

type summaryJSON struct {
	ID            string  `json:"id"`
	Kind          string  `json:"kind"`
	State         string  `json:"state"`
	TriggeredByID *string `json:"triggeredById"`
	SpeciesName   *string `json:"speciesName"`
	SpeciesCount  int     `json:"speciesCount"`
	RecordCount   int     `json:"recordCount"`
	ProgressDone  int     `json:"progressDone"`
	ProgressTotal int     `json:"progressTotal"`
}

type detailJSON struct {
	summaryJSON
	MetricBrier         *float64         `json:"metricBrier"`
	MetricBrierPrevious *float64         `json:"metricBrierPrevious"`
	Species             []map[string]any `json:"species"`
	Steps               []map[string]any `json:"steps"`
	LogTail             []string         `json:"logTail"`
}

func (f *fixture) detail(id db.ID) detailJSON {
	f.t.Helper()
	return testkit.JSON[detailJSON](f.t, f.env.Get("/pipeline-runs/"+id.String(), admin).Expect(f.t, http.StatusOK))
}

func TestCreatePipelineRunEndpoint(t *testing.T) {
	f := newFixture(t)
	f.species("a", true)
	body := testkit.JSON[summaryJSON](t, f.env.Post("/pipeline-runs", map[string]any{"kind": "training"}, admin).Expect(t, http.StatusCreated))
	if body.Kind != "training" || body.State != "queued" || body.TriggeredByID == nil {
		t.Fatalf("%+v", body)
	}
	if body.ProgressTotal != 1 || body.SpeciesCount != 0 || body.RecordCount != 0 || body.SpeciesName != nil {
		t.Fatalf("the new summary is not untallied: %+v", body)
	}
}

func TestCreatePipelineRunSignalsWake(t *testing.T) {
	f := newFixture(t)
	f.env.Post("/pipeline-runs", map[string]any{"kind": "render"}, admin).Expect(t, http.StatusCreated)
	select {
	case <-f.module().Store().Wake():
	default:
		t.Fatal("no signal")
	}
}

func TestCreatePipelineRunRejectsAnUnknownKind(t *testing.T) {
	f := newFixture(t)
	f.env.Post("/pipeline-runs", map[string]any{"kind": "unsinn"}, admin).Expect(t, http.StatusUnprocessableEntity)
}

func TestPipelineRunsNeedThePermission(t *testing.T) {
	f := newFixture(t)
	f.env.Get("/pipeline-runs", nil).Expect(t, http.StatusUnauthorized)
	f.env.Get("/pipeline-runs", testkit.Ptr(testkit.Someone("plain"))).Expect(t, http.StatusForbidden)
	f.env.Post("/pipeline-runs", map[string]any{"kind": "render"}, testkit.Ptr(testkit.Someone("plain"))).Expect(t, http.StatusForbidden)
}

func TestListAndGetPipelineRunEndpoints(t *testing.T) {
	f := newFixture(t)
	created := testkit.JSON[summaryJSON](t, f.env.Post("/pipeline-runs", map[string]any{"kind": "render"}, admin).Expect(t, http.StatusCreated))
	listed := testkit.JSON[struct {
		Items      []summaryJSON `json:"items"`
		NextCursor *string       `json:"nextCursor"`
	}](t, f.env.Get("/pipeline-runs", admin).Expect(t, http.StatusOK))
	if !slices.ContainsFunc(listed.Items, func(s summaryJSON) bool { return s.ID == created.ID }) {
		t.Fatalf("%+v", listed)
	}
	id, err := db.ParseID(created.ID)
	must(t, err)
	body := f.detail(id)
	if len(body.Species) != 0 || len(body.Steps) != 0 || len(body.LogTail) != 0 || body.ProgressDone != 0 || body.ProgressTotal != 0 {
		t.Fatalf("%+v", body)
	}
	raw := f.env.Get("/pipeline-runs/"+created.ID, admin).Map(t)
	for _, key := range []string{"startedAt", "finishedAt", "speciesName", "logPath", "metricBrier", "metricBrierPrevious"} {
		if value, ok := raw[key]; !ok || value != nil {
			t.Fatalf("%s: %v", key, raw)
		}
	}
}

func TestListPagesNewestFirst(t *testing.T) {
	f := newFixture(t)
	user := f.user("person")
	first := f.queue(enums.RunKindTraining, user)
	second := f.queue(enums.RunKindRender, user)
	page := testkit.JSON[struct {
		Items      []summaryJSON `json:"items"`
		NextCursor *string       `json:"nextCursor"`
	}](t, f.env.Get("/pipeline-runs?limit=1", admin).Expect(t, http.StatusOK))
	if len(page.Items) != 1 || page.Items[0].ID != second.ID.String() || page.NextCursor == nil {
		t.Fatalf("%+v", page)
	}
	rest := testkit.JSON[struct {
		Items      []summaryJSON `json:"items"`
		NextCursor *string       `json:"nextCursor"`
	}](t, f.env.Get("/pipeline-runs?limit=1&cursor="+*page.NextCursor, admin).Expect(t, http.StatusOK))
	if len(rest.Items) != 1 || rest.Items[0].ID != first.ID.String() || rest.NextCursor != nil {
		t.Fatalf("%+v", rest)
	}
}

func TestAQueuedRunShowsAStateForEveryForecastSpecies(t *testing.T) {
	f := newFixture(t)
	f.species("a", true)
	f.species("b", false)
	created := testkit.JSON[summaryJSON](t, f.env.Post("/pipeline-runs", map[string]any{"kind": "training"}, admin).Expect(t, http.StatusCreated))
	id, err := db.ParseID(created.ID)
	must(t, err)
	body := f.detail(id)
	if len(body.Species) != 1 || body.Species[0]["state"] != "queued" {
		t.Fatalf("%+v", body.Species)
	}
}

func TestGetPipelineRunIsNotFoundForAnUnknownID(t *testing.T) {
	f := newFixture(t)
	f.env.Get("/pipeline-runs/"+db.NewID().String(), admin).Expect(t, http.StatusNotFound)
}

func TestDetailCarriesProgressStepsAndLogTail(t *testing.T) {
	f := newFixture(t)
	run := f.queue(enums.RunKindTraining, f.user("person"))
	must(t, f.store.ReportStep(f.ctx, run.ID, 0, "run_all.sh", enums.RunStateRunning, nil))
	must(t, f.store.ReportStep(f.ctx, run.ID, 0, "run_all.sh", enums.RunStateFinished, ptr(12)))
	body := f.detail(run.ID)
	if body.ProgressDone != 0 || body.ProgressTotal != 0 || len(body.LogTail) != 0 {
		t.Fatalf("%+v", body)
	}
	want := map[string]any{"position": 0.0, "name": "run_all.sh", "state": "finished", "durationS": 12.0}
	if len(body.Steps) != 1 || !mapsEqual(body.Steps[0], want) {
		t.Fatalf("%+v", body.Steps)
	}
}

func TestDetailReadsTheLogTail(t *testing.T) {
	f := newFixture(t)
	run := f.queue(enums.RunKindTraining, f.user("person"))
	path := filepath.Join(t.TempDir(), "run.log")
	must(t, os.WriteFile(path, []byte("one\ntwo\n"), 0o644))
	must(t, f.store.Finish(f.ctx, run.ID, enums.RunStateFinished, path, nil))
	if body := f.detail(run.ID); !slices.Equal(body.LogTail, []string{"one", "two"}) {
		t.Fatalf("%+v", body.LogTail)
	}
}

func TestDetailCarriesThePreviousBrierScoreOfTheSameKind(t *testing.T) {
	f := newFixture(t)
	user := f.user("person")
	earlier := f.queue(enums.RunKindTraining, user)
	must(t, f.store.Finish(f.ctx, earlier.ID, enums.RunStateFinished, "", ptr(0.3)))
	other := f.queue(enums.RunKindRender, user)
	must(t, f.store.Finish(f.ctx, other.ID, enums.RunStateFinished, "", ptr(0.9)))
	run := f.queue(enums.RunKindTraining, user)
	must(t, f.store.Finish(f.ctx, run.ID, enums.RunStateFinished, "", ptr(0.2)))
	body := f.detail(run.ID)
	if body.MetricBrier == nil || *body.MetricBrier != 0.2 || body.MetricBrierPrevious == nil || *body.MetricBrierPrevious != 0.3 {
		t.Fatalf("%+v", body)
	}
}

func TestDetailWithoutAPreviousRunHasNoPreviousBrierScore(t *testing.T) {
	f := newFixture(t)
	run := f.queue(enums.RunKindTraining, f.user("person"))
	if body := f.detail(run.ID); body.MetricBrierPrevious != nil {
		t.Fatalf("%+v", body)
	}
}

func TestRunListNamesTheSingleSpeciesOfATraining(t *testing.T) {
	f := newFixture(t)
	stone := f.species("steinpilz", true)
	f.exec("UPDATE species SET name = 'Steinpilz' WHERE id = ?", stone)
	run := db.NewID()
	f.exec(`INSERT INTO pipeline_run (id, kind, state, queued_at, progress_done, progress_total)
		VALUES (?, 'training', 'finished', ?, 0, 12)`, run, db.Now())
	f.exec(`INSERT INTO pipeline_run_species (run_id, species_id, state, record_count, find_count)
		VALUES (?, ?, 'finished', 1284, 0)`, run, stone)
	page := testkit.JSON[struct {
		Items []summaryJSON `json:"items"`
	}](t, f.env.Get("/pipeline-runs", admin).Expect(t, http.StatusOK))
	shown := page.Items[0]
	if shown.SpeciesName == nil || *shown.SpeciesName != "Steinpilz" || shown.SpeciesCount != 1 ||
		shown.RecordCount != 1284 || shown.ProgressTotal != 12 {
		t.Fatalf("%+v", shown)
	}
}

func mapsEqual(a, b map[string]any) bool {
	if len(a) != len(b) {
		return false
	}
	for k, v := range a {
		if b[k] != v {
			return false
		}
	}
	return true
}
