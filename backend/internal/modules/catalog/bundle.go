package catalog

import (
	"context"
	"crypto/sha256"
	"encoding/hex"
	"fmt"
	"net/http"
	"sync"
	"sync/atomic"
	"time"

	"github.com/frederikbeimgraben/kinoko/backend/internal/core/db"
	"github.com/frederikbeimgraben/kinoko/backend/internal/core/web"
	"github.com/frederikbeimgraben/kinoko/backend/internal/fn"
)

// bundleShape changes when the form of the bundle changes. A new value
// makes the clients drop the bundles in their caches.
const bundleShape = 3

// bundleCache holds the built bundle of one tag. A build takes more than
// a second, so requests wait for the first build and do not build again.
type bundleCache struct {
	mu     sync.Mutex
	tag    string
	body   []byte
	builds atomic.Int64
}

func (c *bundleCache) get(tag string, build func() ([]byte, error)) ([]byte, error) {
	c.mu.Lock()
	defer c.mu.Unlock()
	if c.body != nil && c.tag == tag {
		return c.body, nil
	}
	body, err := build()
	if err != nil {
		return nil, err
	}
	c.tag, c.body = tag, body
	c.builds.Add(1)
	return body, nil
}

func (c *bundleCache) forget() {
	c.mu.Lock()
	defer c.mu.Unlock()
	c.tag, c.body = "", nil
	c.builds.Store(0)
}

// Bundle is the whole catalogue in one answer.
type Bundle struct {
	Items           []Species        `json:"items"`
	StandardColours []StandardColour `json:"standardColours"`
	Facets          *Axes            `json:"facets"`
}

// isoNaive gives the Python isoformat of a time without a zone.
func isoNaive(t time.Time) string {
	if t.Nanosecond() == 0 {
		return t.UTC().Format("2006-01-02T15:04:05")
	}
	return t.UTC().Format("2006-01-02T15:04:05.000000")
}

type stamp struct {
	latest *db.Time
	count  int
}

func (s stamp) iso() string {
	if s.latest == nil {
		return ""
	}
	return isoNaive(s.latest.Time)
}

// etagOf builds the tag from the species, the approved photos and the reactions.
func etagOf(rows []speciesRow, photos stamp, reactions int) string {
	species := stamp{count: len(rows)}
	for _, r := range rows {
		if species.latest == nil || r.UpdatedAt.After(species.latest.Time) {
			species.latest = &r.UpdatedAt
		}
	}
	raw := fmt.Sprintf("%d:%d:%s:%d:%s:%d", bundleShape, species.count, species.iso(), photos.count, photos.iso(), reactions)
	sum := sha256.Sum256([]byte(raw))
	return `W/"` + hex.EncodeToString(sum[:])[:16] + `"`
}

func photoStamp(ctx context.Context, q db.Querier) (stamp, error) {
	var s stamp
	err := q.QueryRowContext(ctx,
		"SELECT max(updated_at), count(id) FROM photo WHERE state = 'approved'").Scan(&s.latest, &s.count)
	return s, err
}

func (m *Module) currentTag(ctx context.Context) ([]speciesRow, string, error) {
	rows, err := allSpecies(ctx, m.deps.DB)
	if err != nil {
		return nil, "", err
	}
	photos, err := photoStamp(ctx, m.deps.DB)
	if err != nil {
		return nil, "", err
	}
	reactions, err := db.Scalar[int](ctx, m.deps.DB, "SELECT count(*) FROM species_reaction")
	if err != nil {
		return nil, "", err
	}
	return rows, etagOf(rows, photos, reactions), nil
}

func (m *Module) buildBundle(ctx context.Context, rows []speciesRow) ([]byte, error) {
	q := m.deps.DB
	child, err := loadChildren(ctx, q, nil, speciesIDs(rows))
	if err != nil {
		return nil, err
	}
	terms, err := termLookup(ctx, q)
	if err != nil {
		return nil, err
	}
	names, err := loadTaxonNames(ctx, q)
	if err != nil {
		return nil, err
	}
	counts, err := reactionCounts(ctx, q)
	if err != nil {
		return nil, err
	}
	targets := targetsOf(rows, child.colours)
	return web.Encode(Bundle{
		Items: fn.Map(rows, func(s speciesRow) Species {
			out := assemble(s, child, terms, targets, names)
			out.ReactionCount = fn.Ptr(counts[s.ID])
			return out
		}),
		StandardColours: Standard,
		Facets: Catalogue(fn.Map(rows, func(s speciesRow) Facets {
			return facetsOf(s, child, terms, names)
		})),
	})
}

// Warm builds the bundle of the current tag.
func (m *Module) Warm(ctx context.Context) error {
	rows, tag, err := m.currentTag(ctx)
	if err != nil {
		return err
	}
	_, err = m.cache.get(tag, func() ([]byte, error) { return m.buildBundle(ctx, rows) })
	return err
}

func (m *Module) bundle(r *http.Request) (web.Response, error) {
	ctx := r.Context()
	rows, tag, err := m.currentTag(ctx)
	if err != nil {
		return nil, err
	}
	header := http.Header{"Etag": {tag}}
	if r.Header.Get("If-None-Match") == tag {
		return web.EmptyWithHeader(http.StatusNotModified, header), nil
	}
	body, err := m.cache.get(tag, func() ([]byte, error) { return m.buildBundle(ctx, rows) })
	if err != nil {
		return nil, err
	}
	return web.Bytes(http.StatusOK, "application/json", body, header), nil
}
