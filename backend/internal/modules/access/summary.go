package access

import (
	"bytes"
	"context"
	"encoding/json"
	"net/http"
	"strconv"

	"github.com/frederikbeimgraben/kinoko/backend/internal/core/auth"
	"github.com/frederikbeimgraben/kinoko/backend/internal/core/db"
	"github.com/frederikbeimgraben/kinoko/backend/internal/core/problem"
	"github.com/frederikbeimgraben/kinoko/backend/internal/core/web"
	"github.com/frederikbeimgraben/kinoko/backend/internal/fn"
)

// SummaryItem is one count of the admin overview. The overview shows it only
// to a viewer with the permission.
type SummaryItem struct {
	Permission string
	Key        string
	Query      string
}

// SummaryItems lists the counts of the overview in answer order. Add a new
// count here.
var SummaryItems = []SummaryItem{
	{"text.edit", "texts", `SELECT count(DISTINCT "key") FROM text`},
	{"text.edit", "glossary", "SELECT count(*) FROM glossary_entry"},
	{"image.review", "photos", "SELECT count(*) FROM photo"},
	{"image.review", "photosPending", "SELECT count(*) FROM photo WHERE state = 'submitted'"},
	{"species.edit", "species", "SELECT count(*) FROM species"},
	{"species.edit", "terms", "SELECT count(*) FROM term"},
	{"role.manage", "roles", "SELECT count(*) FROM role"},
	{"role.manage", "permissions", "SELECT count(*) FROM permission"},
	{"role.assign", "people", "SELECT count(*) FROM user"},
	{"group.manage", "groups", `SELECT count(*) FROM "group"`},
	{"group.manage", "groupMembers", "SELECT count(*) FROM group_member"},
	{"find.review", "finds", "SELECT count(*) FROM find WHERE deleted_at IS NULL"},
	{"find.review", "findsPending", "SELECT count(*) FROM find WHERE deleted_at IS NULL AND review_state = 'open'"},
	{"run.manage", "runs", "SELECT count(*) FROM pipeline_run"},
	{"run.manage", "runsRunning", "SELECT count(*) FROM pipeline_run WHERE state IN ('queued', 'running')"},
	// The kinds in this query are sources.RequiredKinds. Keep the two lists equal.
	{"data.manage", "dataSourcesMissing", `WITH required(kind) AS (VALUES ('trees-grid'), ('tree-scales'), ('site-grid'), ('model-bundle'))
		SELECT count(*) FROM required WHERE NOT EXISTS (SELECT 1 FROM data_source_version v
			WHERE v.kind = required.kind AND v.active = 1 AND v.state = 'ready')`},
	{"data.manage", "dataSourcesFailed", `SELECT count(*) FROM data_source_version v WHERE v.state = 'failed'
		AND v.version = (SELECT max(w.version) FROM data_source_version w
			WHERE w.kind = v.kind AND coalesce(w.species_id, '') = coalesce(v.species_id, ''))`},
}

// counted is one key with its count.
type counted struct {
	key   string
	value int64
}

// summary is an ordered JSON object of counts.
type summary []counted

// MarshalJSON keeps the order of the items.
func (s summary) MarshalJSON() ([]byte, error) {
	var b bytes.Buffer
	b.WriteByte('{')
	for i, c := range s {
		if i > 0 {
			b.WriteByte(',')
		}
		key, err := json.Marshal(c.key)
		if err != nil {
			return nil, err
		}
		b.Write(key)
		b.WriteByte(':')
		b.WriteString(strconv.FormatInt(c.value, 10))
	}
	b.WriteByte('}')
	return b.Bytes(), nil
}

// visibleItems gives the items that the viewer may see.
func visibleItems(items []SummaryItem, viewer auth.Viewer) []SummaryItem {
	return fn.Filter(items, func(item SummaryItem) bool { return viewer.May(item.Permission) })
}

func countItems(ctx context.Context, q db.Querier, items []SummaryItem) (summary, error) {
	return fn.MapErr(items, func(item SummaryItem) (counted, error) {
		value, err := db.Scalar[int64](ctx, q, item.Query)
		return counted{key: item.Key, value: value}, err
	})
}

func (m *Module) getAdminSummary(r *http.Request) (web.Response, error) {
	viewer, err := auth.From(r)
	if err != nil {
		return nil, err
	}
	if err := auth.RequireSignIn(viewer); err != nil {
		return nil, err
	}
	if len(viewer.Rights) == 0 {
		return nil, problem.Forbidden()
	}
	out, err := countItems(r.Context(), m.deps.DB, visibleItems(SummaryItems, viewer))
	if err != nil {
		return nil, err
	}
	return web.OK(out), nil
}

// speciesCounts are the counts of one species for the species admin.
type speciesCounts struct {
	SpeciesID db.ID `json:"speciesId"`
	Records   int64 `json:"records"`
	Finds     int64 `json:"finds"`
	Photos    int64 `json:"photos"`
}

type speciesCountList struct {
	Items []speciesCounts `json:"items"`
}

// countsBy reads (species id, count) rows into a map. A later row wins.
func countsBy(ctx context.Context, q db.Querier, query string) (map[db.ID]int64, error) {
	rows, err := db.All(ctx, q, scanKeyed[int64], query)
	if err != nil {
		return nil, err
	}
	return fn.Reduce(rows, map[db.ID]int64{}, func(acc map[db.ID]int64, k keyed[int64]) map[db.ID]int64 {
		acc[k.id] = k.value
		return acc
	}), nil
}

func (m *Module) getAdminSpeciesCounts(r *http.Request) (web.Response, error) {
	ctx := r.Context()
	ids, err := db.Column[db.ID](ctx, m.deps.DB, "SELECT id FROM species")
	if err != nil {
		return nil, err
	}
	records, err := countsBy(ctx, m.deps.DB, `SELECT s.species_id, s.record_count
		FROM pipeline_run_species s JOIN pipeline_run r ON r.id = s.run_id
		WHERE s.species_id IN (SELECT id FROM species) AND s.state = 'finished'
		ORDER BY r.queued_at`)
	if err != nil {
		return nil, err
	}
	finds, err := countsBy(ctx, m.deps.DB, `SELECT species_id, count(*) FROM find
		WHERE species_id IN (SELECT id FROM species) AND deleted_at IS NULL GROUP BY species_id`)
	if err != nil {
		return nil, err
	}
	photos, err := countsBy(ctx, m.deps.DB, `SELECT species_id, count(*) FROM photo
		WHERE species_id IN (SELECT id FROM species) GROUP BY species_id`)
	if err != nil {
		return nil, err
	}
	return web.OK(speciesCountList{Items: fn.Map(ids, func(id db.ID) speciesCounts {
		return speciesCounts{SpeciesID: id, Records: records[id], Finds: finds[id], Photos: photos[id]}
	})}), nil
}
