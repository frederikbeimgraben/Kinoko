package dwd

import (
	"context"
	"crypto/sha256"
	"encoding/hex"
	"errors"
	"fmt"
	"io"
	"net/http"
	"os"
	"path/filepath"
	"time"
)

// statusError is an HTTP answer other than 200 or 304.
type statusError struct {
	url  string
	code int
}

func (e *statusError) Error() string { return fmt.Sprintf("GET %s: HTTP %d", e.url, e.code) }

// permanent tells if a retry cannot help.
func (e *statusError) permanent() bool {
	return e.code >= 400 && e.code < 500 && e.code != http.StatusRequestTimeout && e.code != http.StatusTooManyRequests
}

// validators are the facts of the cached file that a conditional GET sends.
type validators struct {
	etag, lastModified string
	size               int64
}

// fetched is the result of one download.
type fetched struct {
	unchanged          bool
	etag, lastModified string
	size               int64
	sha256             string
}

// validatorsOf takes ETag and Last-Modified from the row. Without a row the
// file time stands in for Last-Modified, because download sets it to that value.
func validatorsOf(prev CacheRecord, file string) *validators {
	info, err := os.Stat(file)
	if err != nil {
		return nil
	}
	v := &validators{etag: prev.ETag, lastModified: prev.LastModified, size: info.Size()}
	if v.etag == "" && v.lastModified == "" {
		v.lastModified = info.ModTime().UTC().Format(http.TimeFormat)
	}
	return v
}

func (f *Fetcher) listing(ctx context.Context, url string) ([]string, error) {
	var names []string
	err := f.retry(ctx, func() error {
		resp, err := f.request(ctx, url, nil)
		if err != nil {
			return err
		}
		defer resp.Body.Close()
		if resp.StatusCode != http.StatusOK {
			return &statusError{url: url, code: resp.StatusCode}
		}
		body, err := io.ReadAll(resp.Body)
		if err != nil {
			return err
		}
		names = ParseListing(string(body))
		return nil
	})
	return names, err
}

// download gets url into target through target.partial. With cond it is a
// conditional GET, and an equal size with an equal ETag or Last-Modified also counts as unchanged.
func (f *Fetcher) download(ctx context.Context, url, target string, cond *validators) (fetched, error) {
	var got fetched
	err := f.retry(ctx, func() error {
		var err error
		got, err = f.downloadOnce(ctx, url, target, cond)
		return err
	})
	return got, err
}

func (f *Fetcher) downloadOnce(ctx context.Context, url, target string, cond *validators) (fetched, error) {
	resp, err := f.request(ctx, url, cond)
	if err != nil {
		return fetched{}, err
	}
	defer resp.Body.Close()
	got := fetched{etag: resp.Header.Get("ETag"), lastModified: resp.Header.Get("Last-Modified")}
	switch {
	case resp.StatusCode == http.StatusNotModified && cond != nil:
		got.unchanged, got.size = true, cond.size
		return got, nil
	case resp.StatusCode != http.StatusOK:
		return fetched{}, &statusError{url: url, code: resp.StatusCode}
	case cond != nil && resp.ContentLength == cond.size && sameValidator(got, cond):
		got.unchanged, got.size = true, cond.size
		return got, nil
	}
	got.size, got.sha256, err = writeAtomic(target, resp.Body, resp.ContentLength)
	if err != nil {
		return fetched{}, err
	}
	if t, err := http.ParseTime(got.lastModified); err == nil {
		_ = os.Chtimes(target, t, t)
	}
	return got, nil
}

func sameValidator(got fetched, cond *validators) bool {
	return (got.etag != "" && got.etag == cond.etag) ||
		(got.lastModified != "" && got.lastModified == cond.lastModified)
}

// writeAtomic streams body to target.partial, checks the length and renames
// the file to target. A failed write removes the partial file.
func writeAtomic(target string, body io.Reader, want int64) (size int64, sum string, err error) {
	if err := os.MkdirAll(filepath.Dir(target), 0o755); err != nil {
		return 0, "", err
	}
	partial := target + ".partial"
	out, err := os.Create(partial)
	if err != nil {
		return 0, "", err
	}
	defer func() {
		if err != nil {
			out.Close()
			os.Remove(partial)
		}
	}()
	hash := sha256.New()
	size, err = io.CopyBuffer(io.MultiWriter(out, hash), body, make([]byte, 1<<20))
	if err != nil {
		return 0, "", err
	}
	if want >= 0 && size != want {
		return 0, "", fmt.Errorf("size mismatch: got %d, want %d", size, want)
	}
	if err = out.Sync(); err != nil {
		return 0, "", err
	}
	if err = out.Close(); err != nil {
		return 0, "", err
	}
	if err = os.Rename(partial, target); err != nil {
		return 0, "", err
	}
	return size, hex.EncodeToString(hash.Sum(nil)), nil
}

func (f *Fetcher) request(ctx context.Context, url string, cond *validators) (*http.Response, error) {
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, url, nil)
	if err != nil {
		return nil, err
	}
	req.Header.Set("User-Agent", orElse(f.UserAgent, DefaultUserAgent))
	if cond != nil {
		if cond.etag != "" {
			req.Header.Set("If-None-Match", cond.etag)
		}
		if cond.lastModified != "" {
			req.Header.Set("If-Modified-Since", cond.lastModified)
		}
	}
	client := f.HTTP
	if client == nil {
		client = http.DefaultClient
	}
	return client.Do(req)
}

// retry runs try up to Attempts times. It stops early on a permanent HTTP error or a done context.
func (f *Fetcher) retry(ctx context.Context, try func() error) error {
	attempts := f.Attempts
	if attempts <= 0 {
		attempts = 4
	}
	var err error
	for attempt := 1; attempt <= attempts; attempt++ {
		if err = try(); err == nil {
			return nil
		}
		var status *statusError
		if ctx.Err() != nil || (errors.As(err, &status) && status.permanent()) || attempt == attempts {
			return err
		}
		f.logf("  retry %d/%d: %v", attempt, attempts, err)
		if err := sleep(ctx, f.backoff(attempt)); err != nil {
			return err
		}
	}
	return err
}

func (f *Fetcher) backoff(attempt int) time.Duration {
	if f.Backoff == nil {
		return time.Duration(attempt) * 5 * time.Second
	}
	return f.Backoff(attempt)
}

func sleep(ctx context.Context, d time.Duration) error {
	if d <= 0 {
		return ctx.Err()
	}
	t := time.NewTimer(d)
	defer t.Stop()
	select {
	case <-ctx.Done():
		return ctx.Err()
	case <-t.C:
		return nil
	}
}
