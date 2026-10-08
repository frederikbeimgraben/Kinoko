package gbif

import (
	"context"
	"errors"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"strconv"
	"strings"
	"time"
)

// Constants of gbif_fetch.py.
const (
	// API is the occurrence search endpoint.
	API = "https://api.gbif.org/v1/occurrence/search"
	// FungiTaxonKey is the GBIF key of the kingdom Fungi.
	FungiTaxonKey = 5
	// PageLimit is the number of records of one page.
	PageLimit = 300
	// MaxOffset is the largest offset that the search API serves.
	MaxOffset = 100_000
	// MonthThreshold splits a year into months above this record count.
	MonthThreshold = 20_000
	// Attempts is the number of tries of one request.
	Attempts = 10
	// Pause is the wait between two pages.
	Pause = 400 * time.Millisecond
	// RequestTimeout limits one request.
	RequestTimeout = 120 * time.Second
	// UserAgent names the client to GBIF.
	UserAgent = "pilze-research/0.1 (fungal fruiting phenology; +https://gbif.org)"
)

// firstDelay is the wait after the first failure that is not a 429; it doubles after each failure.
const firstDelay = 2 * time.Second

// minRateWait is the floor of the wait after a 429. GBIF sends Retry-After: 3 but refuses longer.
const minRateWait = 30 * time.Second

// StatusError is an HTTP answer with a status other than 2xx.
type StatusError struct {
	Code       int
	RetryAfter string
}

func (e *StatusError) Error() string { return fmt.Sprintf("gbif: HTTP %d", e.Code) }

// param is one query parameter. A list keeps the order of gbif_fetch.base_params.
type param struct{ key, value string }

func encode(params []param) string {
	parts := make([]string, len(params))
	for i, p := range params {
		parts[i] = url.QueryEscape(p.key) + "=" + url.QueryEscape(p.value)
	}
	return strings.Join(parts, "&")
}

// page is one answer of the search API.
type page struct {
	Count        int
	EndOfRecords bool
	Results      []map[string]any
}

// get sends one request and retries as gbif_fetch.request: after a 429 it waits
// max(Retry-After, 30 s) times the attempt, after another failure 2 s, doubled each time.
func (f *Fetcher) get(ctx context.Context, params []param) (page, error) {
	u := f.base() + "?" + encode(params)
	delay := firstDelay
	for attempt := 1; ; attempt++ {
		p, err := f.getOnce(ctx, u)
		if err == nil {
			return p, nil
		}
		var decode *decodeError
		if attempt == f.attempts() || errors.As(err, &decode) || ctx.Err() != nil {
			return page{}, err
		}
		var status *StatusError
		wait := delay
		if errors.As(err, &status) && status.Code == http.StatusTooManyRequests {
			wait = rateWait(status.RetryAfter, attempt)
			f.logf("    rate limited, wait %.0fs (attempt %d/%d)", wait.Seconds(), attempt, f.attempts())
		} else {
			f.logf("    retry %d/%d after %v", attempt, f.attempts(), err)
			delay *= 2
		}
		if err := f.sleep(ctx, wait); err != nil {
			return page{}, err
		}
	}
}

// rateWait treats Retry-After as a floor, as gbif_fetch.request does. Only a plain digit string counts.
func rateWait(header string, attempt int) time.Duration {
	suggested := 0.0
	if header != "" && strings.Trim(header, "0123456789") == "" {
		suggested, _ = strconv.ParseFloat(header, 64)
	}
	return time.Duration(max(suggested, minRateWait.Seconds()) * float64(attempt) * float64(time.Second))
}

// decodeError is a body that is not valid JSON. Python does not retry it.
type decodeError struct{ err error }

func (e *decodeError) Error() string { return "gbif: decode: " + e.err.Error() }
func (e *decodeError) Unwrap() error { return e.err }

func (f *Fetcher) getOnce(ctx context.Context, u string) (page, error) {
	ctx, cancel := context.WithTimeout(ctx, RequestTimeout)
	defer cancel()
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, u, nil)
	if err != nil {
		return page{}, err
	}
	req.Header.Set("User-Agent", UserAgent)
	resp, err := f.client().Do(req)
	if err != nil {
		return page{}, err
	}
	defer func() { _ = resp.Body.Close() }()
	if resp.StatusCode < 200 || resp.StatusCode > 299 {
		// The status gives the error, so a failed drain of the body is not important.
		_, _ = io.Copy(io.Discard, io.LimitReader(resp.Body, 1<<16))
		return page{}, &StatusError{Code: resp.StatusCode, RetryAfter: resp.Header.Get("Retry-After")}
	}
	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return page{}, err
	}
	return decodePage(body)
}

func decodePage(body []byte) (page, error) {
	obj, err := DecodeObject(body)
	if err != nil {
		return page{}, &decodeError{err}
	}
	var p page
	if n, ok := obj["count"].(int64); ok {
		p.Count = int(n)
	}
	p.EndOfRecords, _ = obj["endOfRecords"].(bool)
	results, _ := obj["results"].([]any)
	for _, r := range results {
		if m, ok := r.(map[string]any); ok {
			p.Results = append(p.Results, m)
		}
	}
	return p, nil
}
