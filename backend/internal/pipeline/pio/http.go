package pio

import (
	"context"
	"errors"
	"fmt"
	"io"
	"net/http"
	"sync"
	"time"
)

// Limits of the HTTP client of the data fetchers. A total timeout would cut
// a large download, so the client limits only the waits.
const (
	// HeaderTimeout limits the wait for the response header.
	HeaderTimeout = 2 * time.Minute
	// IdleTimeout limits a transfer that gives no bytes.
	IdleTimeout = 3 * time.Minute
)

// ErrStalled is the cause of a request that the watchdog stops.
var ErrStalled = errors.New("pio: no bytes from the server")

// NewHTTPClient gives a client whose transport waits at most HeaderTimeout
// for the response header. It has no total timeout.
func NewHTTPClient() *http.Client {
	tr := http.DefaultTransport.(*http.Transport).Clone()
	tr.ResponseHeaderTimeout = HeaderTimeout
	return &http.Client{Transport: tr}
}

// Watched gives a copy of client whose requests stop with ErrStalled when
// the server gives no bytes for idle. A nil client is http.DefaultClient.
func Watched(client *http.Client, idle time.Duration) *http.Client {
	if client == nil {
		client = http.DefaultClient
	}
	next := client.Transport
	if next == nil {
		next = http.DefaultTransport
	}
	out := *client
	out.Transport = watchdog{next: next, idle: idle}
	return &out
}

type watchdog struct {
	next http.RoundTripper
	idle time.Duration
}

func (w watchdog) RoundTrip(req *http.Request) (*http.Response, error) {
	ctx, cancel := context.WithCancelCause(req.Context())
	timer := time.AfterFunc(w.idle, func() { cancel(ErrStalled) })
	resp, err := w.next.RoundTrip(req.WithContext(ctx))
	if err != nil {
		timer.Stop()
		cancel(nil)
		return nil, stalled(ctx, err)
	}
	resp.Body = &idleBody{body: resp.Body, ctx: ctx, timer: timer, idle: w.idle, cancel: cancel}
	return resp, nil
}

// idleBody restarts the watchdog timer at each read.
type idleBody struct {
	body   io.ReadCloser
	ctx    context.Context
	timer  *time.Timer
	idle   time.Duration
	cancel context.CancelCauseFunc
	once   sync.Once
}

func (b *idleBody) Read(p []byte) (int, error) {
	b.timer.Reset(b.idle)
	n, err := b.body.Read(p)
	if n > 0 {
		b.timer.Reset(b.idle)
	}
	if err != nil && !errors.Is(err, io.EOF) {
		err = stalled(b.ctx, err)
	}
	return n, err
}

func (b *idleBody) Close() error {
	b.once.Do(func() { b.timer.Stop() })
	err := b.body.Close()
	b.cancel(nil)
	return err
}

// stalled names ErrStalled in err when the watchdog stopped the request.
func stalled(ctx context.Context, err error) error {
	if errors.Is(context.Cause(ctx), ErrStalled) {
		return fmt.Errorf("%w: %w", ErrStalled, err)
	}
	return err
}
