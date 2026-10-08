package importer

import (
	"fmt"
	"net/url"
	"slices"
	"strings"

	"github.com/frederikbeimgraben/kinoko/backend/internal/core/db"
	"github.com/frederikbeimgraben/kinoko/backend/internal/core/enums"
	"github.com/frederikbeimgraben/kinoko/backend/internal/fn"
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

var measurements = map[string]struct {
	part      enums.BodyPart
	dimension enums.Dimension
}{
	"hutBreiteCm":           {enums.BodyPartCap, enums.DimensionWidth},
	"stielLaengeCm":         {enums.BodyPartStem, enums.DimensionLength},
	"stielDickeCm":          {enums.BodyPartStem, enums.DimensionThickness},
	"sporenLaengeUm":        {enums.BodyPartSpore, enums.DimensionLength},
	"sporenBreiteUm":        {enums.BodyPartSpore, enums.DimensionWidth},
	"fruchtkoerperBreiteCm": {enums.BodyPartFruitbody, enums.DimensionWidth},
	"fruchtkoerperHoeheCm":  {enums.BodyPartFruitbody, enums.DimensionHeight},
}

var colourParts = map[string]enums.BodyPart{
	"hut":          enums.BodyPartCap,
	"stiel":        enums.BodyPartStem,
	"fleisch":      enums.BodyPartFlesh,
	"sporenpulver": enums.BodyPartSporePrint,
}

var hymeniumBodyParts = map[string]enums.BodyPart{
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
		traitRows, sourceRows, seasonRows, speciesTermRows, lookalikeRows,
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
		target, ok := measurements[span.Key]
		if !ok {
			ctx.Report.Skip("measurement_ohne_koerperteil")
			continue
		}
		unit, err := Lookup(Unit, span.Einheit, "einheit", ctx.Stem)
		if err != nil {
			return Children{}, err
		}
		rows = append(rows, MeasurementRow{
			SpeciesID: ctx.SpeciesID, Part: target.part, Dimension: target.dimension,
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
			found, ok := hymeniumBodyParts[hymenium]
			if !ok {
				ctx.Report.Skip("colour_ohne_koerperteil")
				continue
			}
			part = found
		} else {
			found, ok := colourParts[set.Key]
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

// changeRows builds the reactions of a species: the mechanical change first, then each reagent.
func changeRows(ctx Context, _ SpeciesRow) (Children, error) {
	out := Children{}
	add := func(name, hex string, speed *string, trigger db.ID) {
		position := len(out.Changes)
		out.Changes = append(out.Changes, ChangeRow{
			SpeciesID: ctx.SpeciesID, Position: position, Part: enums.BodyPartFlesh,
			ToName: name, ToHex: hex, Speed: speed,
		})
		out.Triggers = append(out.Triggers, TriggerRow{SpeciesID: ctx.SpeciesID, Position: position, TermID: trigger})
	}
	if change := mechanicalChange(ctx.Profile); change != nil {
		speed, err := optionalLookup(Speed, change.Dauer, "farben.verfaerbung.dauer", ctx.Stem)
		if err != nil {
			return Children{}, err
		}
		trigger, err := ctx.Terms.IDFor(enums.TermKindTrigger, CutTriggerSlug)
		if err != nil {
			return Children{}, err
		}
		for _, colour := range change.Nach {
			add(colour.Name, colour.Hex, speed, trigger)
		}
	}
	for _, entry := range ctx.Profile.Reagenzien {
		name, hex, ok := FindColour(entry.Reaktion, ctx.Colours)
		if !ok {
			ctx.Report.Skip("reagenz_ohne_zielfarbe")
			continue
		}
		slug, err := Lookup(ReagentSlug, entry.Reagenz, "reagenz", ctx.Stem)
		if err != nil {
			return Children{}, err
		}
		trigger, err := ctx.Terms.IDFor(enums.TermKindTrigger, slug)
		if err != nil {
			return Children{}, err
		}
		add(name, hex, nil, trigger)
	}
	return out, nil
}

func mechanicalChange(p Profile) *ColourChange {
	for _, set := range p.Farben {
		if set.Key == changeKey && set.Change != nil {
			return set.Change
		}
	}
	return nil
}

func bothPhases(id db.ID, part enums.BodyPart, feature string) []PartFeatureRow {
	return []PartFeatureRow{
		{SpeciesID: id, Part: part, Feature: feature, Phase: enums.PhaseYoung},
		{SpeciesID: id, Part: part, Feature: feature, Phase: enums.PhaseOld},
	}
}

func featureRows(ctx Context, words []string, table map[string]string, field string, part enums.BodyPart) (Children, error) {
	var rows []PartFeatureRow
	for _, word := range words {
		value, err := Lookup(table, word, field, ctx.Stem)
		if err != nil {
			return Children{}, err
		}
		rows = append(rows, bothPhases(ctx.SpeciesID, part, value)...)
	}
	return Children{PartFeatures: rows}, nil
}

func capFeatureRows(ctx Context, _ SpeciesRow) (Children, error) {
	return featureRows(ctx, ctx.Profile.Hutmerkmale, CapFeature, "hutmerkmale", enums.BodyPartCap)
}

func stemFeatureRows(ctx Context, _ SpeciesRow) (Children, error) {
	return featureRows(ctx, ctx.Profile.Stielmerkmale, StemFeature, "stielmerkmale", enums.BodyPartStem)
}

// capMarginRows applies the margin to both phases, or splits it by phase when it changes.
func capMarginRows(ctx Context, _ SpeciesRow) (Children, error) {
	margin := ctx.Profile.Hutrand
	if margin == nil {
		return Children{}, nil
	}
	if margin.Nach == nil {
		return featureRows(ctx, margin.Von, CapMargin, "hutrand.von", enums.BodyPartCap)
	}
	var rows []PartFeatureRow
	phase := func(words []string, field string, p enums.Phase) error {
		for _, word := range words {
			value, err := Lookup(CapMargin, word, field, ctx.Stem)
			if err != nil {
				return err
			}
			rows = append(rows, PartFeatureRow{SpeciesID: ctx.SpeciesID, Part: enums.BodyPartCap, Feature: value, Phase: p})
		}
		return nil
	}
	if err := phase(margin.Von, "hutrand.von", enums.PhaseYoung); err != nil {
		return Children{}, err
	}
	if err := phase(*margin.Nach, "hutrand.nach", enums.PhaseOld); err != nil {
		return Children{}, err
	}
	return Children{PartFeatures: rows}, nil
}

func traitRows(ctx Context, _ SpeciesRow) (Children, error) {
	var rows []TraitRow
	for _, trait := range ctx.Profile.Merkmale {
		key, err := Lookup(TraitKey, trait.Key, "merkmale", ctx.Stem)
		if err != nil {
			return Children{}, err
		}
		rows = append(rows, TraitRow{SpeciesID: ctx.SpeciesID, Key: key, Body: trait.Text})
	}
	return Children{Traits: rows}, nil
}

func hostnameTitle(raw string) string {
	host := raw
	if parsed, err := url.Parse(raw); err == nil && parsed.Hostname() != "" {
		host = strings.ToLower(parsed.Hostname())
	}
	return strings.TrimPrefix(host, "www.")
}

func sourceRows(ctx Context, _ SpeciesRow) (Children, error) {
	quelle := ctx.Profile.Quelle
	checked, err := db.ParseDate(quelle.GeprueftAm)
	if err != nil {
		return Children{}, fmt.Errorf("%s: quelle.geprueftAm: %w", ctx.Stem, err)
	}
	rows := []SourceRow{{
		SpeciesID: ctx.SpeciesID, Position: 0, Scope: enums.SourceScopeProfile,
		Title: hostnameTitle(quelle.URL), URL: quelle.URL, CheckedOn: checked,
	}}
	for i, link := range ctx.Profile.Links {
		rows = append(rows, SourceRow{
			SpeciesID: ctx.SpeciesID, Position: i + 1, Scope: enums.SourceScopeFurther,
			Title: link.Titel, URL: link.URL, CheckedOn: checked,
		})
	}
	return Children{Sources: rows}, nil
}

func seasonRows(ctx Context, _ SpeciesRow) (Children, error) {
	var rows []SeasonRow
	for _, word := range ctx.Profile.Jahreszeiten {
		season, err := Lookup(Season, word, "jahreszeiten", ctx.Stem)
		if err != nil {
			return Children{}, err
		}
		rows = append(rows, SeasonRow{SpeciesID: ctx.SpeciesID, Season: season})
	}
	return Children{Seasons: rows}, nil
}

// speciesTermRows links smell, taste and trees. A term that occurs twice gives one row.
func speciesTermRows(ctx Context, _ SpeciesRow) (Children, error) {
	type wanted struct {
		kind       enums.TermKind
		slug       string
		experience bool
	}
	var want []wanted
	for _, tag := range senseTags(ctx.Profile.Geruch) {
		want = append(want, wanted{enums.TermKindSmell, Slugify(tag), false})
	}
	for _, tag := range senseTags(ctx.Profile.Geschmack) {
		want = append(want, wanted{enums.TermKindTaste, Slugify(tag), false})
	}
	trees := func(words []string, experience bool) error {
		for _, word := range words {
			tree, err := treeEntry(word)
			if err != nil {
				return err
			}
			want = append(want, wanted{enums.TermKindTree, tree.Slug, experience})
		}
		return nil
	}
	if err := trees(ctx.Profile.Baeume, false); err != nil {
		return Children{}, err
	}
	if err := trees(experienceTrees(ctx.Profile), true); err != nil {
		return Children{}, err
	}
	var rows []SpeciesTermRow
	seen := map[db.ID]bool{}
	for _, w := range want {
		id, err := ctx.Terms.IDFor(w.kind, w.slug)
		if err != nil {
			return Children{}, err
		}
		if seen[id] {
			continue
		}
		seen[id] = true
		rows = append(rows, SpeciesTermRow{SpeciesID: ctx.SpeciesID, TermID: id, FromExperience: w.experience})
	}
	return Children{Terms: rows}, nil
}

// lookalikeRows keeps each pair once. The text about the other species goes into its slot of the ordered pair.
func lookalikeRows(ctx Context, _ SpeciesRow) (Children, error) {
	var rows []LookalikeRow
	for _, entry := range ctx.Profile.Verwechslungen {
		other, ok := ctx.SpeciesIDs[entry.Slug]
		if !ok {
			ctx.Report.Skip("verwechslung_unbekannt")
			continue
		}
		own := ctx.SpeciesID
		ownFirst := idLess(own, other)
		pair := [2]db.ID{other, own}
		if ownFirst {
			pair = [2]db.ID{own, other}
		}
		if ctx.SeenPairs[pair] {
			ctx.Report.Skip("verwechslung_doppelt")
			continue
		}
		ctx.SeenPairs[pair] = true
		otherDiff := entry.Unterschied
		row := LookalikeRow{SpeciesAID: pair[0], SpeciesBID: pair[1], DifferenceA: &otherDiff, DifferenceB: entry.EigenerUnterschied}
		if ownFirst {
			row.DifferenceA, row.DifferenceB = entry.EigenerUnterschied, &otherDiff
		}
		rows = append(rows, row)
	}
	return Children{Lookalikes: rows}, nil
}
