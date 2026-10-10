package importer

import (
	"fmt"
	"slices"
	"strings"

	"github.com/frederikbeimgraben/kinoko/backend/internal/core/db"
	"github.com/frederikbeimgraben/kinoko/backend/internal/core/enums"
	"github.com/frederikbeimgraben/kinoko/backend/internal/fn"
)

// MeasurementTarget is the body part and the dimension of a key of the table masse.
type MeasurementTarget struct {
	Part      enums.BodyPart
	Dimension enums.Dimension
}

// MeasurementKeys map each key of the table masse.
var MeasurementKeys = map[string]MeasurementTarget{
	"hutBreiteCm":           {enums.BodyPartCap, enums.DimensionWidth},
	"stielLaengeCm":         {enums.BodyPartStem, enums.DimensionLength},
	"stielDickeCm":          {enums.BodyPartStem, enums.DimensionThickness},
	"sporenLaengeUm":        {enums.BodyPartSpore, enums.DimensionLength},
	"sporenBreiteUm":        {enums.BodyPartSpore, enums.DimensionWidth},
	"fruchtkoerperBreiteCm": {enums.BodyPartFruitbody, enums.DimensionWidth},
	"fruchtkoerperHoeheCm":  {enums.BodyPartFruitbody, enums.DimensionHeight},
}

// ColourParts map the keys of the table farben, except sporenlager and verfaerbung.
var ColourParts = map[string]enums.BodyPart{
	"hut":          enums.BodyPartCap,
	"stiel":        enums.BodyPartStem,
	"fleisch":      enums.BodyPartFlesh,
	"sporenpulver": enums.BodyPartSporePrint,
}

// HymeniumBodyParts give the body part of the colours sporenlager by hymenium type.
var HymeniumBodyParts = map[string]enums.BodyPart{
	"gills": enums.BodyPartGills,
	"tubes": enums.BodyPartTubes,
	"pores": enums.BodyPartPores,
}

// BuildSpecies builds the species row and all its child rows from a profile.
func BuildSpecies(ctx Context) (SpeciesRow, Children, error) {
	row, err := speciesRow(ctx, findTaxonID(ctx))
	if err != nil {
		return SpeciesRow{}, Children{}, err
	}
	steps := []func(Context, SpeciesRow) (Children, error){
		nameRows, measurementRows, colourRows, changeRows,
		capFeatureRows, capMarginRows, stemFeatureRows,
		traitRows, partNoteRows, sourceRows, seasonRows, speciesTermRows, lookalikeRows,
	}
	children := Children{}
	for _, step := range steps {
		part, err := step(ctx, row)
		if err != nil {
			return SpeciesRow{}, Children{}, err
		}
		children = children.Append(part)
	}
	return row, children, nil
}

func findTaxonID(ctx Context) *db.ID {
	fields := strings.Fields(ctx.Profile.Lateinisch)
	genus := ""
	if len(fields) > 0 {
		genus = Slugify(fields[0])
	}
	id, ok := ctx.GenusIDs[genus]
	if !ok {
		ctx.Report.Skip("species_ohne_gattung")
		return nil
	}
	return &id
}

func speciesRow(ctx Context, taxonID *db.ID) (SpeciesRow, error) {
	p, stem := ctx.Profile, ctx.Stem
	var errs []error
	must := func(table map[string]string, value, field string) string {
		mapped, err := Lookup(table, value, field, stem)
		errs = append(errs, err)
		return mapped
	}
	maybe := func(table map[string]string, value *string, field string) *string {
		mapped, err := optionalLookup(table, value, field, stem)
		errs = append(errs, err)
		return mapped
	}
	period := Period{}
	if p.Zeitraum != nil {
		period = *p.Zeitraum
	}
	hymenium := HymeniumEntry{}
	if p.Fruchtschicht != nil {
		hymenium = *p.Fruchtschicht
	}
	shape := CapShapeEntry{}
	if p.Hutform != nil {
		shape = *p.Hutform
	}
	row := SpeciesRow{
		ID:               ctx.SpeciesID,
		Slug:             ctx.Slug,
		Name:             p.Name,
		LatinName:        p.Lateinisch,
		TaxonID:          taxonID,
		GroupKey:         must(Group, p.Gruppe, "gruppe"),
		Edibility:        must(Edibility, p.Speisewert, "speisewert"),
		Marketable:       p.Marktfaehig,
		ForecastEnabled:  p.Karte != nil,
		Frequency:        maybe(Frequency, p.Haeufigkeit, "haeufigkeit"),
		RedList:          maybe(RedList, p.Gefaehrdung, "gefaehrdung"),
		Description:      p.Beschreibung,
		DescriptionEn:    fn.Deref(p.BeschreibungEn, ""),
		DescriptionDraft: p.Entwurf,
		EdibilityNote:    p.SpeisewertHinweis,
		Protection:       must(Protection, p.Schutz.Status, "schutz.status"),
		ProtectionNote:   p.SchutzHinweis,
		PeriodStartMonth: period.VonMonat,
		PeriodEndMonth:   period.BisMonat,
		PeriodPeakMonth:  period.SpitzeMonat,
		SmellText:        senseText(p.Geruch),
		TasteText:        senseText(p.Geschmack),
		HymeniumType:     maybe(HymeniumType, hymenium.Art, "fruchtschicht.art"),
		GillAttachment:   maybe(GillAttachment, hymenium.Ansatz, "fruchtschicht.ansatz"),
		GillSpacing:      maybe(GillSpacing, hymenium.Stand, "fruchtschicht.stand"),
		GillEdge:         maybe(GillEdge, hymenium.Schneide, "fruchtschicht.schneide"),
		CapShapeYoung:    maybe(CapShape, shape.Von, "hutform.von"),
		CapShapeOld:      maybe(CapShape, shape.Nach, "hutform.nach"),
		RingShape:        maybe(RingShape, p.Ringform, "ringform"),
	}
	for _, err := range errs {
		if err != nil {
			return SpeciesRow{}, err
		}
	}
	return row, nil
}

func senseText(s *Sense) *string {
	if s == nil {
		return nil
	}
	return s.Text
}

func nameRows(ctx Context, _ SpeciesRow) (Children, error) {
	of := func(kind enums.NameKind) func(string) NameRow {
		return func(name string) NameRow { return NameRow{SpeciesID: ctx.SpeciesID, Name: name, Kind: kind} }
	}
	names := slices.Concat(fn.Map(ctx.Profile.WeitereNamen, of(enums.NameKindCommon)),
		fn.Map(ctx.Profile.Synonyme, of(enums.NameKindSynonym)))
	return Children{Names: fn.Map(fn.Enumerate(names), func(p fn.Pair[int, NameRow]) NameRow {
		row := p.Second
		row.Position = p.First
		return row
	})}, nil
}

func measurementRows(ctx Context, _ SpeciesRow) (Children, error) {
	var rows []MeasurementRow
	for _, span := range ctx.Profile.Masse {
		target, ok := MeasurementKeys[span.Key]
		if !ok {
			ctx.Report.Skip("measurement_ohne_koerperteil")
			continue
		}
		unit, err := Lookup(Unit, span.Einheit, "einheit", ctx.Stem)
		if err != nil {
			return Children{}, err
		}
		rows = append(rows, MeasurementRow{
			SpeciesID: ctx.SpeciesID, Part: target.Part, Dimension: target.Dimension,
			Low: span.Von, High: span.Bis, Unit: unit,
		})
	}
	return Children{Measurements: rows}, nil
}

func colourRows(ctx Context, species SpeciesRow) (Children, error) {
	out := Children{}
	for _, set := range ctx.Profile.Farben {
		if set.Key == changeKey || len(set.Colours) == 0 {
			continue
		}
		var part enums.BodyPart
		if set.Key == "sporenlager" {
			hymenium := ""
			if species.HymeniumType != nil {
				hymenium = *species.HymeniumType
			}
			found, ok := HymeniumBodyParts[hymenium]
			if !ok {
				ctx.Report.Skip("colour_ohne_koerperteil")
				continue
			}
			part = found
		} else {
			found, ok := ColourParts[set.Key]
			if !ok {
				return Children{}, fmt.Errorf("%s: unknown key farben.%s", ctx.Stem, set.Key)
			}
			part = found
		}
		mode := enums.ColourModeDistinct
		if len(set.Colours) == 1 {
			mode = enums.ColourModeSingle
		}
		out.Ranges = append(out.Ranges, ColourRangeRow{SpeciesID: ctx.SpeciesID, Part: part, Mode: mode})
		out.Colours = append(out.Colours, fn.Map(fn.Enumerate(set.Colours), func(p fn.Pair[int, NamedColour]) ColourRow {
			return ColourRow{SpeciesID: ctx.SpeciesID, Part: part, Position: p.First, Name: p.Second.Name, Hex: p.Second.Hex}
		})...)
	}
	return out, nil
}
