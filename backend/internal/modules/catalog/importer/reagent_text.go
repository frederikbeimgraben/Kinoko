package importer

import (
	"regexp"
	"slices"
	"strings"
	"unicode"

	"github.com/frederikbeimgraben/kinoko/backend/internal/core/enums"
)

var (
	sentenceBreak = regexp.MustCompile(`[.!?]`)
	clauseBreak   = regexp.MustCompile(`[,;:]`)
)

// negations mark a clause that tells no change.
var negations = []string{"nicht", "kein", "keine", "keiner", "ohne", "negativ", "unverändert", "unverfärbt",
	"kaum", "höchstens", "vs"}

// comparisons mark the start of a part of a sentence about another species.
var comparisons = []string{"anders", "ähnliche", "ähnlichen", "gegensatz", "während"}

func has(clause string, words []string) bool {
	found := strings.FieldsFunc(clause, func(r rune) bool { return !unicode.IsLetter(r) })
	return slices.ContainsFunc(found, func(word string) bool { return slices.Contains(words, word) })
}

// partWords give the body part of a clause. The longer word comes first, so "stielbasis" wins over "stiel".
var partWords = []struct {
	word string
	part enums.BodyPart
}{
	{"stielbasis", enums.BodyPartStemBase},
	{"fleisch", enums.BodyPartFlesh},
	{"huthaut", enums.BodyPartCap},
	{"hutoberfläche", enums.BodyPartCap},
	{"hut", enums.BodyPartCap},
	{"stiel", enums.BodyPartStem},
	{"röhren", enums.BodyPartTubes},
	{"poren", enums.BodyPartPores},
	{"lamellen", enums.BodyPartGills},
}

// ReagentChange reads the colour and the body part of a free reaction text.
// It uses the first clause that tells a colour. A negated or compared clause gives no colour.
func ReagentChange(text string, vocabulary map[string]string) (part enums.BodyPart, name, hex string, ok bool) {
	for _, sentence := range sentenceBreak.Split(strings.ToLower(text), -1) {
		for _, clause := range clauseBreak.Split(sentence, -1) {
			if has(clause, comparisons) {
				break
			}
			if has(clause, negations) {
				continue
			}
			if name, hex, found := FindColour(clause, vocabulary); found {
				return partOf(clause), name, hex, true
			}
		}
	}
	return "", "", "", false
}

// partOf gives the body part that a clause names first. Without a name, the reagent goes on the flesh.
func partOf(clause string) enums.BodyPart {
	best, at := enums.BodyPartFlesh, len(clause)
	for _, one := range partWords {
		if index := strings.Index(clause, one.word); index >= 0 && index < at {
			best, at = one.part, index
		}
	}
	return best
}
