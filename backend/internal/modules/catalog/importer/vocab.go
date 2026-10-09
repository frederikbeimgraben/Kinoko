package importer

import (
	"fmt"
	"regexp"
	"slices"
	"strings"
	"unicode"

	"github.com/frederikbeimgraben/kinoko/backend/internal/fn"
)

// UnknownVocabulary is a German profile value without an entry in a mapping table.
type UnknownVocabulary struct {
	Message string
}

// Error gives the message.
func (e *UnknownVocabulary) Error() string { return e.Message }

var (
	umlauts = strings.NewReplacer("ä", "ae", "ö", "oe", "ü", "ue", "Ä", "Ae", "Ö", "Oe", "Ü", "Ue", "ß", "ss")
	nonSlug = regexp.MustCompile(`[^a-z0-9]+`)
)

// Slugify makes a lowercase slug from a German text. Umlauts become two
// letters, other characters outside ASCII are removed.
func Slugify(text string) string {
	ascii := strings.Map(func(r rune) rune {
		if r > 127 {
			return -1
		}
		return r
	}, umlauts.Replace(text))
	return strings.Trim(nonSlug.ReplaceAllString(strings.ToLower(ascii), "-"), "-")
}

// Lookup gives the mapped value of a German value, or an UnknownVocabulary error.
func Lookup(table map[string]string, value, field, source string) (string, error) {
	mapped, ok := table[value]
	if !ok {
		return "", &UnknownVocabulary{Message: fmt.Sprintf("Unbekannter Wert '%s' für %s in %s.", value, field, source)}
	}
	return mapped, nil
}

// optionalLookup maps a value that can be absent. An absent value stays absent.
func optionalLookup(table map[string]string, value *string, field, source string) (*string, error) {
	if value == nil {
		return nil, nil
	}
	mapped, err := Lookup(table, *value, field, source)
	if err != nil {
		return nil, err
	}
	return &mapped, nil
}

// Tree is the slug and the German name of a tree term.
type Tree struct {
	Slug string
	Name string
}

// treeEntry gives the term of a tree word, or an UnknownVocabulary error.
func treeEntry(word string) (Tree, error) {
	tree, ok := TreeVocabulary[word]
	if !ok {
		return Tree{}, &UnknownVocabulary{Message: fmt.Sprintf("Unbekannter Baum '%s'.", word)}
	}
	return tree, nil
}

// Trigger is the slug and the German name of a trigger term.
type Trigger struct {
	Slug string
	Name string
}

// Group maps the German group word to the group key.
var Group = map[string]string{
	"roehrling":        "bolete",
	"raufussroehrling": "rough_stemmed_bolete",
	"schmierroehrling": "slippery_jack",
	"leistling":        "chanterelle",
	"stoppelpilz":      "hedgehog",
	"milchling":        "milkcap",
	"taeubling":        "brittlegill",
	"schirmling":       "parasol",
	"champignon":       "agaricus",
	"tintling":         "inkcap",
	"staeubling":       "puffball",
	"trichterling":     "funnel",
	"roetelritterling": "blewit",
	"hallimasch":       "honey_fungus",
	"schueppling":      "scalycap",
	"ruebling":         "toughshank",
	"schleimruebling":  "porcelain",
	"seitling":         "oyster",
	"stachelbart":      "lions_mane",
	"porling":          "polypore",
	"glucke":           "cauliflower",
	"ritterling":       "knight",
	"schwindling":      "parachute",
	"schneckling":      "woodwax",
	"wulstling":        "amanita",
	"morchel":          "morel",
	"ohrlappenpilz":    "jelly_ear",
	"gelbfuss":         "spike",
	"schleierling":     "webcap",
	"rasling":          "domecap",
	"roetling":         "pinkgill",
	"stachelpilz":      "spine_fungus",
	"becherling":       "cup_fungus",
}

// Edibility maps the German edibility word.
var Edibility = map[string]string{
	"essbar":         "edible",
	"bedingtEssbar":  "conditionally_edible",
	"ungeniessbar":   "inedible",
	"giftig":         "poisonous",
	"toedlichGiftig": "deadly",
}

// Protection maps the German protection status.
var Protection = map[string]string{
	"keiner":              "none",
	"besondersGeschuetzt": "personal_use",
	"strengGeschuetzt":    "strict",
}

// Frequency maps the German frequency word.
var Frequency = map[string]string{
	"sehrHaeufig": "very_common",
	"haeufig":     "common",
	"zerstreut":   "scattered",
	"selten":      "rare",
	"sehrSelten":  "very_rare",
}

// RedList maps the German red list status.
var RedList = map[string]string{
	"vomAussterbenBedroht": "critically_endangered",
	"starkGefaehrdet":      "endangered",
	"gefaehrdet":           "vulnerable",
	"unbekanntesAusmass":   "unknown_extent",
	"extremSelten":         "extremely_rare",
	"vorwarnliste":         "near_threatened",
	"datenUnzureichend":    "data_deficient",
}

// Season maps the German season word.
var Season = map[string]string{
	"fruehling": "spring",
	"sommer":    "summer",
	"herbst":    "autumn",
	"winter":    "winter",
}

// TaxonRank maps the German rank word.
var TaxonRank = map[string]string{
	"abteilung": "division",
	"klasse":    "class",
	"ordnung":   "order",
	"familie":   "family",
	"gattung":   "genus",
}

// Unit maps the unit of a measurement.
var Unit = map[string]string{"cm": "cm", "mm": "mm", "um": "um"}

// Speed maps the German speed of a colour change.
var Speed = map[string]string{"schnell": "immediate", "langsam": "longer"}

// CutTriggerSlug is the trigger of the colour change in a profile.
const CutTriggerSlug = "cut"

// colourAside marks the start of a side note after the main colour of a reading.
var colourAside = regexp.MustCompile(`\smit\s|\svs\.|\(|;`)

// colourSequence marks a reading that goes from one colour to the next. Then the last colour is the result.
var colourSequence = regexp.MustCompile(`\s(bis|dann|später|zuletzt)\s|→`)

// FindColour finds the colour of a reaction text. It reads the text before a side note.
// It gives the last colour of a sequence, else the first colour word.
func FindColour(text string, vocabulary map[string]string) (name, hex string, ok bool) {
	lowered := strings.ToLower(text)
	main := lowered
	if at := colourAside.FindStringIndex(lowered); at != nil {
		main = lowered[:at[0]]
	}
	if name, ok := pickColour(main, vocabulary); ok {
		return name, vocabulary[name], true
	}
	if name, ok := pickColour(lowered, vocabulary); ok {
		return name, vocabulary[name], true
	}
	return "", "", false
}

// pickColour gives the colour of a text. Of two overlapping colour words, the earlier one wins, then the longer one.
func pickColour(text string, vocabulary map[string]string) (string, bool) {
	type span struct {
		start, end int
		name       string
	}
	var spans []span
	for word := range vocabulary {
		if word == "" {
			continue
		}
		for from := 0; ; {
			index := strings.Index(text[from:], word)
			if index < 0 {
				break
			}
			start := from + index
			spans = append(spans, span{start, start + len(word), word})
			from = start + 1
		}
	}
	slices.SortFunc(spans, func(a, b span) int {
		if a.start != b.start {
			return a.start - b.start
		}
		return (b.end - b.start) - (a.end - a.start)
	})
	var kept []span
	for _, s := range spans {
		overlaps := slices.ContainsFunc(kept, func(k span) bool { return s.start < k.end && s.end > k.start })
		if !overlaps {
			kept = append(kept, s)
		}
	}
	// In a German compound word the last colour is the hue, so each word gives its last colour.
	heads := fn.Filter(kept, func(s span) bool {
		next := slices.IndexFunc(kept, func(k span) bool { return k.start > s.start })
		return next < 0 || strings.ContainsFunc(text[s.end:kept[next].start], func(r rune) bool { return !unicode.IsLetter(r) })
	})
	if len(heads) == 0 {
		return "", false
	}
	if colourSequence.MatchString(text) {
		return heads[len(heads)-1].name, true
	}
	return heads[0].name, true
}
