package exporter

import (
	"context"

	"github.com/frederikbeimgraben/kinoko/backend/internal/core/db"
	"github.com/frederikbeimgraben/kinoko/backend/internal/core/enums"
	"github.com/frederikbeimgraben/kinoko/backend/internal/modules/catalog/importer"
)

// stored is one species of the database with its child rows. Rows without a position keep the order of insertion.
type stored struct {
	Row        importer.SpeciesRow
	TaxonSlug  *string
	TaxonRank  *string
	Names      []importer.NameRow
	Measures   []importer.MeasurementRow
	Modes      map[enums.BodyPart]enums.ColourMode
	Colours    map[enums.BodyPart][]importer.NamedColour
	Changes    []change
	Features   []importer.PartFeatureRow
	Notes      []importer.PartNoteRow
	Traits     []importer.TraitRow
	Sources    []importer.SourceRow
	Seasons    []string
	Terms      []termLink
	PartColour []enums.BodyPart
}

// change is one colour change with the slugs of its triggers.
type change struct {
	Part     enums.BodyPart
	From     *importer.NamedColour
	To       importer.NamedColour
	Speed    *string
	Triggers []string
}

type termLink struct {
	Kind       enums.TermKind
	Slug       string
	Experience bool
}

// catalogue is the species part of the database that the profiles hold.
type catalogue struct {
	Species    []*stored
	Lookalikes []importer.LookalikeRow
}

const speciesColumns = `s.id, s.slug, s.name, s.latin_name, s.group_key, s.edibility, s.marketable,
	s.forecast_enabled, s.frequency, s.red_list, s.description, s.edibility_note, s.protection, s.protection_note,
	s.period_start_month, s.period_end_month, s.period_peak_month, s.smell_text, s.taste_text, s.hymenium_type,
	s.gill_attachment, s.gill_spacing, s.gill_edge, s.cap_shape_young, s.cap_shape_old, t.slug, t.rank`

func scanSpecies(s db.Scanner) (*stored, error) {
	out := &stored{Modes: map[enums.BodyPart]enums.ColourMode{}, Colours: map[enums.BodyPart][]importer.NamedColour{}}
	r := &out.Row
	err := s.Scan(&r.ID, &r.Slug, &r.Name, &r.LatinName, &r.GroupKey, &r.Edibility, &r.Marketable,
		&r.ForecastEnabled, &r.Frequency, &r.RedList, &r.Description, &r.EdibilityNote, &r.Protection,
		&r.ProtectionNote, &r.PeriodStartMonth, &r.PeriodEndMonth, &r.PeriodPeakMonth, &r.SmellText, &r.TasteText,
		&r.HymeniumType, &r.GillAttachment, &r.GillSpacing, &r.GillEdge, &r.CapShapeYoung, &r.CapShapeOld,
		&out.TaxonSlug, &out.TaxonRank)
	return out, err
}

// loadCatalogue reads the species and their child rows. It reads no users, finds or photos.
func loadCatalogue(ctx context.Context, q db.Querier) (catalogue, error) {
	species, err := db.All(ctx, q, scanSpecies, "SELECT "+speciesColumns+
		" FROM species s LEFT JOIN taxon t ON t.id = s.taxon_id ORDER BY s.slug")
	if err != nil {
		return catalogue{}, err
	}
	byID := map[db.ID]*stored{}
	for _, s := range species {
		byID[s.Row.ID] = s
	}
	for _, step := range childLoaders {
		if err := step(ctx, q, byID); err != nil {
			return catalogue{}, err
		}
	}
	pairs, err := db.All(ctx, q, func(s db.Scanner) (importer.LookalikeRow, error) {
		var r importer.LookalikeRow
		return r, s.Scan(&r.SpeciesAID, &r.SpeciesBID, &r.DifferenceA, &r.DifferenceB)
	}, "SELECT species_a_id, species_b_id, difference_a, difference_b FROM species_lookalike ORDER BY rowid")
	return catalogue{Species: species, Lookalikes: pairs}, err
}

// each runs a query of child rows and gives each row to the species of its first column.
func each(ctx context.Context, q db.Querier, byID map[db.ID]*stored, query string,
	scan func(db.Scanner, *db.ID) (func(*stored), error)) error {
	adds, err := db.All(ctx, q, func(s db.Scanner) (func(), error) {
		var id db.ID
		add, err := scan(s, &id)
		if err != nil {
			return nil, err
		}
		return func() {
			if target, ok := byID[id]; ok {
				add(target)
			}
		}, nil
	}, query)
	for _, add := range adds {
		add()
	}
	return err
}

var childLoaders = []func(context.Context, db.Querier, map[db.ID]*stored) error{
	loadNames, loadMeasures, loadColours, loadChanges, loadFeatures, loadNotes, loadTraits, loadSources,
	loadSeasons, loadTerms,
}

func loadNames(ctx context.Context, q db.Querier, byID map[db.ID]*stored) error {
	return each(ctx, q, byID, "SELECT species_id, position, name, kind FROM species_name ORDER BY species_id, position",
		func(s db.Scanner, id *db.ID) (func(*stored), error) {
			var r importer.NameRow
			err := s.Scan(id, &r.Position, &r.Name, &r.Kind)
			return func(t *stored) { t.Names = append(t.Names, r) }, err
		})
}

func loadMeasures(ctx context.Context, q db.Querier, byID map[db.ID]*stored) error {
	return each(ctx, q, byID, "SELECT species_id, part, dimension, low, high, unit FROM species_measurement ORDER BY rowid",
		func(s db.Scanner, id *db.ID) (func(*stored), error) {
			var r importer.MeasurementRow
			err := s.Scan(id, &r.Part, &r.Dimension, &r.Low, &r.High, &r.Unit)
			return func(t *stored) { t.Measures = append(t.Measures, r) }, err
		})
}

func loadColours(ctx context.Context, q db.Querier, byID map[db.ID]*stored) error {
	err := each(ctx, q, byID, "SELECT species_id, part, mode FROM species_colour_range ORDER BY rowid",
		func(s db.Scanner, id *db.ID) (func(*stored), error) {
			var part enums.BodyPart
			var mode enums.ColourMode
			err := s.Scan(id, &part, &mode)
			return func(t *stored) { t.Modes[part] = mode }, err
		})
	if err != nil {
		return err
	}
	return each(ctx, q, byID, "SELECT species_id, part, name, hex FROM species_colour ORDER BY species_id, part, position",
		func(s db.Scanner, id *db.ID) (func(*stored), error) {
			var part enums.BodyPart
			var c importer.NamedColour
			err := s.Scan(id, &part, &c.Name, &c.Hex)
			return func(t *stored) {
				if _, seen := t.Colours[part]; !seen {
					t.PartColour = append(t.PartColour, part)
				}
				t.Colours[part] = append(t.Colours[part], c)
			}, err
		})
}

func loadChanges(ctx context.Context, q db.Querier, byID map[db.ID]*stored) error {
	type key struct {
		id       db.ID
		position int
	}
	triggers := map[key][]string{}
	err := each(ctx, q, byID, `SELECT c.species_id, c.position, t.slug FROM species_colour_change_trigger c
		JOIN term t ON t.id = c.term_id ORDER BY c.rowid`,
		func(s db.Scanner, id *db.ID) (func(*stored), error) {
			var position int
			var slug string
			err := s.Scan(id, &position, &slug)
			k := key{*id, position}
			triggers[k] = append(triggers[k], slug)
			return func(*stored) {}, err
		})
	if err != nil {
		return err
	}
	return each(ctx, q, byID, `SELECT species_id, position, part, from_name, from_hex, to_name, to_hex, speed
		FROM species_colour_change ORDER BY species_id, position`,
		func(s db.Scanner, id *db.ID) (func(*stored), error) {
			var c change
			var position int
			var fromName, fromHex *string
			err := s.Scan(id, &position, &c.Part, &fromName, &fromHex, &c.To.Name, &c.To.Hex, &c.Speed)
			if fromName != nil {
				c.From = &importer.NamedColour{Name: *fromName, Hex: deref(fromHex)}
			}
			c.Triggers = triggers[key{*id, position}]
			return func(t *stored) { t.Changes = append(t.Changes, c) }, err
		})
}

func loadFeatures(ctx context.Context, q db.Querier, byID map[db.ID]*stored) error {
	return each(ctx, q, byID, "SELECT species_id, part, feature, phase FROM species_part_feature ORDER BY rowid",
		func(s db.Scanner, id *db.ID) (func(*stored), error) {
			var r importer.PartFeatureRow
			err := s.Scan(id, &r.Part, &r.Feature, &r.Phase)
			return func(t *stored) { t.Features = append(t.Features, r) }, err
		})
}

func loadNotes(ctx context.Context, q db.Querier, byID map[db.ID]*stored) error {
	return each(ctx, q, byID, "SELECT species_id, part, description, comment FROM species_part_note ORDER BY rowid",
		func(s db.Scanner, id *db.ID) (func(*stored), error) {
			var r importer.PartNoteRow
			err := s.Scan(id, &r.Part, &r.Description, &r.Comment)
			return func(t *stored) { t.Notes = append(t.Notes, r) }, err
		})
}

func loadTraits(ctx context.Context, q db.Querier, byID map[db.ID]*stored) error {
	return each(ctx, q, byID, `SELECT species_id, "key", body FROM species_trait ORDER BY rowid`,
		func(s db.Scanner, id *db.ID) (func(*stored), error) {
			var r importer.TraitRow
			err := s.Scan(id, &r.Key, &r.Body)
			return func(t *stored) { t.Traits = append(t.Traits, r) }, err
		})
}

func loadSources(ctx context.Context, q db.Querier, byID map[db.ID]*stored) error {
	return each(ctx, q, byID, `SELECT species_id, position, scope, title, url, checked_on FROM species_source
		ORDER BY species_id, position`,
		func(s db.Scanner, id *db.ID) (func(*stored), error) {
			var r importer.SourceRow
			err := s.Scan(id, &r.Position, &r.Scope, &r.Title, &r.URL, &r.CheckedOn)
			return func(t *stored) { t.Sources = append(t.Sources, r) }, err
		})
}

func loadSeasons(ctx context.Context, q db.Querier, byID map[db.ID]*stored) error {
	return each(ctx, q, byID, "SELECT species_id, season FROM species_season ORDER BY rowid",
		func(s db.Scanner, id *db.ID) (func(*stored), error) {
			var season string
			err := s.Scan(id, &season)
			return func(t *stored) { t.Seasons = append(t.Seasons, season) }, err
		})
}

func loadTerms(ctx context.Context, q db.Querier, byID map[db.ID]*stored) error {
	return each(ctx, q, byID, `SELECT st.species_id, t.kind, t.slug, st.from_experience FROM species_term st
		JOIN term t ON t.id = st.term_id ORDER BY st.rowid`,
		func(s db.Scanner, id *db.ID) (func(*stored), error) {
			var r termLink
			err := s.Scan(id, &r.Kind, &r.Slug, &r.Experience)
			return func(t *stored) { t.Terms = append(t.Terms, r) }, err
		})
}

func deref(value *string) string {
	if value == nil {
		return ""
	}
	return *value
}
