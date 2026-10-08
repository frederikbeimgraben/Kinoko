package importer

import (
	"github.com/frederikbeimgraben/kinoko/backend/internal/core/db"
	"github.com/frederikbeimgraben/kinoko/backend/internal/core/enums"
)

// Context is all that a profile needs to build its rows.
type Context struct {
	Stem       string
	Profile    Profile
	SpeciesID  db.ID
	Slug       string
	GenusIDs   map[string]db.ID
	Terms      Terms
	Colours    map[string]string
	SpeciesIDs map[string]db.ID
	Report     *Report
	SeenPairs  map[[2]db.ID]bool
}

// SpeciesRow is one row of the table species.
type SpeciesRow struct {
	ID               db.ID
	Slug             string
	Name             string
	LatinName        string
	TaxonID          *db.ID
	GroupKey         string
	Edibility        string
	Marketable       bool
	ForecastEnabled  bool
	Frequency        *string
	RedList          *string
	EdibilityNote    *string
	Protection       string
	ProtectionNote   *string
	PeriodStartMonth *int
	PeriodEndMonth   *int
	PeriodPeakMonth  *int
	SmellText        *string
	TasteText        *string
	HymeniumType     *string
	GillAttachment   *string
	GillSpacing      *string
	GillEdge         *string
	CapShapeYoung    *string
	CapShapeOld      *string
}

// NameRow is one row of species_name.
type NameRow struct {
	SpeciesID db.ID
	Position  int
	Name      string
	Kind      enums.NameKind
}

// MeasurementRow is one row of species_measurement.
type MeasurementRow struct {
	SpeciesID db.ID
	Part      enums.BodyPart
	Dimension enums.Dimension
	Low, High float64
	Unit      string
}

// ColourRangeRow is one row of species_colour_range.
type ColourRangeRow struct {
	SpeciesID db.ID
	Part      enums.BodyPart
	Mode      enums.ColourMode
}

// ColourRow is one row of species_colour.
type ColourRow struct {
	SpeciesID db.ID
	Part      enums.BodyPart
	Position  int
	Name, Hex string
}

// ChangeRow is one row of species_colour_change.
type ChangeRow struct {
	SpeciesID db.ID
	Position  int
	Part      enums.BodyPart
	ToName    string
	ToHex     string
	Speed     *string
}

// TriggerRow is one row of species_colour_change_trigger.
type TriggerRow struct {
	SpeciesID db.ID
	Position  int
	TermID    db.ID
}

// PartFeatureRow is one row of species_part_feature.
type PartFeatureRow struct {
	SpeciesID db.ID
	Part      enums.BodyPart
	Feature   string
	Phase     enums.Phase
}

// TraitRow is one row of species_trait.
type TraitRow struct {
	SpeciesID db.ID
	Key       string
	Body      string
}

// SourceRow is one row of species_source.
type SourceRow struct {
	SpeciesID db.ID
	Position  int
	Scope     enums.SourceScope
	Title     string
	URL       string
	CheckedOn db.Date
}

// SeasonRow is one row of species_season.
type SeasonRow struct {
	SpeciesID db.ID
	Season    string
}

// SpeciesTermRow is one row of species_term.
type SpeciesTermRow struct {
	SpeciesID      db.ID
	TermID         db.ID
	FromExperience bool
}

// LookalikeRow is one row of species_lookalike.
type LookalikeRow struct {
	SpeciesAID, SpeciesBID   db.ID
	DifferenceA, DifferenceB *string
}

// Children are the child rows of one or more species, one list per table.
type Children struct {
	Names        []NameRow
	Measurements []MeasurementRow
	Ranges       []ColourRangeRow
	Colours      []ColourRow
	Changes      []ChangeRow
	Triggers     []TriggerRow
	PartFeatures []PartFeatureRow
	Traits       []TraitRow
	Sources      []SourceRow
	Seasons      []SeasonRow
	Terms        []SpeciesTermRow
	Lookalikes   []LookalikeRow
}

// Counts gives the count of rows per table. Tables without rows are left out.
func (c Children) Counts() map[string]int {
	all := map[string]int{
		"species_name":                  len(c.Names),
		"species_measurement":           len(c.Measurements),
		"species_colour_range":          len(c.Ranges),
		"species_colour":                len(c.Colours),
		"species_colour_change":         len(c.Changes),
		"species_colour_change_trigger": len(c.Triggers),
		"species_part_feature":          len(c.PartFeatures),
		"species_trait":                 len(c.Traits),
		"species_source":                len(c.Sources),
		"species_season":                len(c.Seasons),
		"species_term":                  len(c.Terms),
		"species_lookalike":             len(c.Lookalikes),
	}
	out := map[string]int{}
	for key, n := range all {
		if n > 0 {
			out[key] = n
		}
	}
	return out
}

// Append gives the rows of c followed by the rows of o.
func (c Children) Append(o Children) Children {
	return Children{
		Names:        append(c.Names, o.Names...),
		Measurements: append(c.Measurements, o.Measurements...),
		Ranges:       append(c.Ranges, o.Ranges...),
		Colours:      append(c.Colours, o.Colours...),
		Changes:      append(c.Changes, o.Changes...),
		Triggers:     append(c.Triggers, o.Triggers...),
		PartFeatures: append(c.PartFeatures, o.PartFeatures...),
		Traits:       append(c.Traits, o.Traits...),
		Sources:      append(c.Sources, o.Sources...),
		Seasons:      append(c.Seasons, o.Seasons...),
		Terms:        append(c.Terms, o.Terms...),
		Lookalikes:   append(c.Lookalikes, o.Lookalikes...),
	}
}
