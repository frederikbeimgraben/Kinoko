package importer

import (
	"testing"

	"github.com/frederikbeimgraben/kinoko/backend/internal/core/enums"
)

var reagentColours = map[string]string{"gelb": "#e8c33a", "rot": "#c0392b", "orange": "#e67e22", "braun": "#8b5a2b", "olivbraun": "#6e6435"}

func TestReagentChangeReadsTheFirstClauseWithAColour(t *testing.T) {
	cases := []struct {
		text string
		part enums.BodyPart
		name string
	}{
		{"Fleisch rasch gelb, später orange bis rot.", enums.BodyPartFlesh, "gelb"},
		{"Auf dem Hut orange, im Fleisch gelblich bis orange.", enums.BodyPartCap, "orange"},
		{"An der Stielbasis rot, feuerrot bis rostrot.", enums.BodyPartStemBase, "rot"},
		{"Auf dem Hut negativ bis bräunlich, auf dem Stiel orange.", enums.BodyPartStem, "orange"},
		{"Im Fleisch olivbraun. Der ähnliche Schöngelbe Klumpfuß wird dunkel rotbraun.", enums.BodyPartFlesh, "olivbraun"},
	}
	for _, c := range cases {
		part, name, _, ok := ReagentChange(c.text, reagentColours)
		if !ok || part != c.part || name != c.name {
			t.Errorf("%q: got %v %q %v", c.text, part, name, ok)
		}
	}
}

func TestNegatedReagentGivesNoColourChange(t *testing.T) {
	ctx := testContext(testProfile(func(p *Profile) {
		p.Reagenzien = []Reagent{{Reagenz: "koh", Reaktion: "Fleisch verfärbt sich nicht, anders als beim Nachbarn, der gelb wird."}}
	}), nil)
	_, children := build(t, ctx)
	if len(children.Changes) != 0 {
		t.Fatal(children.Changes)
	}
}

func TestLinkToTheProfileAddressGivesOneSource(t *testing.T) {
	ctx := testContext(testProfile(func(p *Profile) {
		p.Links = []Link{{Titel: "A", URL: "https://example.test/a/"}, {Titel: "B", URL: "https://example.test/b"}}
	}), nil)
	_, children := build(t, ctx)
	if len(children.Sources) != 2 || children.Sources[1].Title != "B" || children.Sources[1].Position != 1 {
		t.Fatal(children.Sources)
	}
}

func TestTheProfileSourceTakesItsTitleElseTheHost(t *testing.T) {
	_, plain := build(t, testContext(testProfile(nil), nil))
	_, titled := build(t, testContext(testProfile(func(p *Profile) { p.Quelle.Titel = "Beispiel" }), nil))
	if plain.Sources[0].Title != HostTitle(plain.Sources[0].URL) || titled.Sources[0].Title != "Beispiel" {
		t.Fatal(plain.Sources[0], titled.Sources[0])
	}
}

func TestReagentChangeIgnoresNegationAndOtherSpecies(t *testing.T) {
	for _, text := range []string{
		"Fleisch und Huthaut verfärben sich nicht, anders als beim Kegelhütigen Knollenblätterpilz, der gelb wird.",
		"Fleisch und Huthaut bleiben unverfärbt, anders als beim Kegelhütigen Knollenblätterpilz, der gelb wird.",
		"Negativ bis leicht kartonbraun.",
		"Keine Reaktion.",
	} {
		if _, name, _, ok := ReagentChange(text, reagentColours); ok {
			t.Errorf("%q gave %q", text, name)
		}
	}
}
