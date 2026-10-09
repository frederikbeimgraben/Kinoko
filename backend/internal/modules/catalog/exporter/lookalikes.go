package exporter

import (
	"bytes"
	"slices"

	"github.com/frederikbeimgraben/kinoko/backend/internal/core/db"
	"github.com/frederikbeimgraben/kinoko/backend/internal/modules/catalog/importer"
)

type pairKey [2]db.ID

func keyOf(a, b db.ID) pairKey {
	if bytes.Compare(a[:], b[:]) > 0 {
		a, b = b, a
	}
	return pairKey{a, b}
}

// owner is the species whose profile writes a lookalike pair.
type owner struct {
	stem  string
	entry importer.Lookalike
	done  bool
}

// lookalikes gives the entries verwechslungen of each stem. The import keeps the first entry of
// a pair in file order, so a second entry of the source files stays only behind the owner.
func lookalikes(pairs []importer.LookalikeRow, ids map[string]db.ID, base map[string]File, report *Report) map[string][]importer.Lookalike {
	stems := map[db.ID]string{}
	for stem, id := range ids {
		stems[id] = stem
	}
	declared := map[pairKey][]string{}
	for _, stem := range sortedStems(base) {
		for _, e := range base[stem].Verwechslungen {
			own, okOwn := ids[stem]
			other, okOther := ids[e.Slug]
			if okOwn && okOther {
				k := keyOf(own, other)
				declared[k] = append(declared[k], stem)
			}
		}
	}
	owners := map[pairKey]*owner{}
	for _, p := range pairs {
		k := keyOf(p.SpeciesAID, p.SpeciesBID)
		sides := map[string]importer.Lookalike{}
		if p.DifferenceB != nil {
			sides[stems[p.SpeciesAID]] = importer.Lookalike{Slug: stems[p.SpeciesBID], Unterschied: *p.DifferenceB, EigenerUnterschied: p.DifferenceA}
		}
		if p.DifferenceA != nil {
			sides[stems[p.SpeciesBID]] = importer.Lookalike{Slug: stems[p.SpeciesAID], Unterschied: *p.DifferenceA, EigenerUnterschied: p.DifferenceB}
		}
		candidates := sortedStems(sides)
		if len(candidates) == 0 {
			report.Warnings = append(report.Warnings, stems[p.SpeciesAID]+": lookalike "+stems[p.SpeciesBID]+" without text")
			continue
		}
		chosen := candidates[0]
		if i := slices.IndexFunc(declared[k], func(stem string) bool { _, ok := sides[stem]; return ok }); i >= 0 {
			chosen = declared[k][i]
		}
		owners[k] = &owner{stem: chosen, entry: sides[chosen]}
	}
	out := map[string][]importer.Lookalike{}
	for _, stem := range sortedStems(base) {
		own, exported := ids[stem]
		if !exported {
			continue
		}
		for _, e := range base[stem].Verwechslungen {
			other, known := ids[e.Slug]
			if _, inSource := base[e.Slug]; !inSource {
				out[stem] = append(out[stem], e)
				continue
			}
			o, stored := owners[keyOf(own, other)]
			switch {
			case !known || !stored:
			case o.stem == stem && !o.done:
				o.done = true
				out[stem] = append(out[stem], o.entry)
			case stem > o.stem:
				out[stem] = append(out[stem], e)
			}
		}
	}
	var added []*owner
	for _, o := range owners {
		if !o.done {
			added = append(added, o)
		}
	}
	slices.SortFunc(added, func(a, b *owner) int {
		if a.stem != b.stem {
			return compare(a.stem, b.stem)
		}
		return compare(a.entry.Slug, b.entry.Slug)
	})
	for _, o := range added {
		out[o.stem] = append(out[o.stem], o.entry)
	}
	return out
}

func compare(a, b string) int {
	switch {
	case a < b:
		return -1
	case a > b:
		return 1
	}
	return 0
}

func sortedStems[V any](m map[string]V) []string {
	out := make([]string, 0, len(m))
	for k := range m {
		out = append(out, k)
	}
	slices.Sort(out)
	return out
}
