package catalog

import (
	"context"
	"strings"

	"github.com/frederikbeimgraben/kinoko/backend/internal/core/db"
	"github.com/frederikbeimgraben/kinoko/backend/internal/core/enums"
	"github.com/frederikbeimgraben/kinoko/backend/internal/fn"
	"github.com/frederikbeimgraben/kinoko/backend/internal/shared"
)

// speciesRow is a row of the table species.
type speciesRow struct {
	ID               db.ID
	Slug             string
	Name             string
	LatinName        string
	TaxonID          *db.ID
	Group            enums.Group
	Edibility        enums.Edibility
	Marketable       bool
	ForecastEnabled  bool
	Frequency        *enums.Frequency
	RedList          *enums.RedListStatus
	Description      *string
	EdibilityNote    *string
	Protection       enums.Protection
	ProtectionNote   *string
	PeriodStartMonth *int
	PeriodEndMonth   *int
	PeriodPeakMonth  *int
	SmellText        *string
	TasteText        *string
	HymeniumType     *enums.HymeniumType
	GillAttachment   *enums.GillAttachment
	GillSpacing      *enums.GillSpacing
	GillEdge         *enums.GillEdge
	CapShapeYoung    *enums.CapShape
	CapShapeOld      *enums.CapShape
	UpdatedAt        db.Time
	UpdatedByID      *db.ID
}

const speciesCols = `id, slug, name, latin_name, taxon_id, group_key, edibility, marketable,
	forecast_enabled, frequency, red_list, description, edibility_note, protection, protection_note,
	period_start_month, period_end_month, period_peak_month, smell_text, taste_text, hymenium_type,
	gill_attachment, gill_spacing, gill_edge, cap_shape_young, cap_shape_old, updated_at, updated_by_id`

func scanSpecies(s db.Scanner) (speciesRow, error) {
	var r speciesRow
	err := s.Scan(&r.ID, &r.Slug, &r.Name, &r.LatinName, &r.TaxonID, &r.Group, &r.Edibility,
		&r.Marketable, &r.ForecastEnabled, &r.Frequency, &r.RedList, &r.Description, &r.EdibilityNote,
		&r.Protection, &r.ProtectionNote, &r.PeriodStartMonth, &r.PeriodEndMonth, &r.PeriodPeakMonth,
		&r.SmellText, &r.TasteText, &r.HymeniumType, &r.GillAttachment, &r.GillSpacing, &r.GillEdge,
		&r.CapShapeYoung, &r.CapShapeOld, &r.UpdatedAt, &r.UpdatedByID)
	return r, err
}

func speciesBySlug(ctx context.Context, q db.Querier, slug string) (speciesRow, error) {
	return db.One(ctx, q, scanSpecies, "SELECT "+speciesCols+" FROM species WHERE slug = ?", slug)
}

func allSpecies(ctx context.Context, q db.Querier) ([]speciesRow, error) {
	return db.All(ctx, q, scanSpecies, "SELECT "+speciesCols+" FROM species ORDER BY name")
}

type termRow struct {
	ID       db.ID
	Kind     enums.TermKind
	Group    *enums.TriggerGroup
	Slug     string
	Name     string
	Position int
}

const termCols = "id, kind, group_key, slug, name, position"

func scanTerm(s db.Scanner) (termRow, error) {
	var t termRow
	err := s.Scan(&t.ID, &t.Kind, &t.Group, &t.Slug, &t.Name, &t.Position)
	return t, err
}

func termLookup(ctx context.Context, q db.Querier) (map[db.ID]termRow, error) {
	rows, err := db.All(ctx, q, scanTerm, "SELECT "+termCols+" FROM term")
	return fn.KeyBy(rows, func(t termRow) db.ID { return t.ID }), err
}

type taxonRow struct {
	ID          db.ID
	Rank        enums.TaxonRank
	Slug        string
	Name        string
	Description *string
	ParentID    *db.ID
}

const taxonCols = "id, rank, slug, name, description, parent_id"

func scanTaxon(s db.Scanner) (taxonRow, error) {
	var t taxonRow
	err := s.Scan(&t.ID, &t.Rank, &t.Slug, &t.Name, &t.Description, &t.ParentID)
	return t, err
}

// taxonNames finds genus and family above a taxon.
type taxonNames map[db.ID]taxonRow

func loadTaxonNames(ctx context.Context, q db.Querier) (taxonNames, error) {
	rows, err := db.All(ctx, q, scanTaxon, "SELECT "+taxonCols+" FROM taxon")
	return fn.KeyBy(rows, func(t taxonRow) db.ID { return t.ID }), err
}

func (n taxonNames) named(start taxonRow, rank enums.TaxonRank) *string {
	seen := map[db.ID]bool{}
	node := start
	for !seen[node.ID] {
		if node.Rank == rank {
			return &node.Name
		}
		seen[node.ID] = true
		if node.ParentID == nil {
			return nil
		}
		parent, ok := n[*node.ParentID]
		if !ok {
			return nil
		}
		node = parent
	}
	return nil
}

// of gives genus and family of a species. Without a genus the first word of
// the latin name is the genus.
func (n taxonNames) of(s speciesRow) (string, *string) {
	fallback := strings.Split(s.LatinName, " ")[0]
	if s.TaxonID == nil {
		return fallback, nil
	}
	node, ok := n[*s.TaxonID]
	if !ok {
		return fallback, nil
	}
	genus := n.named(node, enums.TaxonRankGenus)
	if genus == nil || *genus == "" {
		return fallback, n.named(node, enums.TaxonRankFamily)
	}
	return *genus, n.named(node, enums.TaxonRankFamily)
}

type nameRow struct {
	SpeciesID db.ID
	Name      string
	Kind      enums.NameKind
}

type measurementRow struct {
	SpeciesID db.ID
	Part      enums.BodyPart
	Dimension enums.Dimension
	Low, High float64
	Unit      enums.Unit
}

type colourRangeRow struct {
	SpeciesID db.ID
	Part      enums.BodyPart
	Mode      enums.ColourMode
}

type colourRow struct {
	SpeciesID db.ID
	Part      enums.BodyPart
	Name      string
	Hex       string
}

type colourChangeRow struct {
	SpeciesID db.ID
	Position  int
	Part      enums.BodyPart
	FromName  *string
	FromHex   *string
	ToName    string
	ToHex     string
	Speed     *enums.Speed
}

type triggerKey struct {
	SpeciesID db.ID
	Position  int
}

type triggerRow struct {
	triggerKey
	TermID db.ID
}

type partFeatureRow struct {
	SpeciesID db.ID
	Part      enums.BodyPart
	Feature   string
	Phase     enums.Phase
}

type partNoteRow struct {
	SpeciesID   db.ID
	Part        enums.BodyPart
	Description string
	Comment     string
}

type traitRow struct {
	SpeciesID db.ID
	Key       enums.TraitKey
	Body      string
}

type sourceRow struct {
	SpeciesID db.ID
	Scope     enums.SourceScope
	Title     string
	URL       string
	CheckedOn db.Date
}

type seasonRow struct {
	SpeciesID db.ID
	Season    enums.Season
}

type speciesTermRow struct {
	SpeciesID      db.ID
	TermID         db.ID
	FromExperience bool
}

type lookalikeRow struct {
	A, B         db.ID
	DifferenceA  *string
	DifferenceB  *string
}

// children holds the child rows of some species, grouped by species.
type children struct {
	names         map[db.ID][]nameRow
	measurements  map[db.ID][]measurementRow
	colourRanges  map[db.ID][]colourRangeRow
	colours       map[db.ID][]colourRow
	colourChanges map[db.ID][]colourChangeRow
	triggers      map[triggerKey][]triggerRow
	partFeatures  map[db.ID][]partFeatureRow
	partNotes     map[db.ID][]partNoteRow
	traits        map[db.ID][]traitRow
	sources       map[db.ID][]sourceRow
	seasons       map[db.ID][]seasonRow
	terms         map[db.ID][]speciesTermRow
	lookalikes    map[db.ID][]lookalikeRow
	leads         map[db.ID]db.ID
}

// scope gives the condition on species_id for the ids. Nil ids mean each species.
func scope(column string, ids []db.ID) (string, []any) {
	if ids == nil {
		return "1 = 1", nil
	}
	if len(ids) == 0 {
		return "0 = 1", nil
	}
	return column + " IN (" + db.Placeholders(len(ids)) + ")", db.Args(ids)
}

func childRows[T any](ctx context.Context, q db.Querier, ids []db.ID, scan func(db.Scanner) (T, error), cols, table, order string) ([]T, error) {
	where, args := scope("species_id", ids)
	query := "SELECT " + cols + " FROM " + table + " WHERE " + where
	if order != "" {
		query += " ORDER BY " + order
	}
	return db.All(ctx, q, scan, query, args...)
}

func bySpecies[T any](rows []T, key func(T) db.ID) map[db.ID][]T {
	return fn.GroupBy(rows, key)
}

// loadChildren reads the child rows of the species. Nil ids read each species.
func loadChildren(ctx context.Context, q db.Querier, ids []db.ID, leadIDs []db.ID) (children, error) {
	var c children
	var err error
	step := func(f func() error) {
		if err == nil {
			err = f()
		}
	}
	step(func() error {
		rows, e := childRows(ctx, q, ids, func(s db.Scanner) (nameRow, error) {
			var r nameRow
			return r, s.Scan(&r.SpeciesID, &r.Name, &r.Kind)
		}, "species_id, name, kind", "species_name", "position")
		c.names = bySpecies(rows, func(r nameRow) db.ID { return r.SpeciesID })
		return e
	})
	step(func() error {
		rows, e := childRows(ctx, q, ids, func(s db.Scanner) (measurementRow, error) {
			var r measurementRow
			return r, s.Scan(&r.SpeciesID, &r.Part, &r.Dimension, &r.Low, &r.High, &r.Unit)
		}, "species_id, part, dimension, low, high, unit", "species_measurement", "part")
		c.measurements = bySpecies(rows, func(r measurementRow) db.ID { return r.SpeciesID })
		return e
	})
	step(func() error {
		rows, e := childRows(ctx, q, ids, func(s db.Scanner) (colourRangeRow, error) {
			var r colourRangeRow
			return r, s.Scan(&r.SpeciesID, &r.Part, &r.Mode)
		}, "species_id, part, mode", "species_colour_range", "part")
		c.colourRanges = bySpecies(rows, func(r colourRangeRow) db.ID { return r.SpeciesID })
		return e
	})
	step(func() error {
		rows, e := childRows(ctx, q, ids, scanColour, "species_id, part, name, hex", "species_colour", "part, position")
		c.colours = bySpecies(rows, func(r colourRow) db.ID { return r.SpeciesID })
		return e
	})
	step(func() error {
		rows, e := childRows(ctx, q, ids, func(s db.Scanner) (colourChangeRow, error) {
			var r colourChangeRow
			return r, s.Scan(&r.SpeciesID, &r.Position, &r.Part, &r.FromName, &r.FromHex, &r.ToName, &r.ToHex, &r.Speed)
		}, "species_id, position, part, from_name, from_hex, to_name, to_hex, speed", "species_colour_change", "position")
		c.colourChanges = bySpecies(rows, func(r colourChangeRow) db.ID { return r.SpeciesID })
		return e
	})
	step(func() error {
		rows, e := childRows(ctx, q, ids, func(s db.Scanner) (triggerRow, error) {
			var r triggerRow
			return r, s.Scan(&r.SpeciesID, &r.Position, &r.TermID)
		}, "species_id, position, term_id", "species_colour_change_trigger", "")
		c.triggers = fn.GroupBy(rows, func(r triggerRow) triggerKey { return r.triggerKey })
		return e
	})
	step(func() error {
		rows, e := childRows(ctx, q, ids, func(s db.Scanner) (partFeatureRow, error) {
			var r partFeatureRow
			return r, s.Scan(&r.SpeciesID, &r.Part, &r.Feature, &r.Phase)
		}, "species_id, part, feature, phase", "species_part_feature", "")
		c.partFeatures = bySpecies(rows, func(r partFeatureRow) db.ID { return r.SpeciesID })
		return e
	})
	step(func() error {
		rows, e := childRows(ctx, q, ids, func(s db.Scanner) (partNoteRow, error) {
			var r partNoteRow
			return r, s.Scan(&r.SpeciesID, &r.Part, &r.Description, &r.Comment)
		}, "species_id, part, description, comment", "species_part_note", "part")
		c.partNotes = bySpecies(rows, func(r partNoteRow) db.ID { return r.SpeciesID })
		return e
	})
	step(func() error {
		rows, e := childRows(ctx, q, ids, func(s db.Scanner) (traitRow, error) {
			var r traitRow
			return r, s.Scan(&r.SpeciesID, &r.Key, &r.Body)
		}, `species_id, "key", body`, "species_trait", "")
		c.traits = bySpecies(rows, func(r traitRow) db.ID { return r.SpeciesID })
		return e
	})
	step(func() error {
		rows, e := childRows(ctx, q, ids, func(s db.Scanner) (sourceRow, error) {
			var r sourceRow
			return r, s.Scan(&r.SpeciesID, &r.Scope, &r.Title, &r.URL, &r.CheckedOn)
		}, "species_id, scope, title, url, checked_on", "species_source", "position")
		c.sources = bySpecies(rows, func(r sourceRow) db.ID { return r.SpeciesID })
		return e
	})
	step(func() error {
		rows, e := childRows(ctx, q, ids, func(s db.Scanner) (seasonRow, error) {
			var r seasonRow
			return r, s.Scan(&r.SpeciesID, &r.Season)
		}, "species_id, season", "species_season", "")
		c.seasons = bySpecies(rows, func(r seasonRow) db.ID { return r.SpeciesID })
		return e
	})
	step(func() error {
		rows, e := childRows(ctx, q, ids, func(s db.Scanner) (speciesTermRow, error) {
			var r speciesTermRow
			return r, s.Scan(&r.SpeciesID, &r.TermID, &r.FromExperience)
		}, "species_id, term_id, from_experience", "species_term", "")
		c.terms = bySpecies(rows, func(r speciesTermRow) db.ID { return r.SpeciesID })
		return e
	})
	step(func() (e error) {
		c.lookalikes, e = loadLookalikes(ctx, q, ids)
		return e
	})
	step(func() (e error) {
		c.leads, e = shared.PhotoLeads(ctx, q, leadIDs)
		return e
	})
	return c, err
}

func scanColour(s db.Scanner) (colourRow, error) {
	var r colourRow
	return r, s.Scan(&r.SpeciesID, &r.Part, &r.Name, &r.Hex)
}

// loadLookalikes reads the pairs of the species from both sides of a pair.
func loadLookalikes(ctx context.Context, q db.Querier, ids []db.ID) (map[db.ID][]lookalikeRow, error) {
	whereA, argsA := scope("species_a_id", ids)
	whereB, argsB := scope("species_b_id", ids)
	rows, err := db.All(ctx, q, func(s db.Scanner) (lookalikeRow, error) {
		var r lookalikeRow
		return r, s.Scan(&r.A, &r.B, &r.DifferenceA, &r.DifferenceB)
	}, "SELECT species_a_id, species_b_id, difference_a, difference_b FROM species_lookalike WHERE "+
		whereA+" OR "+whereB, append(argsA, argsB...)...)
	if err != nil {
		return nil, err
	}
	wanted := func(id db.ID) bool { return ids == nil || fn.Any(ids, func(x db.ID) bool { return x == id }) }
	return fn.Reduce(rows, map[db.ID][]lookalikeRow{}, func(acc map[db.ID][]lookalikeRow, r lookalikeRow) map[db.ID][]lookalikeRow {
		if wanted(r.A) {
			acc[r.A] = append(acc[r.A], r)
		}
		if wanted(r.B) {
			acc[r.B] = append(acc[r.B], r)
		}
		return acc
	}), nil
}

// speciesIDs gives the keys of the rows.
func speciesIDs(rows []speciesRow) []db.ID {
	return fn.Map(rows, func(s speciesRow) db.ID { return s.ID })
}
