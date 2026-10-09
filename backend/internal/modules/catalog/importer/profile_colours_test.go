package importer

import (
	"regexp"
	"strings"
	"testing"
)

// colourStems give the stem of a colour name as it shows in a trait text, also inside a word.
var colourStems = map[string]string{
	"blau": "(bl[aä]u)", "rot": "(r[oö]t)", "braun": "(br[aä]un)", "grau": "(gr[aä]u)", "schwarz": "(schw[aä]rz)",
	"weiß": "(wei(ß|ss))", "rosa": "(rosa|rosig)",
}

// colourDenied tells if the text denies each mention of the colour: a negation word comes at most
// two words before it in the same clause.
func colourDenied(text, name string) bool {
	stem, ok := colourStems[name]
	if !ok {
		stem = "(" + regexp.QuoteMeta(name) + ")"
	}
	lowered := strings.ToLower(text)
	mentions := regexp.MustCompile(stem).FindAllStringIndex(lowered, -1)
	denials := regexp.MustCompile(`\b(nicht|nie|keine?|kaum)\s+([^\s.,;]+\s+){0,2}?[^\s.,;]*?`+stem).FindAllStringIndex(lowered, -1)
	return len(mentions) > 0 && len(mentions) == len(denials)
}

func TestColourDenied(t *testing.T) {
	cases := map[string]bool{
		"Weiß, nicht blauend.":                    true,
		"Der ganze Pilz hat keine Rottöne.":       true,
		"Nie ganz braun ohne rotviolette Töne.":   true,
		"Nicht blauend oder nur leicht grünblau.": false,
		"Kaum abziehbar, darunter blau.":          false,
		"Nicht blauend, im Alter blau.":           false,
		"Weiß, schnell stark blauend.":            false,
	}
	for text, want := range cases {
		name := "blau"
		if strings.Contains(text, "Rot") {
			name = "rot"
		}
		if strings.Contains(text, "braun") {
			name = "braun"
		}
		if got := colourDenied(text, name); got != want {
			t.Errorf("%q %s: %v", text, name, got)
		}
	}
	if colourDenied("Nie ganz braun ohne rotviolette Töne.", "rot") {
		t.Error("the red of the second clause is not denied")
	}
}

// partTraits give the trait texts that tell the colours of a key of the table farben.
var partTraits = map[string][]string{
	"hut": {"hut"}, "stiel": {"stiel"}, "fleisch": {"fleisch"}, "sporenpulver": {"sporenpulver"},
	"sporenlager": {"lamellen", "roehren", "leisten", "stacheln", "poren"},
}

func TestNoProfileColourIsDeniedByItsTraitText(t *testing.T) {
	profiles, err := LoadProfiles(realData(t))
	if err != nil {
		t.Fatal(err)
	}
	for _, p := range profiles {
		traits := map[string]string{}
		for _, trait := range p.Profile.Merkmale {
			traits[trait.Key] = trait.Text
		}
		for _, set := range p.Profile.Farben {
			keys, ok := partTraits[set.Key]
			if !ok {
				continue
			}
			text := ""
			for _, key := range keys {
				text += traits[key] + " "
			}
			for _, colour := range set.Colours {
				if colourDenied(text, colour.Name) {
					t.Errorf("%s: %s %s: %q", p.Stem, set.Key, colour.Name, text)
				}
			}
		}
	}
}
