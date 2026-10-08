package gbif_test

import (
	"bufio"
	"bytes"
	"compress/gzip"
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"net/http/httptest"
	"os"
	"strconv"
	"sync"
	"testing"
	"time"
)

// fakeGBIF is an httptest double of the occurrence search API. It holds records
// per year and month and can answer a request with an error status first.
type fakeGBIF struct {
	mu       sync.Mutex
	records  map[[2]int][]map[string]any // (year, month)
	failures []failure                   // used in order, one per request
	requests []string
	server   *httptest.Server
}

type failure struct {
	status     int
	retryAfter string
}

func newFake(t *testing.T) *fakeGBIF {
	f := &fakeGBIF{records: map[[2]int][]map[string]any{}}
	f.server = httptest.NewServer(http.HandlerFunc(f.serve))
	t.Cleanup(f.server.Close)
	return f
}

// add puts n records into a month of a year.
func (f *fakeGBIF) add(year, month, n int, tag string) {
	for i := range n {
		id := fmt.Sprintf("%d%02d%05d", year, month, i)
		f.records[[2]int{year, month}] = append(f.records[[2]int{year, month}], map[string]any{
			"key": i, "gbifID": id, "species": "Boletus edulis", "class": "Agaricomycetes",
			"decimalLatitude": 48.5, "decimalLongitude": 9.05, "eventDate": fmt.Sprintf("%d-%02d-03", year, month),
			"year": year, "month": month, "day": 3, "recordedBy": "Anna " + tag, "gadm": map[string]any{"x": 1},
			"issues": []string{},
		})
	}
}

func (f *fakeGBIF) serve(w http.ResponseWriter, r *http.Request) {
	f.mu.Lock()
	defer f.mu.Unlock()
	f.requests = append(f.requests, r.URL.RawQuery)
	if len(f.failures) > 0 {
		fail := f.failures[0]
		f.failures = f.failures[1:]
		if fail.retryAfter != "" {
			w.Header().Set("Retry-After", fail.retryAfter)
		}
		w.WriteHeader(fail.status)
		return
	}
	q := r.URL.Query()
	if q.Get("country") != "DE" || q.Get("taxonKey") != "5" || q.Get("basisOfRecord") != "HUMAN_OBSERVATION" ||
		q.Get("hasCoordinate") != "true" || q.Get("hasGeospatialIssue") != "false" || q.Get("occurrenceStatus") != "PRESENT" ||
		r.Header.Get("User-Agent") == "" {
		http.Error(w, "bad query", http.StatusBadRequest)
		return
	}
	year, _ := strconv.Atoi(q.Get("year"))
	month, _ := strconv.Atoi(q.Get("month"))
	var all []map[string]any
	for m := 1; m <= 12; m++ {
		if month == 0 || month == m {
			all = append(all, f.records[[2]int{year, m}]...)
		}
	}
	limit, _ := strconv.Atoi(q.Get("limit"))
	offset, _ := strconv.Atoi(q.Get("offset"))
	end := min(offset+limit, len(all))
	page := []map[string]any{}
	if offset < len(all) {
		page = all[offset:end]
	}
	json.NewEncoder(w).Encode(map[string]any{
		"offset": offset, "limit": limit, "count": len(all), "endOfRecords": end >= len(all), "results": page,
	})
}

// sleeps records the waits of a fetcher instead of sleeping.
type sleeps struct {
	mu sync.Mutex
	d  []time.Duration
}

func (s *sleeps) sleep(_ context.Context, d time.Duration) error {
	s.mu.Lock()
	defer s.mu.Unlock()
	s.d = append(s.d, d)
	return nil
}

// readLines decodes the lines of a gzipped JSON-Lines file.
func readLines(t *testing.T, path string) []map[string]any {
	t.Helper()
	file, err := os.Open(path)
	if err != nil {
		t.Fatal(err)
	}
	defer file.Close()
	gz, err := gzip.NewReader(file)
	if err != nil {
		t.Fatal(err)
	}
	var out []map[string]any
	sc := bufio.NewScanner(gz)
	for sc.Scan() {
		var m map[string]any
		if err := json.Unmarshal(sc.Bytes(), &m); err != nil {
			t.Fatal(err)
		}
		out = append(out, m)
	}
	return out
}

// gz gives the gzip bytes of the lines.
func gz(t *testing.T, lines ...string) []byte {
	t.Helper()
	var buf bytes.Buffer
	w := gzip.NewWriter(&buf)
	for _, l := range lines {
		w.Write([]byte(l + "\n"))
	}
	if err := w.Close(); err != nil {
		t.Fatal(err)
	}
	return buf.Bytes()
}
