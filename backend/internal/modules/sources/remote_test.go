package sources_test

import (
	"net/http"
	"testing"
	"time"

	"github.com/frederikbeimgraben/kinoko/backend/internal/core/db"
)

func TestRemoteSourcesSummarizeTheCache(t *testing.T) {
	f := newFixture(t)
	now := time.Now()
	insert := func(source, key, state string, size int64, checked time.Time, failure *string) {
		f.exec(`INSERT INTO remote_cache_file (source, "key", url, size_bytes, fetched_at, checked_at, state, error)
			VALUES (?, ?, 'https://example.org', ?, ?, ?, ?, ?)`, source, key, size, db.At(checked), db.At(checked), state, failure)
	}
	insert("dwd-hyras", "dwd/hyras/precipitation/pr_hyras_1_2024_v6-0_de.nc", "ok", 100, now.Add(-time.Hour), nil)
	insert("dwd-hyras", "dwd/hyras/precipitation/pr_hyras_1_2025_v6-0_de.nc", "ok", 50, now.Add(-2*time.Hour), nil)
	insert("gbif-occurrences", "gbif/fungi_de_2025-05.jsonl.gz", "ok", 10, now.Add(-30*24*time.Hour), nil)
	message := "HTTP 503"
	insert("dwd-soil-moisture", "dwd/soil_moisture/beech/x_2025.nc", "failed", 1, now, &message)
	items := f.env.Get("/remote-sources", f.admin).Expect(t, http.StatusOK).Map(t)["items"].([]any)
	byID := map[string]map[string]any{}
	for _, item := range items {
		byID[item.(map[string]any)["source"].(string)] = item.(map[string]any)
	}
	hyras := byID["dwd-hyras"]
	if len(items) != 3 || hyras["state"] != "ok" || hyras["files"] != 2.0 || hyras["sizeBytes"] != 150.0 ||
		len(hyras["years"].([]any)) != 2 || hyras["years"].([]any)[0] != 2024.0 {
		t.Fatal(hyras)
	}
	if byID["gbif-occurrences"]["state"] != "stale" ||
		byID["dwd-soil-moisture"]["state"] != "failed" || byID["dwd-soil-moisture"]["error"] != message {
		t.Fatal(byID)
	}
}

func TestRemoteSourcesWithoutCacheSendAnEmptyYearList(t *testing.T) {
	f := newFixture(t)
	body := f.env.Get("/remote-sources", f.admin).Expect(t, http.StatusOK).Map(t)
	for _, item := range body["items"].([]any) {
		view := item.(map[string]any)
		if years, ok := view["years"].([]any); !ok || len(years) != 0 || view["state"] != "empty" {
			t.Fatal(view)
		}
	}
}

func TestRefreshQueuesOneFetchRun(t *testing.T) {
	f := newFixture(t)
	run := f.env.Post("/remote-sources/gbif-occurrences/refresh", map[string]any{"fromYear": 2000, "toYear": 2010},
		f.admin).Expect(t, http.StatusAccepted).Map(t)
	if run["kind"] != "fetch" || run["state"] != "queued" {
		t.Fatal(run)
	}
	request, found, err := f.m.FetchRequestOf(t.Context(), db.MustID(run["id"].(string)))
	if err != nil || !found || request.Source != "gbif-occurrences" || *request.FromYear != 2000 || request.Force {
		t.Fatal(request, found, err)
	}
	again := f.env.Post("/remote-sources/dwd-hyras/refresh", nil, f.admin).Expect(t, http.StatusConflict).Map(t)
	if again["code"] != "run_active" {
		t.Fatal(again)
	}
	f.env.Post("/remote-sources/dwd-hyras/refresh", map[string]any{"fromYear": 2020, "toYear": 2010}, f.admin).
		Expect(t, http.StatusUnprocessableEntity)
	f.env.Post("/remote-sources/nowhere/refresh", nil, f.admin).Expect(t, http.StatusUnprocessableEntity)
	f.env.Post("/remote-sources/p123/refresh", nil, f.admin).Expect(t, http.StatusUnprocessableEntity)
	f.env.Post("/remote-sources/gbif-taxonomy/refresh", nil, f.admin).Expect(t, http.StatusUnprocessableEntity)
	shown := f.env.Get("/pipeline-runs/"+run["id"].(string), f.admin).Expect(t, http.StatusOK).Map(t)
	if shown["kind"] != "fetch" {
		t.Fatal(shown)
	}
}

// TestRefreshQueuesNoRunWithoutItsRequest checks that the run and its fetch
// request are one write: a failed request leaves no plain fetch run behind.
func TestRefreshQueuesNoRunWithoutItsRequest(t *testing.T) {
	f := newFixture(t)
	f.exec(`CREATE TRIGGER refuse_request BEFORE INSERT ON remote_fetch_request BEGIN SELECT RAISE(ABORT, 'refused'); END`)
	f.env.Post("/remote-sources/dwd-hyras/refresh", map[string]any{"fromYear": 2014, "toYear": 2018, "force": true},
		f.admin).Expect(t, http.StatusInternalServerError)
	n, err := db.Scalar[int](t.Context(), f.env.DB, "SELECT count(*) FROM pipeline_run WHERE kind = 'fetch'")
	if err != nil || n != 0 {
		t.Fatalf("%d fetch runs, %v", n, err)
	}
}
