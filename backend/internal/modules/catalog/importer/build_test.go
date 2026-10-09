package importer

import (
	"errors"
	"slices"
	"testing"

	"github.com/frederikbeimgraben/kinoko/backend/internal/core/db"
	"github.com/frederikbeimgraben/kinoko/backend/internal/core/enums"
)

func values[E ~string](all []E) []string {
	out := make([]string, len(all))
	for i, v := range all {
		out[i] = string(v)
	}
	return out
}

func TestVocabularyValuesAreKnownEnumMembers(t *testing.T) {
	tables := []struct {
		name  string
		table map[string]string
		known []string
	}{
		{"Group", Group, values(enums.GroupValues)},
		{"Edibility", Edibility, values(enums.EdibilityValues)},
		{"Protection", Protection, values(enums.ProtectionValues)},
		{"Frequency", Frequency, values(enums.FrequencyValues)},
		{"RedList", RedList, values(enums.RedListStatusValues)},
		{"Season", Season, values(enums.SeasonValues)},
		{"TaxonRank", TaxonRank, values(enums.TaxonRankValues)},
		{"Unit", Unit, values(enums.UnitValues)},
		{"Speed", Speed, values(enums.SpeedValues)},
		{"HymeniumType", HymeniumType, values(enums.HymeniumTypeValues)},
		{"GillAttachment", GillAttachment, values(enums.GillAttachmentValues)},
		{"GillSpacing", GillSpacing, values(enums.GillSpacingValues)},
		{"GillEdge", GillEdge, values(enums.GillEdgeValues)},
		{"CapShape", CapShape, values(enums.CapShapeValues)},
		{"RingShape", RingShape, values(enums.RingShapeValues)},
		{"CapFeature", CapFeature, values(enums.CapFeatureValues)},
		{"CapMargin", CapMargin, values(enums.CapMarginValues)},
		{"StemFeature", StemFeature, values(enums.StemFeatureValues)},
		{"TraitKey", TraitKey, values(enums.TraitKeyValues)},
	}
	for _, tc := range tables {
		t.Run(tc.name, func(t *testing.T) {
			for _, value := range tc.table {
				if !slices.Contains(tc.known, value) {
					t.Errorf("%s is not a member", value)
				}
			}
		})
	}
}

func isUnknown(err error) bool {
	var unknown *UnknownVocabulary
	return errors.As(err, &unknown)
}

func TestUnknownValueIsReported(t *testing.T) {
	if _, err := Lookup(Edibility, "nichtvorhanden", "speisewert", "test"); !isUnknown(err) {
		t.Fatalf("error %v", err)
	}
}

func buildTermsOf(p Profile) (Terms, error) {
	return BuildTerms([]StemProfile{{Stem: "x", Profile: p}}, db.NewID)
}

func TestUnknownTreeIsReported(t *testing.T) {
	_, err := buildTermsOf(testProfile(func(p *Profile) { p.Baeume = []string{"nichtvorhandenerbaum"} }))
	if !isUnknown(err) {
		t.Fatalf("error %v", err)
	}
}

func TestUnknownSmellIsReported(t *testing.T) {
	_, err := buildTermsOf(testProfile(func(p *Profile) { p.Geruch = &Sense{Tags: []string{"nichtvorhandenergeruch"}} }))
	if !isUnknown(err) {
		t.Fatalf("error %v", err)
	}
}

func TestUnknownTasteIsReported(t *testing.T) {
	_, err := buildTermsOf(testProfile(func(p *Profile) { p.Geschmack = &Sense{Tags: []string{"nichtvorhandenergeschmack"}} }))
	if !isUnknown(err) {
		t.Fatalf("error %v", err)
	}
}

func TestSmellAndTasteTermsGetRealNamesWithUmlauts(t *testing.T) {
	terms, err := buildTermsOf(testProfile(func(p *Profile) {
		p.Geruch = &Sense{Tags: []string{"unauffaellig", "wuerzig"}}
		p.Geschmack = &Sense{Tags: []string{"suesslich"}}
	}))
	if err != nil {
		t.Fatal(err)
	}
	names := map[[2]string]string{}
	for _, row := range terms.Rows {
		names[[2]string{string(row.Kind), row.Slug}] = row.Name
	}
	want := map[[2]string]string{
		{"smell", "unauffaellig"}: "Unauffällig",
		{"smell", "wuerzig"}:      "Würzig",
		{"taste", "suesslich"}:    "Süßlich",
	}
	for key, name := range want {
		if names[key] != name {
			t.Errorf("%v: %q", key, names[key])
		}
	}
}

func TestSlugifyHandlesUmlautsAndSpaces(t *testing.T) {
	cases := map[string]string{
		"Boletus edulis":                "boletus-edulis",
		"Kastanienbraune Wurzeltrüffel": "kastanienbraune-wurzeltrueffel",
		"Café  au lait!":                "caf-au-lait",
	}
	for in, want := range cases {
		if got := Slugify(in); got != want {
			t.Errorf("%q: %q", in, got)
		}
	}
}

func TestFindColourStopsAtASideNote(t *testing.T) {
	vocabulary := map[string]string{"ocker": "#c8963c", "grau": "#8a8a8a", "grün": "#4f8a3a", "orange": "#d1832f", "gelb": "#e8c33a"}
	cases := map[string]string{
		"Fleisch ocker mit graugrüner Schattierung.": "ocker",
		"orange vs. negativ bis blassgelb":           "orange",
		"positiv (orange, grün bis gelb)":            "gelb",
	}
	for text, want := range cases {
		if name, hex, ok := FindColour(text, vocabulary); !ok || name != want || hex != vocabulary[want] {
			t.Errorf("%q: %q %q %v", text, name, hex, ok)
		}
	}
}

func TestFindColourGivesTheEndOfASequenceElseTheFirstColour(t *testing.T) {
	vocabulary := map[string]string{"gelb": "#1", "braun": "#2", "grün": "#3"}
	if name, _, _ := FindColour("gelb bis braun", vocabulary); name != "braun" {
		t.Errorf("sequence: %q", name)
	}
	if name, _, _ := FindColour("gelb, grün", vocabulary); name != "gelb" {
		t.Errorf("list: %q", name)
	}
	if name, _, _ := FindColour("braungelb oder grün", vocabulary); name != "gelb" {
		t.Errorf("compound: %q", name)
	}
}

func TestFindColourPrefersTheLongerWordAtOneStart(t *testing.T) {
	vocabulary := map[string]string{"oliv": "#1", "olivgrün": "#2", "grün": "#3"}
	name, _, _ := FindColour("Röhren olivgrün.", vocabulary)
	if name != "olivgrün" {
		t.Fatalf("%q", name)
	}
}

func TestFindColourReturnsNoneWithoutMatch(t *testing.T) {
	if _, _, ok := FindColour("Ohne Reaktion.", map[string]string{"braun": "#7a5230"}); ok {
		t.Fatal("match")
	}
}

func build(t *testing.T, ctx Context) (SpeciesRow, Children) {
	t.Helper()
	row, children, err := BuildSpecies(ctx)
	if err != nil {
		t.Fatal(err)
	}
	return row, children
}

func TestUnknownGenusIsCounted(t *testing.T) {
	ctx := testContext(testProfile(nil), nil)
	row, _ := build(t, ctx)
	if row.TaxonID != nil || ctx.Report.Skipped["species_ohne_gattung"] != 1 {
		t.Fatalf("taxon %v, skipped %v", row.TaxonID, ctx.Report.Skipped)
	}
}

func TestForecastEnabledFollowsKarteField(t *testing.T) {
	row, _ := build(t, testContext(testProfile(func(p *Profile) { p.Karte = ptr("boletus_edulis") }), nil))
	if !row.ForecastEnabled {
		t.Fatal("forecast off")
	}
}

func TestForecastEnabledFalseWithoutKarteField(t *testing.T) {
	row, _ := build(t, testContext(testProfile(nil), nil))
	if row.ForecastEnabled {
		t.Fatal("forecast on")
	}
}

func TestRingShapeMapsTheGermanWord(t *testing.T) {
	row, _ := build(t, testContext(testProfile(func(p *Profile) { p.Ringform = ptr("haengend") }), nil))
	if row.RingShape == nil || *row.RingShape != "pendant" {
		t.Fatalf("ring shape %v", row.RingShape)
	}
	if row, _ := build(t, testContext(testProfile(nil), nil)); row.RingShape != nil {
		t.Fatalf("ring shape %v", *row.RingShape)
	}
}

func TestUnknownLookalikeIsSkippedAndCounted(t *testing.T) {
	ctx := testContext(testProfile(func(p *Profile) {
		p.Verwechslungen = []Lookalike{{Slug: "unbekannt", Unterschied: "x"}}
	}), nil)
	_, children := build(t, ctx)
	if len(children.Lookalikes) != 0 || ctx.Report.Skipped["verwechslung_unbekannt"] != 1 {
		t.Fatalf("%v %v", children.Lookalikes, ctx.Report.Skipped)
	}
}

func TestSporenlagerWithoutBodypartIsSkipped(t *testing.T) {
	ctx := testContext(testProfile(func(p *Profile) {
		p.Fruchtschicht = &HymeniumEntry{Art: ptr("leisten")}
		p.Farben = []ColourSet{{Key: "sporenlager", Colours: []NamedColour{{"gelb", "#e8c33a"}}}}
	}), nil)
	_, children := build(t, ctx)
	if len(children.Colours) != 0 || ctx.Report.Skipped["colour_ohne_koerperteil"] != 1 {
		t.Fatalf("%v %v", children.Colours, ctx.Report.Skipped)
	}
}

func TestReagentWithoutColourWordIsSkipped(t *testing.T) {
	ctx := testContext(testProfile(func(p *Profile) {
		p.Reagenzien = []Reagent{{Reagenz: "koh", Reaktion: "Ohne Reaktion."}}
	}), nil)
	_, children := build(t, ctx)
	if len(children.Changes) != 0 || ctx.Report.Skipped["reagenz_ohne_zielfarbe"] != 1 {
		t.Fatalf("%v %v", children.Changes, ctx.Report.Skipped)
	}
}

func TestSporeAndFruitbodyMeasurementsLandInTheTable(t *testing.T) {
	ctx := testContext(testProfile(func(p *Profile) {
		p.Masse = []Span{
			{Key: "sporenLaengeUm", Von: 4, Bis: 6, Einheit: "um"},
			{Key: "sporenBreiteUm", Von: 2, Bis: 3, Einheit: "um"},
			{Key: "fruchtkoerperBreiteCm", Von: 5, Bis: 9, Einheit: "cm"},
			{Key: "fruchtkoerperHoeheCm", Von: 6, Bis: 12, Einheit: "cm"},
		}
	}), nil)
	_, children := build(t, ctx)
	if len(children.Measurements) != 4 || ctx.Report.Skipped["measurement_ohne_koerperteil"] != 0 {
		t.Fatalf("%v %v", children.Measurements, ctx.Report.Skipped)
	}
	var found [][2]string
	for _, m := range children.Measurements {
		found = append(found, [2]string{string(m.Part), string(m.Dimension)})
	}
	want := [][2]string{{"spore", "length"}, {"spore", "width"}, {"fruitbody", "width"}, {"fruitbody", "height"}}
	if !slices.Equal(found, want) {
		t.Fatalf("%v", found)
	}
}

func TestAnUnknownMeasurementIsCounted(t *testing.T) {
	ctx := testContext(testProfile(func(p *Profile) {
		p.Masse = []Span{{Key: "wurzelTiefeCm", Von: 1, Bis: 2, Einheit: "cm"}}
	}), nil)
	_, children := build(t, ctx)
	if len(children.Measurements) != 0 || ctx.Report.Skipped["measurement_ohne_koerperteil"] != 1 {
		t.Fatalf("%v %v", children.Measurements, ctx.Report.Skipped)
	}
}

func TestDuplicateSpeciesTermIsCollapsed(t *testing.T) {
	terms := NewTerms([]TermRow{{ID: db.NewID(), Kind: enums.TermKindSmell, Slug: "pilzig"}})
	ctx := testContext(testProfile(func(p *Profile) { p.Geruch = &Sense{Tags: []string{"pilzig", "pilzig"}} }),
		func(c *Context) { c.Terms = terms })
	_, children := build(t, ctx)
	if len(children.Terms) != 1 {
		t.Fatalf("%v", children.Terms)
	}
}

func TestDuplicateLookalikePairIsSkippedAndCounted(t *testing.T) {
	ctx := testContext(testProfile(func(p *Profile) {
		p.Verwechslungen = []Lookalike{{Slug: "andere", Unterschied: "a"}, {Slug: "andere", Unterschied: "b"}}
	}), func(c *Context) { c.SpeciesIDs = map[string]db.ID{"andere": db.NewID()} })
	_, children := build(t, ctx)
	if len(children.Lookalikes) != 1 || ctx.Report.Skipped["verwechslung_doppelt"] != 1 {
		t.Fatalf("%v %v", children.Lookalikes, ctx.Report.Skipped)
	}
}

func TestLookalikeTextGoesIntoTheSlotOfTheOtherSpecies(t *testing.T) {
	own, other := db.MustID("00000000-0000-4000-8000-000000000001"), db.MustID("ffffffff-0000-4000-8000-000000000001")
	ctx := testContext(testProfile(func(p *Profile) {
		p.Verwechslungen = []Lookalike{{Slug: "andere", Unterschied: "about other", EigenerUnterschied: ptr("about own")}}
	}), func(c *Context) { c.SpeciesID = own; c.SpeciesIDs = map[string]db.ID{"andere": other} })
	_, children := build(t, ctx)
	row := children.Lookalikes[0]
	if row.SpeciesAID != own || *row.DifferenceA != "about own" || *row.DifferenceB != "about other" {
		t.Fatalf("%+v", row)
	}
}

func TestCapMarginWithoutChangeAppliesBothPhases(t *testing.T) {
	ctx := testContext(testProfile(func(p *Profile) { p.Hutrand = &CapMarginEntry{Von: []string{"eingerollt"}} }), nil)
	_, children := build(t, ctx)
	phases := map[enums.Phase]bool{}
	for _, f := range children.PartFeatures {
		phases[f.Phase] = true
		if f.Feature != string(enums.CapMarginInrolled) {
			t.Fatalf("%v", f)
		}
	}
	if len(phases) != 2 {
		t.Fatalf("%v", phases)
	}
}

func TestCapMarginWithChangeSplitsByPhase(t *testing.T) {
	ctx := testContext(testProfile(func(p *Profile) {
		p.Hutrand = &CapMarginEntry{Von: []string{"eingerollt"}, Nach: &[]string{"wellig"}}
	}), nil)
	_, children := build(t, ctx)
	want := []PartFeatureRow{
		{ctx.SpeciesID, enums.BodyPartCap, "inrolled", enums.PhaseYoung},
		{ctx.SpeciesID, enums.BodyPartCap, "wavy", enums.PhaseOld},
	}
	if !slices.Equal(children.PartFeatures, want) {
		t.Fatalf("%v", children.PartFeatures)
	}
}

func TestParseProfileKeepsTheKeyOrderOfTheFile(t *testing.T) {
	text := `name = "X"
lateinisch = "X y"
[masse]
stielLaengeCm = { von = 1, bis = 2.5, einheit = "cm" }
hutBreiteCm = { von = 3.0, bis = 4.0, einheit = "cm" }
[merkmale]
zeit = "a"
hut = "b"
[farben]
stiel = [{ name = "rot", hex = "#ff0000" }]
verfaerbung = { nach = [{ name = "blau", hex = "#0000ff" }], dauer = "schnell" }
hut = [{ name = "rot", hex = "#ee0000" }]
`
	p, err := ParseProfile(text, "x.toml")
	if err != nil {
		t.Fatal(err)
	}
	keys := func(n int, at func(int) string) []string {
		out := make([]string, n)
		for i := range out {
			out[i] = at(i)
		}
		return out
	}
	if got := keys(len(p.Masse), func(i int) string { return p.Masse[i].Key }); !slices.Equal(got, []string{"stielLaengeCm", "hutBreiteCm"}) {
		t.Fatalf("masse %v", got)
	}
	if p.Masse[0].Von != 1 || p.Masse[0].Bis != 2.5 {
		t.Fatalf("span %+v", p.Masse[0])
	}
	if got := keys(len(p.Merkmale), func(i int) string { return p.Merkmale[i].Key }); !slices.Equal(got, []string{"zeit", "hut"}) {
		t.Fatalf("merkmale %v", got)
	}
	if got := keys(len(p.Farben), func(i int) string { return p.Farben[i].Key }); !slices.Equal(got, []string{"stiel", "verfaerbung", "hut"}) {
		t.Fatalf("farben %v", got)
	}
	vocabulary := ColourVocabulary([]StemProfile{{Stem: "x", Profile: p}})
	if vocabulary["rot"] != "#ee0000" || vocabulary["blau"] != "#0000ff" {
		t.Fatalf("vocabulary %v", vocabulary)
	}
}
