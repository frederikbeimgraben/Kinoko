package pio

import (
	"errors"
	"io"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"
)

func TestWatchedStopsStalledBody(t *testing.T) {
	release := make(chan struct{})
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		w.Header().Set("Content-Length", "100")
		_, _ = w.Write([]byte("start"))
		w.(http.Flusher).Flush()
		<-release
	}))
	defer srv.Close()
	defer close(release)
	resp, err := Watched(srv.Client(), 500*time.Millisecond).Get(srv.URL)
	if err != nil {
		t.Fatal(err)
	}
	defer func() { _ = resp.Body.Close() }()
	if _, err := io.ReadAll(resp.Body); !errors.Is(err, ErrStalled) {
		t.Fatalf("read gives %v, want ErrStalled", err)
	}
}

func TestWatchedKeepsSlowSteadyBody(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		for range 10 {
			_, _ = w.Write([]byte("x"))
			w.(http.Flusher).Flush()
			time.Sleep(100 * time.Millisecond)
		}
	}))
	defer srv.Close()
	resp, err := Watched(srv.Client(), 500*time.Millisecond).Get(srv.URL)
	if err != nil {
		t.Fatal(err)
	}
	defer func() { _ = resp.Body.Close() }()
	if body, err := io.ReadAll(resp.Body); err != nil || string(body) != "xxxxxxxxxx" {
		t.Fatalf("read gives %q, %v", body, err)
	}
}

func TestWatchedStopsMissingHeader(t *testing.T) {
	release := make(chan struct{})
	srv := httptest.NewServer(http.HandlerFunc(func(http.ResponseWriter, *http.Request) { <-release }))
	defer srv.Close()
	defer close(release)
	if _, err := Watched(srv.Client(), 500*time.Millisecond).Get(srv.URL); !errors.Is(err, ErrStalled) {
		t.Fatalf("get gives %v, want ErrStalled", err)
	}
}
