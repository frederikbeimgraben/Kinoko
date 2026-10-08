package gbif_test

import (
	"context"
	"errors"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/frederikbeimgraben/kinoko/backend/internal/pipeline/occ/gbif"
	"github.com/frederikbeimgraben/kinoko/backend/internal/pipeline/pio"
)

// TestFetchStopsStalledPage checks that a page without bytes fails after
// Idle and not after the much longer RequestTimeout.
func TestFetchStopsStalledPage(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Length", "1000")
		_, _ = w.Write([]byte(`{"count": 3, `))
		w.(http.Flusher).Flush()
		<-r.Context().Done()
	}))
	defer srv.Close()
	f := &gbif.Fetcher{HTTP: srv.Client(), BaseURL: srv.URL, Dir: t.TempDir(), Attempts: 1, Idle: 500 * time.Millisecond}
	done := make(chan error, 1)
	go func() {
		_, err := f.Fetch(context.Background(), gbif.Plan{Years: []int{2025}})
		done <- err
	}()
	select {
	case err := <-done:
		if !errors.Is(err, pio.ErrStalled) {
			t.Fatalf("fetch gives %v, want ErrStalled", err)
		}
	case <-time.After(10 * time.Second):
		t.Fatal("the stalled page blocks the fetch")
	}
}
