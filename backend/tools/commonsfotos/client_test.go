package main

import (
	"context"
	"net/http"
	"net/http/httptest"
	"net/url"
	"testing"
	"time"
)

func TestGetJSONWaitsAfterMaxlagAndFailsOnOtherAPIErrors(t *testing.T) {
	answers := []string{`{"error":{"code":"maxlag"}}`, `{"query":{"pages":[]}}`, `{"error":{"code":"badvalue"}}`}
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		w.Header().Set("Retry-After", "5")
		_, _ = w.Write([]byte(answers[0]))
		answers = answers[1:]
	}))
	t.Cleanup(server.Close)
	var waits []time.Duration
	c := &client{http: server.Client(), sleep: func(d time.Duration) { waits = append(waits, d) }}

	var out map[string]any
	if err := c.getJSON(context.Background(), server.URL, url.Values{}, &out); err != nil {
		t.Fatal(err)
	}
	if _, ok := out["query"]; !ok || len(waits) != 1 || waits[0] != 10*time.Second {
		t.Fatalf("answer %v, waits %v", out, waits)
	}
	if err := c.getJSON(context.Background(), server.URL, url.Values{}, &out); err == nil {
		t.Fatal("an API error must fail the request")
	}
}
