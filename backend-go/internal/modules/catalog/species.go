package catalog

import (
	"context"
	"database/sql"
	"net/http"
	"strings"

	"github.com/frederikbeimgraben/kinoko/backend/internal/core/db"
	"github.com/frederikbeimgraben/kinoko/backend/internal/core/enums"
	"github.com/frederikbeimgraben/kinoko/backend/internal/core/paging"
	"github.com/frederikbeimgraben/kinoko/backend/internal/core/problem"
	"github.com/frederikbeimgraben/kinoko/backend/internal/core/web"
	"github.com/frederikbeimgraben/kinoko/backend/internal/fn"
)

// listSpecies selects candidates in SQL, then matches colour, size and
// months in memory, then cuts the page.
func (m *Module) listSpecies(r *http.Request) (web.Response, error) {
	ctx := r.Context()
	page, err := paging.FromRequest(r, paging.SmallLimit)
	if err != nil {
		return nil, err
	}
	selection, err := parseSelection(r.URL)
	if err != nil {
		return nil, err
	}
	query := r.URL.Query()
	var taxonIDs []db.ID
	if raw := lastValue(query, "taxonId"); raw != "" {
		root, err := db.ParseID(raw)
		if err != nil {
			return nil, problem.InvalidField("taxonId", "uuid_parsing")
		}
		taxonIDs, err = subtreeIDs(ctx, m.deps.DB, root)
		if err != nil {
			return nil, err
		}
	}
	candidates, err := searchSpecies(ctx, m.deps.DB, lastValue(query, "q"), taxonIDs, selection)
	if err != nil {
		return nil, err
	}
	ids := speciesIDs(candidates)
	child, err := loadChildren(ctx, m.deps.DB, ids, ids)
	if err != nil {
		return nil, err
	}
	terms, err := termLookup(ctx, m.deps.DB)
	if err != nil {
		return nil, err
	}
	names, err := loadTaxonNames(ctx, m.deps.DB)
	if err != nil {
		return nil, err
	}
	matched := fn.Filter(candidates, func(s speciesRow) bool {
		return Match(facetsOf(s, child, terms, names), selection)
	})
	return web.OK(paging.Slice(fn.Map(matched, func(s speciesRow) Summary {
		return summaryOf(s, leadOf(child, s.ID), names)
	}), page)), nil
}

func searchSpecies(ctx context.Context, q db.Querier, text string, taxonIDs []db.ID, s Selection) ([]speciesRow, error) {
	where := []string{}
	args := []any{}
	add := func(clause string, values ...any) {
		where = append(where, clause)
		args = append(args, values...)
	}
	if text != "" {
		like := "%" + text + "%"
		add(`(lower(name) LIKE lower(?) OR lower(latin_name) LIKE lower(?) OR id IN
			(SELECT species_id FROM species_name WHERE lower(name) LIKE lower(?)))`, like, like, like)
	}
	if taxonIDs != nil {
		clause, values := scope("taxon_id", taxonIDs)
		add(clause, values...)
	}
	if len(s.Edibility) > 0 {
		add("edibility IN ("+db.Placeholders(len(s.Edibility))+")", db.Args(s.Edibility)...)
	}
	if len(s.Hymenium) > 0 {
		add("hymenium_type IN ("+db.Placeholders(len(s.Hymenium))+")", db.Args(s.Hymenium)...)
	}
	if len(s.CapShape) > 0 {
		in := db.Placeholders(len(s.CapShape))
		add("(cap_shape_young IN ("+in+") OR cap_shape_old IN ("+in+"))",
			append(db.Args(s.CapShape), db.Args(s.CapShape)...)...)
	}
	if len(s.Terms) > 0 {
		add(`id IN (SELECT species_id FROM species_term WHERE term_id IN (`+db.Placeholders(len(s.Terms))+`)
			GROUP BY species_id HAVING count(DISTINCT term_id) = ?)`, append(db.Args(s.Terms), len(s.Terms))...)
	}
	query := "SELECT " + speciesCols + " FROM species"
	if len(where) > 0 {
		query += " WHERE " + strings.Join(where, " AND ")
	}
	return db.All(ctx, q, scanSpecies, query+" ORDER BY name", args...)
}

func (m *Module) getSpecies(r *http.Request) (web.Response, error) {
	row, err := speciesBySlug(r.Context(), m.deps.DB, r.PathValue("slug"))
	if err != nil {
		return nil, err
	}
	profile, err := loadOne(r.Context(), m.deps.DB, row)
	if err != nil {
		return nil, err
	}
	return web.OK(profile), nil
}

// loadOne reads the full profile of one species with its reactions.
func loadOne(ctx context.Context, q db.Querier, row speciesRow) (Species, error) {
	ids := []db.ID{row.ID}
	child, err := loadChildren(ctx, q, ids, ids)
	if err != nil {
		return Species{}, err
	}
	terms, err := termLookup(ctx, q)
	if err != nil {
		return Species{}, err
	}
	names, err := loadTaxonNames(ctx, q)
	if err != nil {
		return Species{}, err
	}
	targets, err := loadTargets(ctx, q, row.ID, child.lookalikes[row.ID])
	if err != nil {
		return Species{}, err
	}
	profile := assemble(row, child, terms, targets, names)
	if row.UpdatedByID != nil {
		editor, _, err := db.Maybe(ctx, q, func(s db.Scanner) (*string, error) {
			var name *string
			return name, s.Scan(&name)
		}, "SELECT name FROM user WHERE id = ?", *row.UpdatedByID)
		if err != nil {
			return Species{}, err
		}
		profile.UpdatedByName = editor
	}
	reactions, err := loadReactions(ctx, q, row.ID)
	if err != nil {
		return Species{}, err
	}
	profile.Reactions = &reactions
	return profile, nil
}

// loadTargets reads the other species of the pairs of one species.
func loadTargets(ctx context.Context, q db.Querier, self db.ID, rows []lookalikeRow) (map[db.ID]lookalikeTarget, error) {
	others := distinct(fn.Map(rows, func(r lookalikeRow) db.ID {
		if r.A == self {
			return r.B
		}
		return r.A
	}))
	if len(others) == 0 {
		return map[db.ID]lookalikeTarget{}, nil
	}
	in := db.Placeholders(len(others))
	species, err := db.All(ctx, q, scanSpecies, "SELECT "+speciesCols+" FROM species WHERE id IN ("+in+")", db.Args(others)...)
	if err != nil {
		return nil, err
	}
	colours, err := db.All(ctx, q, scanColour, `SELECT species_id, part, name, hex FROM species_colour
		WHERE species_id IN (`+in+`) AND part = ? ORDER BY species_id, position`,
		append(db.Args(others), enums.BodyPartCap)...)
	if err != nil {
		return nil, err
	}
	return targetsOf(species, fn.GroupBy(colours, func(c colourRow) db.ID { return c.SpeciesID })), nil
}

func (m *Module) createSpecies(r *http.Request) (web.Response, error) {
	user, _, err := m.deps.Auth.CurrentUser(r)
	if err != nil {
		return nil, err
	}
	body, err := web.Decode[speciesWrite](r)
	if err != nil {
		return nil, err
	}
	ctx := r.Context()
	profile, err := db.InTxValue(ctx, m.deps.DB, func(tx *sql.Tx) (Species, error) {
		slug := SlugifyLatin(body.ScientificName)
		taken, err := db.Scalar[int](ctx, tx, "SELECT count(*) FROM species WHERE slug = ?", slug)
		if err != nil {
			return Species{}, err
		}
		if taken > 0 {
			return Species{}, problem.Conflict("slug_taken", "")
		}
		id := db.NewID()
		if err := insertSpecies(ctx, tx, id, slug, body, user.ID, m.now()); err != nil {
			return Species{}, err
		}
		if err := replaceChildren(ctx, tx, id, body); err != nil {
			return Species{}, err
		}
		row, err := speciesBySlug(ctx, tx, slug)
		if err != nil {
			return Species{}, err
		}
		return loadOne(ctx, tx, row)
	})
	if err != nil {
		return nil, err
	}
	return web.Created(profile), nil
}

func (m *Module) replaceSpecies(r *http.Request) (web.Response, error) {
	user, _, err := m.deps.Auth.CurrentUser(r)
	if err != nil {
		return nil, err
	}
	body, err := web.Decode[speciesWrite](r)
	if err != nil {
		return nil, err
	}
	ctx := r.Context()
	profile, err := db.InTxValue(ctx, m.deps.DB, func(tx *sql.Tx) (Species, error) {
		row, err := speciesBySlug(ctx, tx, r.PathValue("slug"))
		if err != nil {
			return Species{}, err
		}
		if err := updateSpecies(ctx, tx, row.ID, body, user.ID, m.now()); err != nil {
			return Species{}, err
		}
		if err := replaceChildren(ctx, tx, row.ID, body); err != nil {
			return Species{}, err
		}
		row, err = speciesBySlug(ctx, tx, row.Slug)
		if err != nil {
			return Species{}, err
		}
		return loadOne(ctx, tx, row)
	})
	if err != nil {
		return nil, err
	}
	return web.OK(profile), nil
}

func (m *Module) deleteSpecies(r *http.Request) (web.Response, error) {
	ctx := r.Context()
	err := db.InTx(ctx, m.deps.DB, func(tx *sql.Tx) error {
		row, err := speciesBySlug(ctx, tx, r.PathValue("slug"))
		if err != nil {
			return err
		}
		finds, err := db.Scalar[int](ctx, tx,
			"SELECT count(*) FROM find WHERE species_id = ? AND deleted_at IS NULL", row.ID)
		if err != nil {
			return err
		}
		photos, err := db.Scalar[int](ctx, tx, "SELECT count(*) FROM photo WHERE species_id = ?", row.ID)
		if err != nil {
			return err
		}
		if finds > 0 || photos > 0 {
			return problem.Conflict("in_use", "")
		}
		_, err = tx.ExecContext(ctx, "DELETE FROM species WHERE id = ?", row.ID)
		return err
	})
	if err != nil {
		return nil, err
	}
	return web.Empty(http.StatusNoContent), nil
}

type forecastWrite struct {
	Enabled bool `json:"enabled"`
}

// setForecast changes updated_at only when the value changes, as the old
// service did. The bundle tag depends on it.
func (m *Module) setForecast(r *http.Request) (web.Response, error) {
	body, err := web.Decode[forecastWrite](r)
	if err != nil {
		return nil, err
	}
	ctx := r.Context()
	profile, err := db.InTxValue(ctx, m.deps.DB, func(tx *sql.Tx) (Species, error) {
		row, err := speciesBySlug(ctx, tx, r.PathValue("slug"))
		if err != nil {
			return Species{}, err
		}
		if row.ForecastEnabled != body.Enabled {
			if _, err := tx.ExecContext(ctx, "UPDATE species SET forecast_enabled = ?, updated_at = ? WHERE id = ?",
				body.Enabled, m.now(), row.ID); err != nil {
				return Species{}, err
			}
			if row, err = speciesBySlug(ctx, tx, row.Slug); err != nil {
				return Species{}, err
			}
		}
		return loadOne(ctx, tx, row)
	})
	if err != nil {
		return nil, err
	}
	return web.OK(profile), nil
}

// SpeciesCounts are the numbers of a species for the editors.
type SpeciesCounts struct {
	Records int `json:"records"`
	Finds   int `json:"finds"`
	Photos  int `json:"photos"`
}

func (m *Module) speciesCounts(r *http.Request) (web.Response, error) {
	row, err := speciesBySlug(r.Context(), m.deps.DB, r.PathValue("slug"))
	if err != nil {
		return nil, err
	}
	counts, err := CountsFor(r.Context(), m.deps.DB, []db.ID{row.ID})
	if err != nil {
		return nil, err
	}
	return web.OK(counts[row.ID]), nil
}

type idCount struct {
	ID    db.ID
	Count int
}

func scanIDCount(s db.Scanner) (idCount, error) {
	var c idCount
	return c, s.Scan(&c.ID, &c.Count)
}

func countMap(rows []idCount) map[db.ID]int {
	return fn.Reduce(rows, map[db.ID]int{}, func(acc map[db.ID]int, c idCount) map[db.ID]int {
		acc[c.ID] = c.Count
		return acc
	})
}

// CountsFor gives records, finds and photos of each species. The records
// come from the finished run with the latest queued_at.
func CountsFor(ctx context.Context, q db.Querier, ids []db.ID) (map[db.ID]SpeciesCounts, error) {
	if len(ids) == 0 {
		return map[db.ID]SpeciesCounts{}, nil
	}
	in := db.Placeholders(len(ids))
	args := db.Args(ids)
	records, err := db.All(ctx, q, scanIDCount, `SELECT s.species_id, s.record_count
		FROM pipeline_run_species s JOIN pipeline_run r ON r.id = s.run_id
		WHERE s.species_id IN (`+in+`) AND s.state = 'finished' ORDER BY r.queued_at`, args...)
	if err != nil {
		return nil, err
	}
	finds, err := db.All(ctx, q, scanIDCount, `SELECT species_id, count(*) FROM find
		WHERE species_id IN (`+in+`) AND deleted_at IS NULL GROUP BY species_id`, args...)
	if err != nil {
		return nil, err
	}
	photos, err := db.All(ctx, q, scanIDCount, `SELECT species_id, count(*) FROM photo
		WHERE species_id IN (`+in+`) GROUP BY species_id`, args...)
	if err != nil {
		return nil, err
	}
	r, f, p := countMap(records), countMap(finds), countMap(photos)
	return fn.Reduce(ids, map[db.ID]SpeciesCounts{}, func(acc map[db.ID]SpeciesCounts, id db.ID) map[db.ID]SpeciesCounts {
		acc[id] = SpeciesCounts{Records: r[id], Finds: f[id], Photos: p[id]}
		return acc
	}), nil
}
