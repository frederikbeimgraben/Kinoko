package main

import (
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"strconv"
	"time"
)

// UserAgent identifies the tool to Wikimedia.
const UserAgent = "KinokoBot/0.1 (https://github.com/frederikbeimgraben/Kinoko)"

// client sends polite GET requests: one at a time, with a pause between them.
type client struct {
	http  *http.Client
	pause time.Duration
	last  time.Time
	sleep func(time.Duration)
}

func newClient(pause time.Duration) *client {
	return &client{http: &http.Client{Timeout: 60 * time.Second}, pause: pause, sleep: time.Sleep}
}

// maxTries limits the attempts of one request after the answers 429 and 5xx.
const maxTries = 8

// getJSON reads the JSON answer of base with the query values into out.
func (c *client) getJSON(ctx context.Context, base string, query url.Values, out any) error {
	address := base + "?" + query.Encode()
	wait := 10 * time.Second
	for try := 1; ; try++ {
		if gap := c.pause - time.Since(c.last); gap > 0 {
			c.sleep(gap)
		}
		c.last = time.Now()
		status, retry, body, err := c.fetch(ctx, address)
		if err != nil {
			return err
		}
		if status == http.StatusOK {
			return json.Unmarshal(body, out)
		}
		if (status != http.StatusTooManyRequests && status < 500) || try == maxTries {
			return fmt.Errorf("GET %s: status %d", address, status)
		}
		delay := max(retry, wait)
		_, _ = fmt.Fprintf(errOut, "status %d, wait %s\n", status, delay)
		c.sleep(delay)
		wait *= 2
	}
}

func (c *client) fetch(ctx context.Context, address string) (int, time.Duration, []byte, error) {
	request, err := http.NewRequestWithContext(ctx, http.MethodGet, address, nil)
	if err != nil {
		return 0, 0, nil, err
	}
	request.Header.Set("User-Agent", UserAgent)
	request.Header.Set("Accept", "application/json")
	response, err := c.http.Do(request)
	if err != nil {
		return 0, 0, nil, err
	}
	defer func() { _ = response.Body.Close() }()
	body, err := io.ReadAll(io.LimitReader(response.Body, 16<<20))
	if err != nil {
		return 0, 0, nil, err
	}
	var retry time.Duration
	if seconds, err := strconv.Atoi(response.Header.Get("Retry-After")); err == nil {
		retry = time.Duration(seconds) * time.Second
	}
	return response.StatusCode, retry, body, nil
}
