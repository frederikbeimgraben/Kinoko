package runner_test

import (
	"context"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"slices"
	"strconv"
	"strings"
	"sync"
	"testing"
	"time"

	"github.com/frederikbeimgraben/kinoko/backend/internal/modules/sources"
	"github.com/frederikbeimgraben/kinoko/backend/internal/pipeline/occ/gbif"
	"github.com/frederikbeimgraben/kinoko/backend/internal/pipeline/runner"
	"github.com/frederikbeimgraben/kinoko/backend/internal/pipeline/weather/dwd"
)

var june = time.Date(2026, 6, 1, 3, 0, 0, 0, time.UTC)

// requests records the request paths and GBIF count years of a fake server.
type requests struct {
	mu    sync.Mutex
	paths []string
	years []int
}

func (r *requests) server(t *testing.T, body string) *httptest.Server {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, req *http.Request) {
		r.mu.Lock()
		r.paths = append(r.paths, req.URL.Path)
		if q := req.URL.Query(); q.Get("limit") == "0" && q.Get("month") == "" {
			y, _ := strconv.Atoi(q.Get("year"))
			r.years = append(r.years, y)
		}
		r.mu.Unlock()
		if body == "" {
			http.NotFound(w, req)
			return
		}
		_, _ = w.Write([]byte(body))
	}))
	t.Cleanup(srv.Close)
	return srv
}

func (r *requests) take() ([]string, []int) {
	r.mu.Lock()
	defer r.mu.Unlock()
	paths, years := r.paths, r.years
	r.paths, r.years = nil, nil
	return paths, years
}

func yearsFrom(from, to int) []int {
	var out []int
	for y := from; y <= to; y++ {
		out = append(out, y)
	}
	return out
}

// TestFetchWeatherResumesAnInterruptedBootstrap checks that a cache with a
// failed year and absent years gets these years, not only the weekly ones.
func TestFetchWeatherResumesAnInterruptedBootstrap(t *testing.T) {
	f := newFixture(t, 1)
	ctx := context.Background()
	store := dwd.SQLStore{DB: f.env.DB}
	for _, tree := range dwd.TreeSpecies {
		for y := dwd.FirstYear; y <= 2024; y++ {
			state := dwd.StateOK
			if y == 2017 {
				state = dwd.StateFailed
			}
			key := "dwd/soil_moisture/" + tree + "/grids_germany_daily_soil_moisture_" + tree + "_" + strconv.Itoa(y) + "_0-30_v1-0.nc"
			if err := store.Put(ctx, dwd.CacheRecord{Source: dwd.SourceSoil, Key: key, State: state}); err != nil {
				t.Fatal(err)
			}
		}
	}
	var rec requests
	srv := rec.server(t, "")
	chain := &runner.Chain{DB: f.env.DB, Sources: f.sources, Data: f.data, HTTP: srv.Client(), DWDBase: srv.URL}
	j := &runner.Job{Now: june, Request: &sources.FetchRequest{Source: dwd.SourceSoil}}
	if err := chain.FetchWeather(ctx, j); err != nil {
		t.Fatal(err)
	}
	paths, _ := rec.take()
	want := []string{"/soil_moisture/spruce/2017/", "/soil_moisture/spruce/2025/", "/soil_moisture/spruce/2026/"}
	if got := slices.DeleteFunc(paths, func(p string) bool { return !strings.HasPrefix(p, "/soil_moisture/spruce/") }); !slices.Equal(got, want) {
		t.Errorf("requests of spruce %v, want %v", got, want)
	}
}

// TestFetchOccurrencesResumesAnInterruptedBootstrap checks that a cache with
// the files of 2000..2007 gets the later closed years, and then only the weekly year.
func TestFetchOccurrencesResumesAnInterruptedBootstrap(t *testing.T) {
	f := newFixture(t, 1)
	dir := gbif.CacheDir(f.data)
	if err := os.MkdirAll(dir, 0o755); err != nil {
		t.Fatal(err)
	}
	for y := gbif.BootstrapFrom; y <= 2007; y++ {
		writeText(t, filepath.Join(dir, gbif.ChunkName("DE", y, 0)), "")
	}
	var rec requests
	srv := rec.server(t, `{"count": 0, "endOfRecords": true, "results": []}`)
	chain := &runner.Chain{DB: f.env.DB, Sources: f.sources, Data: f.data, HTTP: srv.Client(), GBIFBase: srv.URL}
	fetch := func() []int {
		if err := chain.FetchOccurrences(context.Background(), &runner.Job{Now: june}); err != nil {
			t.Fatal(err)
		}
		_, years := rec.take()
		return years
	}
	if got := fetch(); !slices.Equal(got, yearsFrom(2008, 2026)) {
		t.Errorf("first fetch counts %v, want 2008..2026", got)
	}
	if got := fetch(); !slices.Equal(got, []int{2026}) {
		t.Errorf("second fetch counts %v, want [2026]", got)
	}
}

// TestFetchOccurrencesFillsTheYearsAfterTheArchiveCutoff checks that an
// archive with an old cutoff year does not leave the later closed years out.
func TestFetchOccurrencesFillsTheYearsAfterTheArchiveCutoff(t *testing.T) {
	f := newFixture(t, 1)
	dir := filepath.Join(f.data, "staging-archive")
	writeText(t, filepath.Join(dir, "file"), "x")
	_, err := f.sources.Install(context.Background(), sources.Install{Kind: sources.KindGBIFArchive, Origin: sources.OriginUpload,
		From: dir, Artifact: "derived", Metadata: map[string]any{"cutoffYear": 2024}, Activate: true})
	if err != nil {
		t.Fatal(err)
	}
	var rec requests
	srv := rec.server(t, `{"count": 0, "endOfRecords": true, "results": []}`)
	chain := &runner.Chain{DB: f.env.DB, Sources: f.sources, Data: f.data, HTTP: srv.Client(), GBIFBase: srv.URL}
	if err := chain.FetchOccurrences(context.Background(), &runner.Job{Now: june}); err != nil {
		t.Fatal(err)
	}
	if _, got := rec.take(); !slices.Equal(got, []int{2024, 2025, 2026}) {
		t.Errorf("counts %v, want 2024..2026", got)
	}
}
