package importer

import (
	"slices"
	"testing"

	"github.com/frederikbeimgraben/kinoko/backend/internal/core/enums"
	"github.com/frederikbeimgraben/kinoko/backend/internal/fn"
)

func TestReadPlaceGivesAPartOrPlaceSlugs(t *testing.T) {
	cases := []struct {
		german, part, location string
	}{
		{"Fleisch/Huthaut", "", "flesh,cap"},
		{"Hut und Fleisch", "", "cap,flesh"},
		{"Hut, Fleisch", "", "cap,flesh"},
		{"Fleisch oder Huthaut (Quelle mehrdeutig)", "", "flesh,cap"},
		{"Stielrinde, Fleisch", "", "stem,flesh"},
		{"Huthaut; Stiel", "", "cap,stem"},
		{"Milch", "", "milk"},
		{"Pilzsaft / Extrakt", "", "extract"},
		{"Fleisch / Hut / Stiel", "", "flesh,cap,stem"},
		{"Stielbasis-Fleisch", "stem_base", ""},
		{"Huthaut (Hutoberfläche)", "cap", ""},
		{"nicht angegeben", "", ""},
		{"irgendwo im Wald", "", "irgendwo im Wald"},
	}
	for _, c := range cases {
		part, location := readPlace(&c.german)
		gotPart := string(fn.Deref(part, enums.BodyPart("")))
		if gotPart != c.part || fn.Deref(location, "") != c.location {
			t.Errorf("%q: part %q location %q", c.german, gotPart, fn.Deref(location, ""))
		}
	}
	if part, location := readPlace(nil); part != nil || location != nil {
		t.Error("nil place")
	}
}

func row(reagent, result, reading string, part *enums.BodyPart, location *string, sources ...string) ReactionRow {
	return ReactionRow{Reagent: reagent, Result: result, Reading: reading, Part: part, Location: location, SourceKeys: sources}
}

func TestMergeReadingsJoinsARowWithoutPlaceIntoTheSameResult(t *testing.T) {
	got := mergeReadings([]ReactionRow{
		row("koh", "negative", "negativ (nie gelb)", nil, nil, "a", "b"),
		row("koh", "negative", "keine Verfärbung", nil, fn.Ptr("flesh,cap"), "c"),
		row("melzer", "positive", "blau", nil, nil, "a"),
	})
	if len(got) != 2 || fn.Deref(got[0].Location, "") != "flesh,cap" || got[0].Reading != "negativ (nie gelb)" ||
		!slices.Equal(got[0].SourceKeys, []string{"a", "b", "c"}) || got[1].Reagent != "melzer" {
		t.Fatalf("%+v", got)
	}
}

func TestMergeReadingsMakesTwoResultsAtOnePlaceVariable(t *testing.T) {
	flesh := enums.BodyPartFlesh
	violet := "violett"
	positive := row("formalin", "positive", "nach Stunden violett", &flesh, nil, "b")
	positive.ColourName, positive.ColourHex = &violet, &violet
	got := mergeReadings([]ReactionRow{row("formalin", "negative", "keine Reaktion", &flesh, nil, "a"), positive})
	if len(got) != 1 || got[0].Result != "variable" || got[0].Reading != "keine Reaktion vs. nach Stunden violett" ||
		fn.Deref(got[0].ColourName, "") != "violett" || len(got[0].SourceKeys) != 2 {
		t.Fatalf("%+v", got)
	}
}

func TestMergeReadingsKeepsDifferentPlacesApart(t *testing.T) {
	cap, flesh := enums.BodyPartCap, enums.BodyPartFlesh
	got := mergeReadings([]ReactionRow{
		row("koh", "positive", "rot", &cap, nil),
		row("koh", "variable", "rot bis orange", &cap, nil),
		row("koh", "positive", "orangerot", &flesh, nil),
	})
	if len(got) != 2 || got[0].Result != "variable" || *got[1].Part != flesh {
		t.Fatalf("%+v", got)
	}
}
