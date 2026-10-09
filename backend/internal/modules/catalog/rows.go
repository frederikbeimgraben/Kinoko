package catalog

import (
	"context"
	"strings"

	"github.com/frederikbeimgraben/kinoko/backend/internal/core/db"
	"github.com/frederikbeimgraben/kinoko/backend/internal/core/enums"
	"github.com/frederikbeimgraben/kinoko/backend/internal/fn"
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
	PeriodPeakWeek   *int
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
	gill_attachment, gill_spacing, gill_edge, cap_shape_young, cap_shape_old, updated_at, updated_by_id,
	period_peak_week`

func scanSpecies(s db.Scanner) (speciesRow, error) {
	var r speciesRow
	err := s.Scan(&r.ID, &r.Slug, &r.Name, &r.LatinName, &r.TaxonID, &r.Group, &r.Edibility,
		&r.Marketable, &r.ForecastEnabled, &r.Frequency, &r.RedList, &r.Description, &r.EdibilityNote,
		&r.Protection, &r.ProtectionNote, &r.PeriodStartMonth, &r.PeriodEndMonth, &r.PeriodPeakMonth,
		&r.SmellText, &r.TasteText, &r.HymeniumType, &r.GillAttachment, &r.GillSpacing, &r.GillEdge,
		&r.CapShapeYoung, &r.CapShapeOld, &r.UpdatedAt, &r.UpdatedByID, &r.PeriodPeakWeek)
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
	LatinName   string
	Description *string
	ParentID    *db.ID
}

const taxonCols = "id, rank, slug, name, latin_name, description, parent_id"

func scanTaxon(s db.Scanner) (taxonRow, error) {
	var t taxonRow
	err := s.Scan(&t.ID, &t.Rank, &t.Slug, &t.Name, &t.LatinName, &t.Description, &t.ParentID)
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
			return &node.LatinName
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
	A, B        db.ID
	DifferenceA *string
	DifferenceB *string
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
