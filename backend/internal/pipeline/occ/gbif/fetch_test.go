package gbif_test

import (
	"context"
	"encoding/json"
	"errors"
	"os"
	"path/filepath"
	"slices"
	"strings"
	"testing"
	"time"

	"github.com/frederikbeimgraben/kinoko/backend/internal/pipeline/occ/gbif"
)

func fetcher(f *fakeGBIF, dir string, s *sleeps) *gbif.Fetcher {
	return &gbif.Fetcher{HTTP: f.server.Client(), BaseURL: f.server.URL, Dir: dir, Sleep: s.sleep}
}

// Golden: the observer hashes and the slim records as JSON lines.
func TestSlimAndHashMatchGolden(t *testing.T) {
	raw, err := os.ReadFile("../testdata/observers.json")
	if err != nil {
		t.Fatal(err)
	}
	var g struct {
		HashObserver [][2]json.RawMessage `json:"hash_observer"`
		SlimLines    []string             `json:"slim_lines"`
	}
	if err := json.Unmarshal(raw, &g); err != nil {
		t.Fatal(err)
	}
	for _, c := range g.HashObserver {
		obj, err := gbif.DecodeObject([]byte(`{"v":` + string(c[0]) + `}`))
		if err != nil {
			t.Fatal(err)
		}
		var want *string
		if err := json.Unmarshal(c[1], &want); err != nil {
			t.Fatal(err)
		}
		got, ok := gbif.HashObserver(obj["v"])
		if (want == nil) == ok || (ok && got != *want) {
			t.Errorf("HashObserver(%s) = %q %v, want %s", c[0], got, ok, c[1])
		}
	}
	inputs := []string{
		`{"gbifID": "1", "key": 1, "recordedBy": "Anna", "decimalLatitude": 48.5, "year": 2024, "issues": ["A"], "extra": {"x": 1}, "species": "B\u00e4r", "elevation": 1e-05, "coordinateUncertaintyInMeters": 30.0, "individualCount": 12345678901234}`,
		`{"gbifID": "2", "recordedBy": null}`,
		`{"gbifID": "3", "recordedBy": ["Anna", "Bert"], "eventDate": "2024-01-02/2024-01-03"}`,
	}
	for i, in := range inputs {
		rec, err := gbif.DecodeObject([]byte(in))
		if err != nil {
			t.Fatal(err)
		}
		if got := string(gbif.Line(gbif.Slim(rec))); got != g.SlimLines[i] {
			t.Errorf("slim line %d:\n got %s\nwant %s", i, got, g.SlimLines[i])
		}
	}
}

// A year under the threshold goes into one file, page by page, with a pause between pages.
func TestFetchYearInPages(t *testing.T) {
	f := newFake(t)
	f.add(2023, 5, 400, "x")
	f.add(2023, 9, 250, "x")
	dir, s := t.TempDir(), &sleeps{}
	chunks, err := fetcher(f, dir, s).Fetch(context.Background(), gbif.Plan{Years: []int{2023}})
	if err != nil {
		t.Fatal(err)
	}
	if len(chunks) != 1 || chunks[0].Records != 650 || chunks[0].Expected != 650 || chunks[0].Key != "gbif:2023" || chunks[0].Short() {
		t.Fatalf("chunks %+v", chunks)
	}
	lines := readLines(t, filepath.Join(dir, "fungi_de_2023.jsonl.gz"))
	if len(lines) != 650 {
		t.Fatalf("%d lines", len(lines))
	}
	hash, _ := gbif.HashObserver("Anna x")
	if lines[0]["recordedByHash"] != hash || lines[0]["recordedBy"] != nil || lines[0]["gadm"] != nil || lines[0]["key"] != nil {
		t.Errorf("slim record %v", lines[0])
	}
	if !slices.Equal(s.d, []time.Duration{gbif.Pause, gbif.Pause}) {
		t.Errorf("sleeps %v, want two pauses", s.d)
	}
	if len(f.requests) != 4 {
		t.Errorf("%d requests, want a count and 3 pages", len(f.requests))
	}
	if _, err := os.Stat(filepath.Join(dir, "fungi_de_2023.jsonl.gz"+gbif.PartialSuffix)); !os.IsNotExist(err) {
		t.Errorf("a partial file is left: %v", err)
	}
}

// A year above the threshold goes into one file per month with records.
func TestFetchSplitsLargeYearIntoMonths(t *testing.T) {
	f := newFake(t)
	f.add(2024, 3, 120, "x")
	f.add(2024, 7, 30, "x")
	dir, s := t.TempDir(), &sleeps{}
	fe := fetcher(f, dir, s)
	fe.MonthThreshold = 100
	chunks, err := fe.Fetch(context.Background(), gbif.Plan{Years: []int{2024}})
	if err != nil {
		t.Fatal(err)
	}
	if len(chunks) != 2 || chunks[0].Key != "gbif:2024-03" || chunks[1].Records != 30 {
		t.Fatalf("chunks %+v", chunks)
	}
	files, _ := gbif.YearFiles(dir, "DE", 2024)
	want := []string{filepath.Join(dir, "fungi_de_2024-03.jsonl.gz"), filepath.Join(dir, "fungi_de_2024-07.jsonl.gz")}
	if !slices.Equal(files, want) {
		t.Errorf("files %v, want %v", files, want)
	}
}

// Bootstrap skips a closed year whose file is present. A refresh year replaces its
// files, also a month file that the new fetch does not write (finding 2).
func TestRefreshReplacesAndBootstrapSkips(t *testing.T) {
	f := newFake(t)
	f.add(2020, 6, 5, "server")
	f.add(2026, 6, 7, "server")
	dir, s := t.TempDir(), &sleeps{}
	stale := []string{"fungi_de_2020.jsonl.gz", "fungi_de_2026.jsonl.gz", "fungi_de_2026-05.jsonl.gz"}
	for _, name := range stale {
		if err := os.WriteFile(filepath.Join(dir, name), gz(t, `{"gbifID": "old"}`), 0o644); err != nil {
			t.Fatal(err)
		}
	}
	plan := gbif.BootstrapPlan(2020, time.Date(2026, 10, 8, 0, 0, 0, 0, time.UTC))
	plan.Years = []int{2020, 2026}
	chunks, err := fetcher(f, dir, s).Fetch(context.Background(), plan)
	if err != nil {
		t.Fatal(err)
	}
	if len(chunks) != 2 || !chunks[0].Skipped || chunks[1].Records != 7 {
		t.Fatalf("chunks %+v", chunks)
	}
	for _, q := range f.requests {
		if strings.Contains(q, "year=2020") {
			t.Errorf("a present closed year must not be asked for: %s", q)
		}
	}
	if old := readLines(t, filepath.Join(dir, "fungi_de_2020.jsonl.gz")); old[0]["gbifID"] != "old" {
		t.Errorf("the closed year changed")
	}
	if lines := readLines(t, filepath.Join(dir, "fungi_de_2026.jsonl.gz")); len(lines) != 7 {
		t.Errorf("the current year has %d lines, want 7", len(lines))
	}
	if _, err := os.Stat(filepath.Join(dir, "fungi_de_2026-05.jsonl.gz")); !os.IsNotExist(err) {
		t.Errorf("the stale month file is left: %v", err)
	}
}

// After a 429 the fetcher waits max(Retry-After, 30 s) times the attempt; after another error 2 s, then 4 s.
func TestRetryWaits(t *testing.T) {
	f := newFake(t)
	f.add(2025, 1, 3, "x")
	f.failures = []failure{{429, "3"}, {500, ""}, {429, "120"}, {503, ""}}
	dir, s := t.TempDir(), &sleeps{}
	if _, err := fetcher(f, dir, s).Fetch(context.Background(), gbif.Plan{Years: []int{2025}}); err != nil {
		t.Fatal(err)
	}
	want := []time.Duration{30 * time.Second, 2 * time.Second, 360 * time.Second, 4 * time.Second}
	if !slices.Equal(s.d, want) {
		t.Errorf("waits %v, want %v", s.d, want)
	}
}

// A refresh that fails keeps the old files and leaves no partial file.
func TestFailedRefreshKeepsOldFiles(t *testing.T) {
	f := newFake(t)
	f.add(2026, 6, 400, "x")
	dir, s := t.TempDir(), &sleeps{}
	path := filepath.Join(dir, "fungi_de_2026.jsonl.gz")
	if err := os.WriteFile(path, gz(t, `{"gbifID": "old"}`), 0o644); err != nil {
		t.Fatal(err)
	}
	fe := fetcher(f, dir, s)
	fe.Attempts = 3
	// The count and the first page answer; then each try of the second page fails.
	f.mu.Lock()
	f.failures = nil
	f.mu.Unlock()
	fe.Sleep = func(ctx context.Context, d time.Duration) error {
		f.mu.Lock()
		f.failures = append(f.failures, failure{status: 500})
		f.mu.Unlock()
		return s.sleep(ctx, d)
	}
	_, err := fe.Fetch(context.Background(), gbif.WeeklyPlan(time.Date(2026, 10, 8, 0, 0, 0, 0, time.UTC)))
	var status *gbif.StatusError
	if err == nil || !errors.As(err, &status) || status.Code != 500 {
		t.Fatalf("err %v, want HTTP 500", err)
	}
	if lines := readLines(t, path); len(lines) != 1 || lines[0]["gbifID"] != "old" {
		t.Errorf("the old file changed")
	}
	entries, _ := os.ReadDir(dir)
	if len(entries) != 1 {
		t.Errorf("files %v, want only the old file", entries)
	}
}

func TestPlans(t *testing.T) {
	jan := time.Date(2026, 1, 15, 0, 0, 0, 0, time.UTC)
	mar := time.Date(2026, 3, 1, 0, 0, 0, 0, time.UTC)
	if got := gbif.RefreshYears(jan); !slices.Equal(got, []int{2025, 2026}) {
		t.Errorf("January: %v", got)
	}
	if got := gbif.RefreshYears(mar); !slices.Equal(got, []int{2026}) {
		t.Errorf("March: %v", got)
	}
	p := gbif.BootstrapPlan(gbif.BootstrapFrom, mar)
	if len(p.Years) != 27 || p.Years[0] != 2000 || !p.Refresh[2026] || p.Refresh[2025] {
		t.Errorf("bootstrap %+v", p)
	}
	if name := gbif.ChunkName("DE", 2026, 5); name != "fungi_de_2026-05.jsonl.gz" {
		t.Errorf("name %s", name)
	}
	if c, y, m, ok := gbif.ParseChunkName("fungi_de_2026-05.jsonl.gz"); !ok || c != "de" || y != 2026 || m != 5 {
		t.Errorf("parse %s %d %d %v", c, y, m, ok)
	}
}
