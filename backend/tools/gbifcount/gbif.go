package main

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"net/url"
	"os"
	"strconv"
	"time"

	"github.com/frederikbeimgraben/kinoko/backend/internal/pipeline/occ/gbif"
	"github.com/frederikbeimgraben/kinoko/backend/internal/pipeline/occ/visits"
)

const (
	apiBase   = "https://api.gbif.org/v1"
	userAgent = "KinokoBot/0.1 (https://github.com/frederikbeimgraben/Kinoko)"
	country   = "DE"
	attempts  = 6
	// rateFloor is the shortest wait after a 429. GBIF asks for a pause, not for a fast retry.
	rateFloor = 30 * time.Second
)

// match is the part of the species/match answer that the tool reads.
type match struct {
	UsageKey   int    `json:"usageKey"`
	SpeciesKey int    `json:"speciesKey"`
	Species    string `json:"species"`
	Class      string `json:"class"`
	Rank       string `json:"rank"`
	Status     string `json:"status"`
	MatchType  string `json:"matchType"`
}

// answer is what GBIF gave for one species. Count is -1 without a species match.
type answer struct {
	Latin string `json:"latin"`
	Match match  `json:"match"`
	Count int    `json:"count"`
	// Years is the year range of the count, "2015,2026".
	Years string `json:"years"`
}

type client struct {
	http  *http.Client
	pause time.Duration
}

func newClient(pause time.Duration) *client {
	return &client{http: &http.Client{Timeout: 2 * time.Minute}, pause: pause}
}

// ask matches the Latin name and counts the records of the species key with the filter of occ.TrainingSet.
func (c *client) ask(ctx context.Context, latin string, year int) (answer, error) {
	a := answer{Latin: latin, Count: -1, Years: fmt.Sprintf("%d,%d", visits.MinYear, year)}
	q := url.Values{"name": {latin}, "kingdom": {"Fungi"}}
	if err := c.get(ctx, apiBase+"/species/match?"+q.Encode(), &a.Match); err != nil {
		return a, err
	}
	if a.Match.SpeciesKey == 0 {
		return a, nil
	}
	all, err := c.count(ctx, a.Match.SpeciesKey, a.Years, "")
	if err != nil {
		return a, err
	}
	// A record without a coordinate error stays in occ.TrainingSet. Thus remove only the coarse records.
	coarse, err := c.count(ctx, a.Match.SpeciesKey, a.Years, strconv.FormatFloat(visits.MaxUncertainty+0.001, 'f', -1, 64)+",*")
	if err != nil {
		return a, err
	}
	a.Count = all - coarse
	return a, nil
}

func (c *client) count(ctx context.Context, key int, years, uncertainty string) (int, error) {
	q := url.Values{}
	for _, kv := range gbif.Filter(country, key) {
		q.Set(kv[0], kv[1])
	}
	q.Set("year", years)
	q.Set("limit", "0")
	if uncertainty != "" {
		q.Set("coordinateUncertaintyInMeters", uncertainty)
	}
	var page struct {
		Count int `json:"count"`
	}
	err := c.get(ctx, apiBase+"/occurrence/search?"+q.Encode(), &page)
	return page.Count, err
}

// statusError is an answer with a status other than 200.
type statusError struct {
	code       int
	retryAfter string
}

func (e *statusError) Error() string { return "gbif: HTTP " + strconv.Itoa(e.code) }

// get waits the pause, then reads one JSON answer. It tries again after a 429, a 5xx or a network error.
func (c *client) get(ctx context.Context, u string, into any) error {
	delay := 2 * time.Second
	for attempt := 1; ; attempt++ {
		if err := sleep(ctx, c.pause); err != nil {
			return err
		}
		err := c.getOnce(ctx, u, into)
		var status *statusError
		retry := err != nil && (!errors.As(err, &status) || status.code == http.StatusTooManyRequests || status.code >= 500)
		if !retry || attempt == attempts || ctx.Err() != nil {
			return err
		}
		wait := delay
		if status != nil && status.code == http.StatusTooManyRequests {
			after, _ := strconv.Atoi(status.retryAfter)
			wait = max(time.Duration(after)*time.Second, rateFloor) * time.Duration(attempt)
		} else {
			delay *= 2
		}
		fmt.Fprintf(os.Stderr, "retry %d/%d in %v: %v\n", attempt, attempts, wait, err)
		if err := sleep(ctx, wait); err != nil {
			return err
		}
	}
}

func (c *client) getOnce(ctx context.Context, u string, into any) error {
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, u, nil)
	if err != nil {
		return err
	}
	req.Header.Set("User-Agent", userAgent)
	resp, err := c.http.Do(req)
	if err != nil {
		return err
	}
	defer func() { _ = resp.Body.Close() }()
	if resp.StatusCode != http.StatusOK {
		return &statusError{code: resp.StatusCode, retryAfter: resp.Header.Get("Retry-After")}
	}
	return json.NewDecoder(resp.Body).Decode(into)
}

func sleep(ctx context.Context, d time.Duration) error {
	t := time.NewTimer(d)
	defer t.Stop()
	select {
	case <-ctx.Done():
		return ctx.Err()
	case <-t.C:
		return nil
	}
}

// readCache reads the answers of an earlier run. A missing file gives no answers.
func readCache(path string) (map[string]answer, error) {
	out := map[string]answer{}
	if path == "" {
		return out, nil
	}
	body, err := os.ReadFile(path)
	if errors.Is(err, os.ErrNotExist) {
		return out, nil
	}
	if err != nil {
		return nil, err
	}
	return out, json.Unmarshal(body, &out)
}

func writeCache(path string, answers map[string]answer) error {
	if path == "" {
		return nil
	}
	body, err := json.MarshalIndent(answers, "", "  ")
	if err != nil {
		return err
	}
	return os.WriteFile(path, body, 0o644)
}
