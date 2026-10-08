package dwd

import (
	"bytes"
	"context"
	"crypto/sha256"
	"encoding/hex"
	"fmt"
	"net/http"
	"net/http/httptest"
	"os"
	"path"
	"path/filepath"
	"sort"
	"strings"
	"sync"
	"testing"
	"time"
)

// fakeDWD serves directory listings and files like opendata.dwd.de. The file
// bodies are the netCDF fixtures of the weather tests.
type fakeDWD struct {
	mu        sync.Mutex
	files     map[string]fakeFile
	gets      map[string]int
	ignoreIMS bool            // answer conditional requests with 200
	broken    map[string]bool // send a short body
	missing   map[string]bool // a directory that gives 404
}

type fakeFile struct {
	body []byte
	mod  time.Time
	etag string
}

func newFake() *fakeDWD {
	return &fakeDWD{files: map[string]fakeFile{}, gets: map[string]int{}, broken: map[string]bool{}, missing: map[string]bool{}}
}

func (f *fakeDWD) put(p string, body []byte, mod time.Time) {
	f.mu.Lock()
	defer f.mu.Unlock()
	sum := sha256.Sum256(body)
	f.files[p] = fakeFile{body: body, mod: mod, etag: `"` + hex.EncodeToString(sum[:8]) + `"`}
}

func (f *fakeDWD) count(p string) int {
	f.mu.Lock()
	defer f.mu.Unlock()
	return f.gets[p]
}

func (f *fakeDWD) ServeHTTP(w http.ResponseWriter, r *http.Request) {
	f.mu.Lock()
	f.gets[r.URL.Path]++
	file, ok := f.files[r.URL.Path]
	ignore, broken, missing := f.ignoreIMS, f.broken[r.URL.Path], f.missing[r.URL.Path]
	var names []string
	for p := range f.files {
		if strings.HasPrefix(p, r.URL.Path) && !strings.Contains(p[len(r.URL.Path):], "/") {
			names = append(names, p[len(r.URL.Path):])
		}
	}
	f.mu.Unlock()
	switch {
	case missing:
		http.NotFound(w, r)
	case strings.HasSuffix(r.URL.Path, "/"):
		sort.Strings(names)
		var b strings.Builder
		b.WriteString(`<html><body><pre><a href="../">../</a>` + "\n" + `<a href="?C=M;O=A">Last modified</a>` + "\n")
		for _, n := range names {
			fmt.Fprintf(&b, "<a href=%q>%s</a> 01-Jan-2026 00:00 1M\n", n, n)
		}
		b.WriteString("</pre></body></html>")
		_, _ = w.Write([]byte(b.String()))
	case !ok:
		http.NotFound(w, r)
	case broken:
		w.Header().Set("Content-Length", fmt.Sprint(len(file.body)))
		// The fake sends a short body on purpose, so a failed write is not important.
		_, _ = w.Write(file.body[:len(file.body)/2])
	default:
		if ignore {
			r.Header.Del("If-None-Match")
			r.Header.Del("If-Modified-Since")
		}
		w.Header().Set("ETag", file.etag)
		http.ServeContent(w, r, path.Base(r.URL.Path), file.mod, bytes.NewReader(file.body))
	}
}

func fixture(t *testing.T, name string) []byte {
	t.Helper()
	b, err := os.ReadFile(filepath.Join("../testdata/raw/hyras", name))
	if err != nil {
		t.Fatal(err)
	}
	return b
}

var (
	march   = time.Date(2026, 3, 10, 8, 0, 0, 0, time.UTC)
	modTime = time.Date(2026, 3, 9, 6, 0, 0, 0, time.UTC)
)

func setup(t *testing.T) (*fakeDWD, *Fetcher, *MemStore) {
	t.Helper()
	fake := newFake()
	body2025 := fixture(t, "precipitation/pr_hyras_1_2020_v6-0_de.nc")
	body2026 := fixture(t, "precipitation/pr_hyras_1_2021_v6-0_de.nc")
	for _, hv := range HyrasFolders {
		dir := "/hyras_de/" + hv.Folder + "/"
		fake.put(dir+fmt.Sprintf("%s_hyras_1_2025_v6-0_de.nc", hv.Short), body2025, modTime)
		fake.put(dir+fmt.Sprintf("%s_hyras_1_2026_v6-0_de.nc", hv.Short), body2026, modTime)
	}
	srv := httptest.NewServer(fake)
	t.Cleanup(srv.Close)
	store := NewMemStore()
	f := &Fetcher{HTTP: srv.Client(), Base: srv.URL, Dir: t.TempDir(), Cache: store, Attempts: 2,
		Backoff: func(int) time.Duration { return 0 }, Now: func() time.Time { return march }}
	return fake, f, store
}

func outcomes(r Result) map[string]Outcome {
	out := map[string]Outcome{}
	for _, f := range r.Files {
		out[path.Base(f.Key)] = f.Outcome
	}
	return out
}

func TestFetcherBootstrapThenWeekly(t *testing.T) {
	fake, f, store := setup(t)
	ctx := context.Background()
	res, err := f.Hyras(ctx, Bootstrap(march, 2025))
	if err != nil {
		t.Fatal(err)
	}
	if len(res.Files) != 10 || !res.Changed() {
		t.Fatalf("result %+v", res)
	}
	for name, o := range outcomes(res) {
		if o != Downloaded {
			t.Errorf("%s: %s", name, o)
		}
	}
	key := "dwd/hyras/precipitation/pr_hyras_1_2026_v6-0_de.nc"
	rec, ok, _ := store.Get(ctx, SourceHyras, key)
	body := fake.files["/hyras_de/precipitation/pr_hyras_1_2026_v6-0_de.nc"].body
	sum := sha256.Sum256(body)
	if !ok || rec.State != StateOK || rec.SizeBytes != int64(len(body)) || rec.SHA256 != hex.EncodeToString(sum[:]) ||
		rec.ETag == "" || rec.LastModified != modTime.Format(http.TimeFormat) || !rec.FetchedAt.Equal(march) {
		t.Fatalf("record %+v", rec)
	}
	local := filepath.Join(f.Dir, "hyras/precipitation/pr_hyras_1_2026_v6-0_de.nc")
	if got, _ := os.ReadFile(local); !bytes.Equal(got, body) {
		t.Fatal("file content differs")
	}
	if info, _ := os.Stat(local); !info.ModTime().Equal(modTime) {
		t.Errorf("mtime %v", info.ModTime())
	}

	// The weekly run checks the open year and does not touch the closed year.
	res, err = f.Hyras(ctx, Weekly(march))
	if err != nil {
		t.Fatal(err)
	}
	o := outcomes(res)
	if o["pr_hyras_1_2025_v6-0_de.nc"] != Cached || o["pr_hyras_1_2026_v6-0_de.nc"] != Unchanged || res.Changed() {
		t.Fatalf("weekly outcomes %v", o)
	}
	if n := fake.count("/hyras_de/precipitation/pr_hyras_1_2025_v6-0_de.nc"); n != 1 {
		t.Errorf("closed year fetched %d times", n)
	}

	// A new version of the open year replaces the old one.
	fake.put("/hyras_de/precipitation/pr_hyras_1_2026_v6-1_de.nc", append(body, 1, 2, 3), modTime.Add(time.Hour))
	res, err = f.Hyras(ctx, Weekly(march))
	if err != nil {
		t.Fatal(err)
	}
	if o := outcomes(res); o["pr_hyras_1_2026_v6-1_de.nc"] != Downloaded || !res.Changed() {
		t.Fatalf("outcomes %v", o)
	}
	if _, err := os.Stat(local); !os.IsNotExist(err) {
		t.Error("the old version is still in the cache")
	}
	if _, ok, _ := store.Get(ctx, SourceHyras, key); ok {
		t.Error("the old version still has a row")
	}
	matches, _ := filepath.Glob(filepath.Join(f.Dir, "hyras/*/*.partial"))
	if len(matches) != 0 {
		t.Errorf("partial files left: %v", matches)
	}
}

func TestFetcherConditionalWithoutStore(t *testing.T) {
	fake, f, _ := setup(t)
	ctx := context.Background()
	f.Cache = nil
	if _, err := f.Hyras(ctx, Request{Years: []int{2026}, Refresh: []int{2026}}); err != nil {
		t.Fatal(err)
	}
	res, err := f.Hyras(ctx, Request{Years: []int{2026}, Refresh: []int{2026}})
	if err != nil {
		t.Fatal(err)
	}
	if o := outcomes(res)["tas_hyras_1_2026_v6-0_de.nc"]; o != Unchanged {
		t.Errorf("the file time did not serve as If-Modified-Since: %s", o)
	}
	// A server that ignores the conditions sends the same ETag and length.
	fake.ignoreIMS = true
	f.Cache = NewMemStore()
	if err := f.Cache.Put(ctx, CacheRecord{Source: SourceHyras, Key: "dwd/hyras/humidity/hurs_hyras_1_2026_v6-0_de.nc",
		ETag: fake.files["/hyras_de/humidity/hurs_hyras_1_2026_v6-0_de.nc"].etag, State: StateOK}); err != nil {
		t.Fatal(err)
	}
	res, _ = f.Hyras(ctx, Request{Years: []int{2026}, Refresh: []int{2026}})
	o := outcomes(res)
	if o["hurs_hyras_1_2026_v6-0_de.nc"] != Unchanged {
		t.Errorf("same ETag and length: %s", o["hurs_hyras_1_2026_v6-0_de.nc"])
	}
	if o["pr_hyras_1_2026_v6-0_de.nc"] != Unchanged {
		t.Errorf("same Last-Modified and length: %s", o["pr_hyras_1_2026_v6-0_de.nc"])
	}
}

func TestFetcherFailures(t *testing.T) {
	fake, f, store := setup(t)
	ctx := context.Background()
	broken := "/hyras_de/air_temperature_max/tasmax_hyras_1_2026_v6-0_de.nc"
	fake.broken[broken] = true
	fake.missing["/hyras_de/humidity/"] = true
	res, err := f.Hyras(ctx, Request{Years: []int{2026}, Refresh: []int{2026}})
	if err == nil {
		t.Fatal("no error")
	}
	o := outcomes(res)
	if o["tasmax_hyras_1_2026_v6-0_de.nc"] != Failed || o["humidity"] != Failed || o["pr_hyras_1_2026_v6-0_de.nc"] != Downloaded {
		t.Fatalf("outcomes %v", o)
	}
	if n := fake.count(broken); n != 2 {
		t.Errorf("%d attempts, want 2", n)
	}
	if n := fake.count("/hyras_de/humidity/"); n != 1 {
		t.Errorf("a 404 was tried %d times", n)
	}
	leftover, _ := filepath.Glob(filepath.Join(f.Dir, "hyras/air_temperature_max/*"))
	if len(leftover) != 0 {
		t.Errorf("files left: %v", leftover)
	}
	rec, ok, _ := store.Get(ctx, SourceHyras, "dwd/hyras/air_temperature_max/tasmax_hyras_1_2026_v6-0_de.nc")
	if !ok || rec.State != StateFailed || rec.Error == "" {
		t.Errorf("record %+v", rec)
	}
	st, err := f.Status(ctx)
	if err != nil {
		t.Fatal(err)
	}
	if st[0].Source != SourceHyras || st[0].Files != 3 || st[0].Failed != 1 || len(st[0].Errors) != 1 ||
		st[0].Years[0] != 2026 || !st[0].LastCheck.Equal(march) || st[1].Files != 0 {
		t.Errorf("status %+v", st)
	}
}

func TestFetcherSoil(t *testing.T) {
	fake, f, store := setup(t)
	ctx := context.Background()
	body := fixture(t, "precipitation/pr_hyras_1_2020_v6-0_de.nc")
	for _, tree := range TreeSpecies {
		dir := fmt.Sprintf("/soil_moisture/%s/2025/", tree)
		fake.put(dir+fmt.Sprintf("grids_germany_daily_soil_moisture_%s_2025_0-30_v1-0.nc", tree), body[:100], modTime)
		fake.put(dir+fmt.Sprintf("grids_germany_daily_soil_moisture_%s_2025_0-30_v1-1.nc", tree), body, modTime)
		fake.put(dir+fmt.Sprintf("grids_germany_daily_soil_moisture_%s_2025_0-10_v2-0.nc", tree), body, modTime)
		fake.missing[fmt.Sprintf("/soil_moisture/%s/2026/", tree)] = true
	}
	res, err := f.Soil(ctx, Weekly(march), DefaultDepth)
	if err != nil {
		t.Fatal(err)
	}
	o := outcomes(res)
	if o["grids_germany_daily_soil_moisture_oak_2025_0-30_v1-1.nc"] != Downloaded || o["oak"] != Missing || len(o) != 8 {
		t.Fatalf("outcomes %v", o)
	}
	recs, _ := store.List(ctx, SourceSoil)
	if len(recs) != 4 || recs[0].Key != "dwd/soil_moisture/beech/grids_germany_daily_soil_moisture_beech_2025_0-30_v1-1.nc" {
		t.Errorf("rows %+v", recs)
	}

	removed, err := f.PruneBefore(ctx, 2026)
	if err != nil || len(removed) != 4 {
		t.Fatalf("pruned %v %v", removed, err)
	}
	rec, _, _ := store.Get(ctx, SourceSoil, removed[0])
	if rec.State != StatePruned {
		t.Errorf("state %s", rec.State)
	}
	if st := Summarize(SourceSoil, recs[:0]); st.Files != 0 || len(st.Years) != 0 {
		t.Errorf("empty status %+v", st)
	}
}

func TestAdoptRegistersCachedFiles(t *testing.T) {
	_, f, store := setup(t)
	ctx := context.Background()
	local := filepath.Join(f.Dir, "hyras/precipitation/pr_hyras_1_2025_v6-0_de.nc")
	if err := os.MkdirAll(filepath.Dir(local), 0o755); err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(local, []byte("old"), 0o644); err != nil {
		t.Fatal(err)
	}
	res, _ := f.Hyras(ctx, Request{Years: []int{2025}})
	if o := outcomes(res)["pr_hyras_1_2025_v6-0_de.nc"]; o != Cached {
		t.Fatalf("outcome %s", o)
	}
	rec, ok, _ := store.Get(ctx, SourceHyras, "dwd/hyras/precipitation/pr_hyras_1_2025_v6-0_de.nc")
	if !ok || rec.SizeBytes != 3 || rec.State != StateOK {
		t.Errorf("record %+v", rec)
	}
}

func TestRequests(t *testing.T) {
	jan := time.Date(2027, 1, 5, 0, 0, 0, 0, time.UTC)
	if r := Weekly(jan); fmt.Sprint(r.Years, r.Refresh) != "[2026 2027] [2026 2027]" {
		t.Errorf("january %v", r)
	}
	if r := Weekly(march); fmt.Sprint(r.Years, r.Refresh) != "[2025 2026] [2026]" {
		t.Errorf("march %v", r)
	}
	if r := Bootstrap(march, FirstYear); len(r.Years) != 13 || r.Years[0] != 2014 {
		t.Errorf("bootstrap %v", r)
	}
}
