package dwd

import (
	"cmp"
	"context"
	"slices"
	"sync"
	"time"
)

// File states of a CacheRecord.
const (
	StateOK     = "ok"     // The file is in the cache and was current at CheckedAt.
	StateFailed = "failed" // The last fetch failed. Error tells why.
	StatePruned = "pruned" // The retention removed the file. A fetch of its year gets it again.
)

// CacheRecord is one row of remote_cache_file. Key is the path under PILZE_DATA/cache.
// A zero time means NULL.
type CacheRecord struct {
	Source       string
	Key          string
	URL          string
	ETag         string
	LastModified string
	SizeBytes    int64
	SHA256       string
	FetchedAt    time.Time
	CheckedAt    time.Time
	State        string
	Error        string
}

// CacheStore keeps the bookkeeping of the cached files. SQLStore writes the
// table remote_cache_file; MemStore keeps the rows in memory.
type CacheStore interface {
	Get(ctx context.Context, source, key string) (CacheRecord, bool, error)
	Put(ctx context.Context, rec CacheRecord) error
	Delete(ctx context.Context, source, key string) error
	List(ctx context.Context, source string) ([]CacheRecord, error)
}

// MemStore is a CacheStore in memory, for tests and for runs without a database.
type MemStore struct {
	mu   sync.Mutex
	rows map[[2]string]CacheRecord
}

// NewMemStore returns an empty MemStore.
func NewMemStore() *MemStore { return &MemStore{rows: map[[2]string]CacheRecord{}} }

// Get returns the row of source and key.
func (m *MemStore) Get(_ context.Context, source, key string) (CacheRecord, bool, error) {
	m.mu.Lock()
	defer m.mu.Unlock()
	rec, ok := m.rows[[2]string{source, key}]
	return rec, ok, nil
}

// Put inserts or replaces the row of rec.Source and rec.Key.
func (m *MemStore) Put(_ context.Context, rec CacheRecord) error {
	m.mu.Lock()
	defer m.mu.Unlock()
	m.rows[[2]string{rec.Source, rec.Key}] = rec
	return nil
}

// Delete removes the row of source and key.
func (m *MemStore) Delete(_ context.Context, source, key string) error {
	m.mu.Lock()
	defer m.mu.Unlock()
	delete(m.rows, [2]string{source, key})
	return nil
}

// List returns the rows of source, sorted by key.
func (m *MemStore) List(_ context.Context, source string) ([]CacheRecord, error) {
	m.mu.Lock()
	defer m.mu.Unlock()
	out := []CacheRecord{}
	for k, rec := range m.rows {
		if k[0] == source {
			out = append(out, rec)
		}
	}
	slices.SortFunc(out, func(a, b CacheRecord) int { return cmp.Compare(a.Key, b.Key) })
	return out, nil
}

// RemoteStatus is the state of one remote source for the admin UI (section 7.6, panel 4).
type RemoteStatus struct {
	Source     string    `json:"source"`
	Files      int       `json:"files"`
	SizeBytes  int64     `json:"sizeBytes"`
	Years      []int     `json:"years"`
	LastCheck  time.Time `json:"lastCheck"`
	LastChange time.Time `json:"lastChange"`
	Failed     int       `json:"failed"`
	Errors     []string  `json:"errors"`
}

// Summarize folds the rows of one source into its status. Pruned rows count
// in no total. The year of each file comes from its key.
func Summarize(source string, recs []CacheRecord) RemoteStatus {
	st := RemoteStatus{Source: source, Years: []int{}, Errors: []string{}}
	years := map[int]bool{}
	for _, r := range recs {
		if r.CheckedAt.After(st.LastCheck) {
			st.LastCheck = r.CheckedAt
		}
		switch r.State {
		case StateOK:
			st.Files++
			st.SizeBytes += r.SizeBytes
			if r.FetchedAt.After(st.LastChange) {
				st.LastChange = r.FetchedAt
			}
			if y, ok := YearOf(r.Key); ok {
				years[y] = true
			}
		case StateFailed:
			st.Failed++
			st.Errors = append(st.Errors, r.Key+": "+r.Error)
		}
	}
	for y := range years {
		st.Years = append(st.Years, y)
	}
	slices.Sort(st.Years)
	return st
}
