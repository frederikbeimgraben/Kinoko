package exporter

import (
	"slices"

	"github.com/frederikbeimgraben/kinoko/backend/internal/fn"
	"github.com/frederikbeimgraben/kinoko/backend/internal/modules/catalog/importer"
)

// word gives the German word of a mapped value. The word of the source file wins when it maps to the value.
func word(table map[string]string, value string, preferred ...string) (string, bool) {
	for _, w := range preferred {
		if mapped, ok := table[w]; ok && mapped == value {
			return w, true
		}
	}
	for _, w := range fn.SortedKeys(table) {
		if table[w] == value {
			return w, true
		}
	}
	return "", false
}

// optionalWord maps an optional value. A value without a word stays absent and gives a warning.
func (s *speciesExport) optionalWord(table map[string]string, value, preferred *string, field string) *string {
	if value == nil {
		return nil
	}
	w, ok := word(table, *value, deref(preferred))
	if !ok {
		s.warn("%s %q has no word in the seed format", field, *value)
		return nil
	}
	return &w
}

// requiredWord maps a value that the seed format needs. Without a word the value of the source file stays.
func (s *speciesExport) requiredWord(table map[string]string, value, preferred, field string) string {
	w, ok := word(table, value, preferred)
	if !ok {
		s.warn("%s %q has no word in the seed format", field, value)
		return preferred
	}
	return w
}

// words maps the values to German words. The source words keep their order, new words follow.
func (s *speciesExport) words(table map[string]string, source, values []string, field string) []string {
	var current []string
	for _, v := range values {
		w, ok := word(table, v, source...)
		if !ok {
			s.warn("%s %q has no word in the seed format", field, v)
			continue
		}
		current = append(current, w)
	}
	return keepOrder(source, current)
}

// keepOrder gives the words of current: first those of source in source order, then the others.
func keepOrder(source, current []string) []string {
	out := []string{}
	for _, w := range source {
		if slices.Contains(current, w) && !slices.Contains(out, w) {
			out = append(out, w)
		}
	}
	for _, w := range current {
		if !slices.Contains(out, w) {
			out = append(out, w)
		}
	}
	return out
}

// tagWord gives the tag of a smell or taste slug.
func tagWord(names map[string]string, slug string, source []string) (string, bool) {
	for _, w := range source {
		if importer.Slugify(w) == slug {
			return w, true
		}
	}
	for _, w := range fn.SortedKeys(names) {
		if importer.Slugify(w) == slug {
			return w, true
		}
	}
	return "", false
}

// treeWord gives the tree word of a tree slug.
func treeWord(slug string, source []string) (string, bool) {
	for _, w := range source {
		if tree, ok := importer.TreeVocabulary[w]; ok && tree.Slug == slug {
			return w, true
		}
	}
	for _, w := range fn.SortedKeys(importer.TreeVocabulary) {
		if importer.TreeVocabulary[w].Slug == slug {
			return w, true
		}
	}
	return "", false
}
