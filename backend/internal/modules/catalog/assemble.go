package catalog

import (
	"maps"
	"slices"

	"github.com/frederikbeimgraben/kinoko/backend/internal/core/db"
	"github.com/frederikbeimgraben/kinoko/backend/internal/core/enums"
	"github.com/frederikbeimgraben/kinoko/backend/internal/fn"
)

// Summary is the short form of a species, for lists.
type Summary struct {
	ID              db.ID            `json:"id"`
	Slug            string           `json:"slug"`
	Name            string           `json:"name"`
	ScientificName  string           `json:"scientificName"`
	TaxonID         *db.ID           `json:"taxonId"`
	GenusName       string           `json:"genusName"`
	FamilyName      *string          `json:"familyName"`
	Group           enums.Group      `json:"group"`
	Edibility       enums.Edibility  `json:"edibility"`
	Protection      enums.Protection `json:"protection"`
	ForecastEnabled bool             `json:"forecastEnabled"`
	LeadPhotoID     *db.ID           `json:"leadPhotoId"`
	UpdatedAt       db.Time          `json:"updatedAt"`
}

// Species is the full profile of a species.
type Species struct {
	Summary
	UpdatedByName    *string               `json:"updatedByName"`
	Description      *string               `json:"description"`
	Marketable       bool                  `json:"marketable"`
	Frequency        *enums.Frequency      `json:"frequency"`
	RedList          *enums.RedListStatus  `json:"redList"`
	EdibilityNote    *string               `json:"edibilityNote"`
	ProtectionNote   *string               `json:"protectionNote"`
	PeriodStartMonth *int                  `json:"periodStartMonth"`
	PeriodEndMonth   *int                  `json:"periodEndMonth"`
	PeriodPeakMonth  *int                  `json:"periodPeakMonth"`
	SmellText        *string               `json:"smellText"`
	TasteText        *string               `json:"tasteText"`
	HymeniumType     *enums.HymeniumType   `json:"hymeniumType"`
	GillAttachment   *enums.GillAttachment `json:"gillAttachment"`
	GillSpacing      *enums.GillSpacing    `json:"gillSpacing"`
	GillEdge         *enums.GillEdge       `json:"gillEdge"`
	CapShapeYoung    *enums.CapShape       `json:"capShapeYoung"`
	CapShapeOld      *enums.CapShape       `json:"capShapeOld"`
	Names            []NameEntry           `json:"names"`
	Measurements     []MeasurementGroup    `json:"measurements"`
	PartNotes        []PartNote            `json:"partNotes"`
	Colours          []ColourGroup         `json:"colours"`
	ColourChanges    []ColourChange        `json:"colourChanges"`
	CapFeatures      []CapFeatureEntry     `json:"capFeatures"`
	CapMargins       []CapMarginEntry      `json:"capMargins"`
	StemFeatures     []StemFeatureEntry    `json:"stemFeatures"`
	Traits           []Trait               `json:"traits"`
	Sources          []SourceEntry         `json:"sources"`
	Seasons          []enums.Season        `json:"seasons"`
	Terms            []TermEntry           `json:"terms"`
	Lookalikes       []Lookalike           `json:"lookalikes"`
	// Reactions is set on the profile. The bundle leaves it out and gives ReactionCount.
	Reactions     *[]Reaction `json:"reactions,omitempty"`
	ReactionCount *int        `json:"reactionCount,omitempty"`
}

// NameEntry is one more name of a species.
type NameEntry struct {
	Name string         `json:"name"`
	Kind enums.NameKind `json:"kind"`
}

// Measurement is one measured length.
type Measurement struct {
	Dimension enums.Dimension `json:"dimension"`
	Unit      enums.Unit      `json:"unit"`
	Low       float64         `json:"low"`
	High      float64         `json:"high"`
}

// MeasurementGroup holds the measurements of one body part.
type MeasurementGroup struct {
	Part         enums.BodyPart `json:"part"`
	Measurements []Measurement  `json:"measurements"`
}

// PartNote is the description and comment of a body part.
type PartNote struct {
	Part        enums.BodyPart `json:"part"`
	Description string         `json:"description"`
	Comment     string         `json:"comment"`
}

// ColourValue is a colour. Nearest is the nearest standard colour, or null.
type ColourValue struct {
	Name    string  `json:"name"`
	Hex     string  `json:"hex"`
	Nearest *string `json:"nearest"`
}

// ColourGroup holds the colours of one body part.
type ColourGroup struct {
	Part    enums.BodyPart   `json:"part"`
	Mode    enums.ColourMode `json:"mode"`
	Colours []ColourValue    `json:"colours"`
}

// TermRef is a reference to a term.
type TermRef struct {
	ID   db.ID          `json:"id"`
	Slug string         `json:"slug"`
	Name string         `json:"name"`
	Kind enums.TermKind `json:"kind"`
}

// ColourChange is a change of colour of a body part.
type ColourChange struct {
	Part     enums.BodyPart     `json:"part"`
	Kind     enums.TriggerGroup `json:"kind"`
	From     *ColourValue       `json:"from"`
	To       ColourValue        `json:"to"`
	Speed    *enums.Speed       `json:"speed"`
	Triggers []TermRef          `json:"triggers"`
}

// CapFeatureEntry is a feature of the cap surface.
type CapFeatureEntry struct {
	Feature enums.CapFeature `json:"feature"`
	Phase   enums.Phase      `json:"phase"`
}

// CapMarginEntry is a feature of the cap margin.
type CapMarginEntry struct {
	Margin enums.CapMargin `json:"margin"`
	Phase  enums.Phase     `json:"phase"`
}

// StemFeatureEntry is a feature of the stem.
type StemFeatureEntry struct {
	Feature enums.StemFeature `json:"feature"`
	Phase   enums.Phase       `json:"phase"`
}

// Trait is one section of the trait text.
type Trait struct {
	Key  enums.TraitKey `json:"key"`
	Text string         `json:"text"`
}

// SourceEntry is a source of a species.
type SourceEntry struct {
	Scope     enums.SourceScope `json:"scope"`
	Title     string            `json:"title"`
	URL       string            `json:"url"`
	CheckedOn db.Date           `json:"checkedOn"`
}

// TermEntry is a term of a species.
type TermEntry struct {
	Term           TermRef `json:"term"`
	FromExperience bool    `json:"fromExperience"`
}

// Lookalike is a species that people can confuse with the species.
type Lookalike struct {
	Slug           string          `json:"slug"`
	Name           string          `json:"name"`
	ScientificName string          `json:"scientificName"`
	Edibility      enums.Edibility `json:"edibility"`
	CapColours     []ColourValue   `json:"capColours"`
	Difference     *string         `json:"difference"`
}

// lookalikeTarget holds the values of the other species of a pair.
type lookalikeTarget struct {
	Slug       string
	Name       string
	LatinName  string
	Edibility  enums.Edibility
	CapColours []ColourValue
}

func colourValue(r colourRow) ColourValue {
	nearest := Nearest(r.Hex).Hex
	return ColourValue{Name: r.Name, Hex: r.Hex, Nearest: &nearest}
}

func capColours(rows []colourRow) []ColourValue {
	return fn.Map(fn.Filter(rows, func(r colourRow) bool { return r.Part == enums.BodyPartCap }), colourValue)
}

func targetsOf(rows []speciesRow, colours map[db.ID][]colourRow) map[db.ID]lookalikeTarget {
	return fn.Reduce(rows, map[db.ID]lookalikeTarget{}, func(acc map[db.ID]lookalikeTarget, r speciesRow) map[db.ID]lookalikeTarget {
		acc[r.ID] = lookalikeTarget{r.Slug, r.Name, r.LatinName, r.Edibility, capColours(colours[r.ID])}
		return acc
	})
}

func summaryOf(s speciesRow, lead *db.ID, names taxonNames) Summary {
	genus, family := names.of(s)
	return Summary{
		ID: s.ID, Slug: s.Slug, Name: s.Name, ScientificName: s.LatinName, TaxonID: s.TaxonID,
		GenusName: genus, FamilyName: family, Group: s.Group, Edibility: s.Edibility,
		Protection: s.Protection, ForecastEnabled: s.ForecastEnabled, LeadPhotoID: lead,
		UpdatedAt: s.UpdatedAt,
	}
}

func leadOf(c children, id db.ID) *db.ID {
	if lead, ok := c.leads[id]; ok {
		return &lead
	}
	return nil
}

func termRef(t termRow) TermRef { return TermRef{ID: t.ID, Slug: t.Slug, Name: t.Name, Kind: t.Kind} }

func measurementGroups(rows []measurementRow) []MeasurementGroup {
	parts := fn.Reduce(rows, []enums.BodyPart{}, func(acc []enums.BodyPart, r measurementRow) []enums.BodyPart {
		if slices.Contains(acc, r.Part) {
			return acc
		}
		return append(acc, r.Part)
	})
	return fn.Map(parts, func(part enums.BodyPart) MeasurementGroup {
		return MeasurementGroup{Part: part, Measurements: fn.Map(
			fn.Filter(rows, func(r measurementRow) bool { return r.Part == part }),
			func(r measurementRow) Measurement {
				return Measurement{Dimension: r.Dimension, Unit: r.Unit, Low: r.Low, High: r.High}
			})}
	})
}

func colourGroups(id db.ID, c children) []ColourGroup {
	own := c.colours[id]
	return fn.Map(c.colourRanges[id], func(r colourRangeRow) ColourGroup {
		return ColourGroup{Part: r.Part, Mode: r.Mode, Colours: fn.Map(
			fn.Filter(own, func(x colourRow) bool { return x.Part == r.Part }), colourValue)}
	})
}

func colourChanges(id db.ID, c children, terms map[db.ID]termRow) []ColourChange {
	return fn.Map(c.colourChanges[id], func(r colourChangeRow) ColourChange {
		found := fn.FlatMap(c.triggers[triggerKey{id, r.Position}], func(t triggerRow) []termRow {
			if term, ok := terms[t.TermID]; ok {
				return []termRow{term}
			}
			return nil
		})
		kind := enums.TriggerGroupMechanical
		if first, ok := fn.Find(found, func(t termRow) bool { return t.Group != nil }); ok {
			kind = *first.Group
		}
		var from *ColourValue
		if r.FromName != nil && r.FromHex != nil {
			from = &ColourValue{Name: *r.FromName, Hex: *r.FromHex}
		}
		return ColourChange{
			Part: r.Part, Kind: kind, From: from, To: ColourValue{Name: r.ToName, Hex: r.ToHex},
			Speed: r.Speed, Triggers: fn.Map(found, termRef),
		}
	})
}

func splitFeatures(rows []partFeatureRow) ([]CapFeatureEntry, []CapMarginEntry, []StemFeatureEntry) {
	caps := []CapFeatureEntry{}
	margins := []CapMarginEntry{}
	stems := []StemFeatureEntry{}
	for _, r := range rows {
		switch {
		case r.Part == enums.BodyPartCap && enums.CapFeature(r.Feature).Valid():
			caps = append(caps, CapFeatureEntry{enums.CapFeature(r.Feature), r.Phase})
		case r.Part == enums.BodyPartCap && enums.CapMargin(r.Feature).Valid():
			margins = append(margins, CapMarginEntry{enums.CapMargin(r.Feature), r.Phase})
		case r.Part == enums.BodyPartStem:
			stems = append(stems, StemFeatureEntry{enums.StemFeature(r.Feature), r.Phase})
		}
	}
	return caps, margins, stems
}

func lookalikesOf(id db.ID, rows []lookalikeRow, targets map[db.ID]lookalikeTarget) []Lookalike {
	return fn.FlatMap(rows, func(r lookalikeRow) []Lookalike {
		other, difference := r.A, r.DifferenceA
		if r.A == id {
			other, difference = r.B, r.DifferenceB
		}
		t, ok := targets[other]
		if !ok {
			return nil
		}
		return []Lookalike{{t.Slug, t.Name, t.LatinName, t.Edibility, t.CapColours, difference}}
	})
}

// assemble builds the full profile of a species from its child rows.
func assemble(s speciesRow, c children, terms map[db.ID]termRow, targets map[db.ID]lookalikeTarget, names taxonNames) Species {
	caps, margins, stems := splitFeatures(c.partFeatures[s.ID])
	return Species{
		Summary:          summaryOf(s, leadOf(c, s.ID), names),
		Description:      s.Description,
		Marketable:       s.Marketable,
		Frequency:        s.Frequency,
		RedList:          s.RedList,
		EdibilityNote:    s.EdibilityNote,
		ProtectionNote:   s.ProtectionNote,
		PeriodStartMonth: s.PeriodStartMonth,
		PeriodEndMonth:   s.PeriodEndMonth,
		PeriodPeakMonth:  s.PeriodPeakMonth,
		SmellText:        s.SmellText,
		TasteText:        s.TasteText,
		HymeniumType:     s.HymeniumType,
		GillAttachment:   s.GillAttachment,
		GillSpacing:      s.GillSpacing,
		GillEdge:         s.GillEdge,
		CapShapeYoung:    s.CapShapeYoung,
		CapShapeOld:      s.CapShapeOld,
		Names:            fn.Map(c.names[s.ID], func(r nameRow) NameEntry { return NameEntry{r.Name, r.Kind} }),
		Measurements:     measurementGroups(c.measurements[s.ID]),
		PartNotes: fn.Map(c.partNotes[s.ID], func(r partNoteRow) PartNote {
			return PartNote{r.Part, r.Description, r.Comment}
		}),
		Colours:       colourGroups(s.ID, c),
		ColourChanges: colourChanges(s.ID, c, terms),
		CapFeatures:   caps,
		CapMargins:    margins,
		StemFeatures:  stems,
		Traits:        fn.Map(c.traits[s.ID], func(r traitRow) Trait { return Trait{r.Key, r.Body} }),
		Sources: fn.Map(c.sources[s.ID], func(r sourceRow) SourceEntry {
			return SourceEntry{r.Scope, r.Title, r.URL, r.CheckedOn}
		}),
		Seasons: fn.Map(c.seasons[s.ID], func(r seasonRow) enums.Season { return r.Season }),
		Terms: fn.FlatMap(c.terms[s.ID], func(r speciesTermRow) []TermEntry {
			if t, ok := terms[r.TermID]; ok {
				return []TermEntry{{termRef(t), r.FromExperience}}
			}
			return nil
		}),
		Lookalikes: lookalikesOf(s.ID, c.lookalikes[s.ID], targets),
	}
}

// facetsOf builds the filter values of a species from its child rows.
func facetsOf(s speciesRow, c children, terms map[db.ID]termRow, names taxonNames) Facets {
	own := c.colours[s.ID]
	colours := fn.Map(c.colourRanges[s.ID], func(r colourRangeRow) partColours {
		keys := fn.Map(fn.Filter(own, func(x colourRow) bool { return x.Part == r.Part }),
			func(x colourRow) string { return Nearest(x.Hex).Key })
		return partColours{Part: r.Part, Keys: slices.Compact(slices.Sorted(slices.Values(keys)))}
	})
	measurements := fn.Reduce(c.measurements[s.ID], map[sizeKey]span{}, func(acc map[sizeKey]span, m measurementRow) map[sizeKey]span {
		acc[sizeKey{m.Part, m.Dimension}] = span{m.Low, m.High}
		return acc
	})
	var p *period
	if s.PeriodStartMonth != nil && s.PeriodEndMonth != nil {
		p = &period{*s.PeriodStartMonth, *s.PeriodEndMonth}
	}
	termIDs := fn.Set(fn.Map(c.terms[s.ID], func(r speciesTermRow) db.ID { return r.TermID }))
	held := fn.FlatMap(fn.SortedBy(slices.Collect(maps.Keys(termIDs)), func(id db.ID) string { return id.String() }), func(id db.ID) []termRow {
		if t, ok := terms[id]; ok {
			return []termRow{t}
		}
		return nil
	})
	slugsOf := func(keep func(termRow) bool) []string {
		return slices.Compact(slices.Sorted(slices.Values(fn.Map(fn.Filter(held, keep), func(t termRow) string { return t.Slug }))))
	}
	shapes := fn.FlatMap([]*enums.CapShape{s.CapShapeYoung, s.CapShapeOld}, func(c *enums.CapShape) []enums.CapShape {
		if c == nil {
			return nil
		}
		return []enums.CapShape{*c}
	})
	genus, family := names.of(s)
	return Facets{
		Edibility:    s.Edibility,
		Hymenium:     s.HymeniumType,
		CapShapes:    slices.Compact(slices.Sorted(slices.Values(shapes))),
		Colours:      colours,
		Measurements: measurements,
		Period:       p,
		TermIDs:      termIDs,
		Protection:   s.Protection,
		Forecast:     s.ForecastEnabled,
		GenusName:    genus,
		FamilyName:   family,
		Senses: slugsOf(func(t termRow) bool {
			return t.Kind == enums.TermKindSmell || t.Kind == enums.TermKindTaste
		}),
		Trees: slugsOf(func(t termRow) bool { return t.Kind == enums.TermKindTree }),
	}
}
