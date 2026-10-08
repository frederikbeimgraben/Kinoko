package catalog

import (
	"encoding/json"
	"testing"

	"github.com/frederikbeimgraben/kinoko/backend/internal/core/db"
	"github.com/frederikbeimgraben/kinoko/backend/internal/core/enums"
	"github.com/frederikbeimgraben/kinoko/backend/internal/fn"
)

func makeFacets(change func(*Facets)) Facets {
	hymenium := enums.HymeniumTypeTubes
	f := Facets{
		Edibility:    enums.EdibilityEdible,
		Hymenium:     &hymenium,
		CapShapes:    []enums.CapShape{enums.CapShapeConvex},
		Colours:      []partColours{{enums.BodyPartCap, []string{"brown"}}},
		Measurements: map[sizeKey]span{{enums.BodyPartCap, enums.DimensionWidth}: {4, 12}},
		Period:       &period{6, 10},
		TermIDs:      map[db.ID]struct{}{},
		Protection:   enums.ProtectionNone,
	}
	if change != nil {
		change(&f)
	}
	return f
}

var capWidth = sizeKey{enums.BodyPartCap, enums.DimensionWidth}

func TestCatalogueCountsEveryValue(t *testing.T) {
	a := makeFacets(func(f *Facets) { f.Period = &period{6, 8} })
	b := makeFacets(func(f *Facets) {
		f.Edibility, f.Hymenium, f.Period = enums.EdibilityPoisonous, nil, &period{11, 2}
	})
	out := Catalogue([]Facets{a, b})
	encode := func(c *Counts) string { s, _ := json.Marshal(c); return string(s) }
	if encode(out.Axis("edibility")) != `{"edible":1,"poisonous":1}` || encode(out.Axis("hymenium")) != `{"tubes":1}` {
		t.Fatal(out)
	}
	if encode(out.Axis("colour.cap")) != `{"brown":2}` {
		t.Fatal(encode(out.Axis("colour.cap")))
	}
	p := out.Axis("period")
	if p.Get("7") != 1 || p.Get("12") != 1 || p.Get("1") != 1 || p.Get("3") != 0 {
		t.Fatal(encode(p))
	}
	if out.Axis("unknown").Get("hymenium") != 1 {
		t.Fatal(encode(out.Axis("unknown")))
	}
}

func TestMatchEmptySelectionMatchesEverything(t *testing.T) {
	if !Match(makeFacets(nil), Selection{}) {
		t.Fatal()
	}
}

func TestMatchEdibilityAxis(t *testing.T) {
	f := makeFacets(nil)
	if !Match(f, Selection{Edibility: []enums.Edibility{enums.EdibilityEdible}}) ||
		Match(f, Selection{Edibility: []enums.Edibility{enums.EdibilityPoisonous}}) {
		t.Fatal()
	}
}

func TestMatchHymeniumAxis(t *testing.T) {
	f := makeFacets(nil)
	if !Match(f, Selection{Hymenium: []enums.HymeniumType{enums.HymeniumTypeTubes}}) ||
		Match(f, Selection{Hymenium: []enums.HymeniumType{enums.HymeniumTypeGills}}) {
		t.Fatal()
	}
}

func TestMatchHymeniumAxisNone(t *testing.T) {
	f := makeFacets(func(f *Facets) { f.Hymenium = nil })
	if Match(f, Selection{Hymenium: []enums.HymeniumType{enums.HymeniumTypeGills}}) {
		t.Fatal()
	}
}

func TestMatchCapShapeIsOrWithinAxis(t *testing.T) {
	f := makeFacets(func(f *Facets) { f.CapShapes = []enums.CapShape{enums.CapShapeConvex, enums.CapShapeFlat} })
	if !Match(f, Selection{CapShape: []enums.CapShape{enums.CapShapeFlat, enums.CapShapeBell}}) ||
		Match(f, Selection{CapShape: []enums.CapShape{enums.CapShapeBell}}) {
		t.Fatal()
	}
}

func TestMatchTermsRequiresAll(t *testing.T) {
	one, two := db.NewID(), db.NewID()
	f := makeFacets(func(f *Facets) { f.TermIDs = fn.Set([]db.ID{one, two}) })
	if !Match(f, Selection{Terms: []db.ID{one}}) || !Match(f, Selection{Terms: []db.ID{one, two}}) ||
		Match(f, Selection{Terms: []db.ID{one, db.NewID()}}) {
		t.Fatal()
	}
}

func TestMatchMonthsWrapsYear(t *testing.T) {
	f := makeFacets(func(f *Facets) { f.Period = &period{11, 2} })
	if !Match(f, Selection{Months: []int{12}}) || !Match(f, Selection{Months: []int{1}}) || Match(f, Selection{Months: []int{6}}) {
		t.Fatal()
	}
}

func TestMatchMonthsWithoutPeriod(t *testing.T) {
	if Match(makeFacets(func(f *Facets) { f.Period = nil }), Selection{Months: []int{1}}) {
		t.Fatal()
	}
}

func TestMatchColourUsesNearestStandardColour(t *testing.T) {
	f := makeFacets(nil)
	if !Match(f, Selection{Colours: map[enums.BodyPart]string{enums.BodyPartCap: "#7a5230"}}) ||
		Match(f, Selection{Colours: map[enums.BodyPart]string{enums.BodyPartCap: "#ffffff"}}) {
		t.Fatal()
	}
}

func TestMatchColourMissingPart(t *testing.T) {
	f := makeFacets(func(f *Facets) { f.Colours = nil })
	if Match(f, Selection{Colours: map[enums.BodyPart]string{enums.BodyPartCap: "#7a5230"}}) {
		t.Fatal()
	}
}

func TestMatchSizeOverlap(t *testing.T) {
	f := makeFacets(nil)
	b := func(low, high *float64) Selection { return Selection{Sizes: map[sizeKey]bound{capWidth: {low, high}}} }
	n := func(v float64) *float64 { return &v }
	if !Match(f, b(n(5), n(8))) || !Match(f, b(nil, n(5))) || !Match(f, b(n(10), nil)) {
		t.Fatal("overlap")
	}
	if Match(f, b(n(20), nil)) || Match(f, b(nil, n(1))) {
		t.Fatal("no overlap")
	}
}

func TestMatchSizeMissingMeasurement(t *testing.T) {
	f := makeFacets(func(f *Facets) { f.Measurements = nil })
	one, two := 1.0, 2.0
	if Match(f, Selection{Sizes: map[sizeKey]bound{capWidth: {&one, &two}}}) {
		t.Fatal()
	}
}

func speciesRowOf(latin string) speciesRow {
	return speciesRow{ID: db.NewID(), Slug: "boletus-edulis", Name: "Steinpilz", LatinName: latin,
		Group: enums.GroupBolete, Edibility: enums.EdibilityEdible, Protection: enums.ProtectionNone}
}

func TestFacetsNameTheGenusFromTheLatinName(t *testing.T) {
	f := facetsOf(speciesRowOf("Boletus edulis"), children{}, nil, taxonNames{})
	if f.GenusName != "Boletus" || f.FamilyName != nil {
		t.Fatal(f)
	}
}

func TestFacetsTakeTheGenusOfTheTaxonomy(t *testing.T) {
	family := taxonRow{ID: db.NewID(), Rank: enums.TaxonRankFamily, Name: "Boletaceae"}
	genus := taxonRow{ID: db.NewID(), Rank: enums.TaxonRankGenus, Name: "Boletus", ParentID: &family.ID}
	row := speciesRowOf("Something else")
	row.TaxonID = &genus.ID
	f := facetsOf(row, children{}, nil, taxonNames{family.ID: family, genus.ID: genus})
	if f.GenusName != "Boletus" || f.FamilyName == nil || *f.FamilyName != "Boletaceae" {
		t.Fatal(f)
	}
}

func TestFacetsSortTheTermsByKind(t *testing.T) {
	row := speciesRowOf("Boletus edulis")
	smell := termRow{ID: db.NewID(), Kind: enums.TermKindSmell, Slug: "nussig", Name: "nussig"}
	tree := termRow{ID: db.NewID(), Kind: enums.TermKindTree, Slug: "fichte", Name: "Fichte"}
	c := children{terms: map[db.ID][]speciesTermRow{row.ID: {{row.ID, smell.ID, false}, {row.ID, tree.ID, false}}}}
	f := facetsOf(row, c, map[db.ID]termRow{smell.ID: smell, tree.ID: tree}, taxonNames{})
	if len(f.Senses) != 1 || f.Senses[0] != "nussig" || len(f.Trees) != 1 || f.Trees[0] != "fichte" {
		t.Fatal(f)
	}
}

var board = []StandardColour{
	{"white", "#f3efe6"}, {"cream", "#e8d9b5"}, {"yellow", "#e0b446"}, {"orange", "#d1832f"},
	{"redBrown", "#a0522d"}, {"brown", "#6b4423"}, {"darkBrown", "#3e2a17"}, {"olive", "#7f8a3a"},
	{"green", "#4f7a3a"}, {"red", "#b8322a"}, {"violet", "#7a3b6a"}, {"grey", "#8a8f8a"},
}

func TestThePaletteIsTheOneOfTheBoard(t *testing.T) {
	for i, c := range board {
		if Standard[i] != c {
			t.Fatal(i, Standard[i])
		}
	}
	if len(Standard) != len(board) {
		t.Fatal(len(Standard))
	}
}

func TestNearestColour(t *testing.T) {
	for value, key := range map[string]string{
		"#6b4423": "brown", "#5e3d22": "brown", "#7a5230": "brown", "#8a4e2b": "redBrown",
		"#4a3220": "darkBrown", "#e8d9b5": "cream", "#f3efe6": "white", "#8a9a5a": "olive",
		"#4a5a3a": "green", "#b8322a": "red", "#8a8f8a": "grey", "#7a3b6a": "violet",
	} {
		if got := Nearest(value).Key; got != key {
			t.Errorf("%s: %s, want %s", value, got, key)
		}
	}
}

func TestAStandardColourMapsToItself(t *testing.T) {
	for _, c := range Standard {
		if Nearest(c.Hex).Key != c.Key {
			t.Error(c)
		}
	}
}

func TestDistanceIsZeroForTheSameColour(t *testing.T) {
	if Distance("#123456", "#123456") != 0 {
		t.Fatal()
	}
}

func TestPaletteIsTheBundleForm(t *testing.T) {
	encoded, _ := json.Marshal(Standard[0])
	if string(encoded) != `{"key":"white","hex":"#f3efe6"}` {
		t.Fatal(string(encoded))
	}
}

func TestSlugifyLatin(t *testing.T) {
	for in, want := range map[string]string{
		"Böletus Édulis": "boeletus-edulis", "Boletus edulis": "boletus-edulis", " Straße  x ": "strasse-x",
	} {
		if got := SlugifyLatin(in); got != want {
			t.Errorf("%q: %q", in, got)
		}
	}
}
