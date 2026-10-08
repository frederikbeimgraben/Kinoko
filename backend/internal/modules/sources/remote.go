package sources

import (
	"context"
	"net/http"
	"regexp"
	"slices"
	"strconv"
	"time"

	"github.com/frederikbeimgraben/kinoko/backend/internal/core/db"
	"github.com/frederikbeimgraben/kinoko/backend/internal/core/enums"
	"github.com/frederikbeimgraben/kinoko/backend/internal/core/problem"
	"github.com/frederikbeimgraben/kinoko/backend/internal/core/web"
	"github.com/frederikbeimgraben/kinoko/backend/internal/fn"
	"github.com/frederikbeimgraben/kinoko/backend/internal/modules/runs"
)

// RemoteSource describes one public source that the service fetches itself.
type RemoteSource struct {
	ID      string
	URL     string
	Cadence string
	// StaleAfter is the age of the last check after which the cache is stale.
	StaleAfter time.Duration
}

const day = 24 * time.Hour

// RemoteSources lists the public sources in the order of the overview.
var RemoteSources = []RemoteSource{
	{"dwd-hyras", "https://opendata.dwd.de/climate_environment/CDC/grids_germany/daily/hyras_de/", "weekly Mon 03:30 Europe/Berlin", 8 * day},
	{"dwd-soil-moisture", "https://opendata.dwd.de/climate_environment/CDC/grids_germany/daily/soil_moisture/", "weekly Mon 03:30 Europe/Berlin", 8 * day},
	{"gbif-occurrences", "https://api.gbif.org/v1/occurrence/search", "weekly Mon 03:30 Europe/Berlin", 8 * day},
	{"gbif-taxonomy", "https://api.gbif.org/v1/species/match", "monthly, cache 30 days", 31 * day},
	{"p123", "https://123pilzsuche.de/daten/details/", "monthly, cache 90 days", 91 * day},
}

// Cache file states in remote_cache_file. The fetchers write them.
const (
	CacheOK       = "ok"
	CacheFetching = "fetching"
	CacheFailed   = "failed"
)

type cacheFile struct {
	Key       string
	SizeBytes *int64
	FetchedAt *db.Time
	CheckedAt *db.Time
	State     string
	Error     *string
}

type remoteView struct {
	Source        string   `json:"source"`
	URL           string   `json:"url"`
	Cadence       string   `json:"cadence"`
	State         string   `json:"state"`
	Years         []int    `json:"years"`
	Files         int      `json:"files"`
	SizeBytes     int64    `json:"sizeBytes"`
	LastCheckedAt *db.Time `json:"lastCheckedAt"`
	LastChangedAt *db.Time `json:"lastChangedAt"`
	Error         *string  `json:"error"`
}

var yearPattern = regexp.MustCompile(`(?:^|[^0-9])((?:19|20)[0-9]{2})(?:[^0-9]|$)`)

// yearsOf gives the sorted years that the cache keys name.
func yearsOf(keys []string) []int {
	found := fn.FlatMap(keys, func(key string) []int {
		match := yearPattern.FindStringSubmatch(key)
		if match == nil {
			return nil
		}
		year, _ := strconv.Atoi(match[1])
		return []int{year}
	})
	return slices.Compact(slices.Sorted(slices.Values(found)))
}

func latest(times []*db.Time) *db.Time {
	return fn.Reduce(times, (*db.Time)(nil), func(acc *db.Time, t *db.Time) *db.Time {
		if t == nil || (acc != nil && !t.After(acc.Time)) {
			return acc
		}
		return t
	})
}

// summarize builds the view of one source from its cache rows.
func summarize(source RemoteSource, rows []cacheFile, now time.Time) remoteView {
	checked := latest(fn.Map(rows, func(c cacheFile) *db.Time { return c.CheckedAt }))
	failed := fn.Filter(rows, func(c cacheFile) bool { return c.State == CacheFailed })
	state := CacheOK
	switch {
	case len(rows) == 0:
		state = "empty"
	case len(failed) > 0:
		state = CacheFailed
	case fn.Any(rows, func(c cacheFile) bool { return c.State == CacheFetching }):
		state = "bootstrapping"
	case checked == nil || now.Sub(checked.Time) > source.StaleAfter:
		state = "stale"
	}
	var lastError *string
	if len(failed) > 0 {
		lastError = failed[len(failed)-1].Error
	}
	return remoteView{
		Source: source.ID, URL: source.URL, Cadence: source.Cadence, State: state,
		Years:         yearsOf(fn.Map(rows, func(c cacheFile) string { return c.Key })),
		Files:         len(rows),
		SizeBytes:     fn.Reduce(rows, int64(0), func(acc int64, c cacheFile) int64 { return acc + fn.Deref(c.SizeBytes, 0) }),
		LastCheckedAt: checked,
		LastChangedAt: latest(fn.Map(rows, func(c cacheFile) *db.Time { return c.FetchedAt })),
		Error:         lastError,
	}
}

func (m *Module) listRemote(r *http.Request) (web.Response, error) {
	type row struct {
		source string
		file   cacheFile
	}
	rows, err := db.All(r.Context(), m.deps.DB, func(s db.Scanner) (row, error) {
		var x row
		c := &x.file
		return x, s.Scan(&x.source, &c.Key, &c.SizeBytes, &c.FetchedAt, &c.CheckedAt, &c.State, &c.Error)
	}, `SELECT source, "key", size_bytes, fetched_at, checked_at, state, error FROM remote_cache_file
		ORDER BY source, checked_at, "key"`)
	if err != nil {
		return nil, err
	}
	grouped := fn.GroupBy(rows, func(x row) string { return x.source })
	now := m.deps.Now()
	items := fn.Map(RemoteSources, func(source RemoteSource) remoteView {
		return summarize(source, fn.Map(grouped[source.ID], func(x row) cacheFile { return x.file }), now)
	})
	return web.OK(map[string][]remoteView{"items": items}), nil
}

type refreshBody struct {
	FromYear *int `json:"fromYear"`
	ToYear   *int `json:"toYear"`
	Force    bool `json:"force"`
}

func (m *Module) refreshRemote(r *http.Request) (web.Response, error) {
	user, _, err := m.deps.Auth.CurrentUser(r)
	if err != nil {
		return nil, err
	}
	source := r.PathValue("source")
	if !fn.Any(RemoteSources, func(s RemoteSource) bool { return s.ID == source }) {
		return nil, problem.NotFound()
	}
	body, err := readRefresh(r)
	if err != nil {
		return nil, err
	}
	if body.FromYear != nil && body.ToYear != nil && *body.FromYear > *body.ToYear {
		return nil, problem.InvalidField("toYear", "greater_than_equal")
	}
	ctx := r.Context()
	if err := m.noFetchWaiting(ctx); err != nil {
		return nil, err
	}
	run, err := m.runs.Queue(ctx, enums.RunKindFetch, user.ID)
	if err != nil {
		return nil, err
	}
	if _, err := m.deps.DB.ExecContext(ctx, `INSERT INTO remote_fetch_request (run_id, source, from_year, to_year, force)
		VALUES (?, ?, ?, ?, ?)`, run.ID, source, body.FromYear, body.ToYear, body.Force); err != nil {
		return nil, err
	}
	return web.JSON(http.StatusAccepted, runs.Summary{
		ID: run.ID, Kind: run.Kind, State: run.State, QueuedAt: run.QueuedAt, StartedAt: run.StartedAt,
		FinishedAt: run.FinishedAt, TriggeredByID: run.TriggeredByID,
		ProgressDone: run.ProgressDone, ProgressTotal: run.ProgressTotal,
	}), nil
}

func readRefresh(r *http.Request) (refreshBody, error) {
	if r.ContentLength == 0 {
		return refreshBody{}, nil
	}
	return web.Decode[refreshBody](r)
}

func (m *Module) noFetchWaiting(ctx context.Context) error {
	n, err := db.Scalar[int](ctx, m.deps.DB, "SELECT count(*) FROM pipeline_run WHERE kind = ? AND state IN (?, ?)",
		enums.RunKindFetch, enums.RunStateQueued, enums.RunStateRunning)
	if err != nil {
		return err
	}
	if n > 0 {
		return problem.Conflict("run_active", "a fetch run is queued or running")
	}
	return nil
}

// FetchRequest is the parameters of a fetch run.
type FetchRequest struct {
	Source   string
	FromYear *int
	ToYear   *int
	Force    bool
}

// FetchRequestOf gives the parameters of a fetch run. A run without a
// stored request refreshes each source with the weekly rule.
func (m *Module) FetchRequestOf(ctx context.Context, run db.ID) (FetchRequest, bool, error) {
	return db.Maybe(ctx, m.deps.DB, func(s db.Scanner) (FetchRequest, error) {
		var f FetchRequest
		return f, s.Scan(&f.Source, &f.FromYear, &f.ToYear, &f.Force)
	}, "SELECT source, from_year, to_year, force FROM remote_fetch_request WHERE run_id = ?", run)
}
