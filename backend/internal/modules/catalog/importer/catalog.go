package importer

import (
	"bytes"
	"fmt"
	"slices"

	"github.com/frederikbeimgraben/kinoko/backend/internal/core/db"
	"github.com/frederikbeimgraben/kinoko/backend/internal/core/enums"
	"github.com/frederikbeimgraben/kinoko/backend/internal/fn"
)

// Report counts the written rows and the skipped cases of one import.
type Report struct {
	Counts  map[string]int
	Skipped map[string]int
}

// NewReport makes an empty report.
func NewReport() *Report {
	return &Report{Counts: map[string]int{}, Skipped: map[string]int{}}
}

// Skip counts one skipped case.
func (r *Report) Skip(key string) { r.Skipped[key]++ }

// TaxonRow is one row of the table taxon.
type TaxonRow struct {
	ID        db.ID
	Rank      enums.TaxonRank
	Slug      string
	Name      string
	LatinName string
	ParentID  *db.ID
}

var rankOrder = map[enums.TaxonRank]int{
	enums.TaxonRankDivision: 0,
	enums.TaxonRankClass:    1,
	enums.TaxonRankOrder:    2,
	enums.TaxonRankFamily:   3,
	enums.TaxonRankGenus:    4,
}

// LoadTaxonomy builds the taxon rows, sorted by rank so that each parent comes
// first, and the key of each genus by its slug.
func LoadTaxonomy(entries []TaxonEntry, newID func() db.ID) ([]TaxonRow, map[string]db.ID, error) {
	ids := fn.ToMap(entries, func(entry TaxonEntry) (string, db.ID) { return entry.Slug, newID() })
	rows := make([]TaxonRow, 0, len(entries))
	genus := map[string]db.ID{}
	for _, entry := range entries {
		rank, err := Lookup(TaxonRank, entry.Rang, "rang", "taxonomie.json:"+entry.Slug)
		if err != nil {
			return nil, nil, err
		}
		row := TaxonRow{
			ID:        ids[entry.Slug],
			Rank:      enums.TaxonRank(rank),
			Slug:      Slugify(entry.Lateinisch),
			Name:      entry.Name,
			LatinName: entry.Lateinisch,
		}
		if entry.Elter != nil && *entry.Elter != "" {
			if parent, ok := ids[*entry.Elter]; ok {
				row.ParentID = &parent
			}
		}
		rows = append(rows, row)
		if row.Rank == enums.TaxonRankGenus {
			genus[row.Slug] = row.ID
		}
	}
	slices.SortStableFunc(rows, func(a, b TaxonRow) int { return rankOrder[a.Rank] - rankOrder[b.Rank] })
	return rows, genus, nil
}

// TermRow is one row of the table term.
type TermRow struct {
	ID       db.ID
	Kind     enums.TermKind
	GroupKey *enums.TriggerGroup
	Slug     string
	Name     string
	Position int
}

type termKey struct {
	kind enums.TermKind
	slug string
}

// Terms are the terms of the catalogue with their keys.
type Terms struct {
	Rows []TermRow
	ids  map[termKey]db.ID
}

// NewTerms indexes term rows by kind and slug.
func NewTerms(rows []TermRow) Terms {
	ids := fn.ToMap(rows, func(row TermRow) (termKey, db.ID) { return termKey{row.Kind, row.Slug}, row.ID })
	return Terms{Rows: rows, ids: ids}
}

// IDFor gives the key of a term.
func (t Terms) IDFor(kind enums.TermKind, slug string) (db.ID, error) {
	id, ok := t.ids[termKey{kind, slug}]
	if !ok {
		return db.ID{}, fmt.Errorf("term %s/%s is missing", kind, slug)
	}
	return id, nil
}

// ColourVocabulary collects each name and hex of the profiles. A later
// entry wins, in file order, then key order of farben, then list order.
func ColourVocabulary(profiles []StemProfile) map[string]string {
	vocabulary := map[string]string{}
	for _, p := range profiles {
		for _, set := range p.Profile.Farben {
			colours := set.Colours
			if set.Change != nil {
				colours = slices.Concat(set.Change.Von, set.Change.Nach)
			}
			for _, c := range colours {
				vocabulary[c.Name] = c.Hex
			}
		}
	}
	return vocabulary
}

func senseTags(s *Sense) []string {
	if s == nil {
		return nil
	}
	return s.Tags
}

func experienceTrees(p Profile) []string {
	if p.BaeumeAusErfahrung == nil {
		return nil
	}
	return p.BaeumeAusErfahrung.Baeume
}

func sortedSet(words []string) []string {
	return fn.SortedKeys(fn.Set(words))
}

func collect(profiles []StemProfile, words func(Profile) []string) []string {
	return sortedSet(fn.FlatMap(profiles, func(p StemProfile) []string { return words(p.Profile) }))
}

// BuildTerms builds each term in a fixed order: smells, tastes, trees, then
// the triggers (mechanical, reagents, environment).
func BuildTerms(profiles []StemProfile, newID func() db.ID) (Terms, error) {
	var rows []TermRow
	add := func(kind enums.TermKind, slug, name string, group *enums.TriggerGroup, position int) {
		rows = append(rows, TermRow{ID: newID(), Kind: kind, GroupKey: group, Slug: slug, Name: name, Position: position})
	}
	for position, word := range collect(profiles, func(p Profile) []string { return senseTags(p.Geruch) }) {
		name, err := Lookup(SmellName, word, "geruch", "geruch.tags")
		if err != nil {
			return Terms{}, err
		}
		add(enums.TermKindSmell, Slugify(word), name, nil, position)
	}
	for position, word := range collect(profiles, func(p Profile) []string { return senseTags(p.Geschmack) }) {
		name, err := Lookup(TasteName, word, "geschmack", "geschmack.tags")
		if err != nil {
			return Terms{}, err
		}
		add(enums.TermKindTaste, Slugify(word), name, nil, position)
	}
	trees := collect(profiles, func(p Profile) []string { return slices.Concat(p.Baeume, experienceTrees(p)) })
	for position, word := range trees {
		tree, err := treeEntry(word)
		if err != nil {
			return Terms{}, err
		}
		add(enums.TermKindTree, tree.Slug, tree.Name, nil, position)
	}
	reagents := collect(profiles, func(p Profile) []string {
		words := make([]string, len(p.Reagenzien))
		for i, r := range p.Reagenzien {
			words[i] = r.Reagenz
		}
		return words
	})
	mechanical, reagent, environment := enums.TriggerGroupMechanical, enums.TriggerGroupReagent, enums.TriggerGroupEnvironment
	position := 0
	for _, t := range TriggerMechanical {
		add(enums.TermKindTrigger, t.Slug, t.Name, &mechanical, position)
		position++
	}
	for _, word := range reagents {
		slug, err := Lookup(ReagentSlug, word, "reagenz", "reagenzien")
		if err != nil {
			return Terms{}, err
		}
		add(enums.TermKindTrigger, slug, ReagentName[slug], &reagent, position)
		position++
	}
	for _, t := range TriggerEnvironment {
		add(enums.TermKindTrigger, t.Slug, t.Name, &environment, position)
		position++
	}
	return NewTerms(rows), nil
}

// idLess orders keys by their bytes, as Python compares uuid.UUID values.
func idLess(a, b db.ID) bool { return bytes.Compare(a[:], b[:]) < 0 }
