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
	insert("gbif-taxonomy", "gbif-match/abc.json", "failed", 1, now, &message)
	items := f.env.Get("/remote-sources", f.admin).Expect(t, http.StatusOK).Map(t)["items"].([]any)
	byID := map[string]map[string]any{}
	for _, item := range items {
		byID[item.(map[string]any)["source"].(string)] = item.(map[string]any)
	}
	hyras := byID["dwd-hyras"]
	if len(items) != 5 || hyras["state"] != "ok" || hyras["files"] != 2.0 || hyras["sizeBytes"] != 150.0 ||
		len(hyras["years"].([]any)) != 2 || hyras["years"].([]any)[0] != 2024.0 {
		t.Fatal(hyras)
	}
	if byID["gbif-occurrences"]["state"] != "stale" || byID["p123"]["state"] != "empty" ||
		byID["gbif-taxonomy"]["state"] != "failed" || byID["gbif-taxonomy"]["error"] != message {
		t.Fatal(byID)
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
	shown := f.env.Get("/pipeline-runs/"+run["id"].(string), f.admin).Expect(t, http.StatusOK).Map(t)
	if shown["kind"] != "fetch" {
		t.Fatal(shown)
	}
}
