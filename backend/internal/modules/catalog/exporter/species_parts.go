package exporter

import (
	"slices"

	"github.com/frederikbeimgraben/kinoko/backend/internal/core/enums"
	"github.com/frederikbeimgraben/kinoko/backend/internal/fn"
	"github.com/frederikbeimgraben/kinoko/backend/internal/modules/catalog/importer"
)

// phases gives the features of a body part from a value table, for the young and the old phase.
func (s *speciesExport) phases(part enums.BodyPart, table map[string]string) (young, old []string) {
	values := fn.Set(fn.Map(fn.SortedKeys(table), func(w string) string { return table[w] }))
	for _, row := range s.db.Features {
		if row.Part != part {
			continue
		}
		if _, ok := values[row.Feature]; !ok {
			continue
		}
		if row.Phase == enums.PhaseYoung && !slices.Contains(young, row.Feature) {
			young = append(young, row.Feature)
		}
		if row.Phase == enums.PhaseOld && !slices.Contains(old, row.Feature) {
			old = append(old, row.Feature)
		}
	}
	return young, old
}

func sameSet(a, b []string) bool {
	return len(a) == len(b) && fn.All(a, func(x string) bool { return slices.Contains(b, x) })
}

// bothPhases gives the features of a list that applies to the young and the old phase.
func (s *speciesExport) bothPhases(part enums.BodyPart, table map[string]string, source []string, field string) []string {
	young, old := s.phases(part, table)
	if !sameSet(young, old) {
		s.warn("%s differ between young and old; the seed format gives both phases", field)
	}
	values := keepOrder(young, old)
	if len(values) == 0 && source == nil {
		return nil
	}
	return s.words(table, source, values, field)
}

func (s *speciesExport) features(f *File) {
	f.Hutmerkmale = s.bothPhases(enums.BodyPartCap, importer.CapFeature, s.base.Hutmerkmale, "cap features")
	f.Stielmerkmale = s.bothPhases(enums.BodyPartStem, importer.StemFeature, s.base.Stielmerkmale, "stem features")
	young, old := s.phases(enums.BodyPartCap, importer.CapMargin)
	f.Hutrand = nil
	if len(young) == 0 && len(old) == 0 {
		return
	}
	var sourceYoung []string
	var sourceOld *[]string
	if s.base.Hutrand != nil {
		sourceYoung, sourceOld = s.base.Hutrand.Von, s.base.Hutrand.Nach
	}
	margin := &importer.CapMarginEntry{Von: s.words(importer.CapMargin, sourceYoung, young, "cap margin")}
	if !sameSet(young, old) || sourceOld != nil {
		var source []string
		if sourceOld != nil {
			source = *sourceOld
		}
		later := s.words(importer.CapMargin, source, old, "cap margin")
		margin.Nach = &later
	}
	f.Hutrand = margin
}

func (s *speciesExport) measures() []Span {
	var out []Span
	for _, m := range s.db.Measures {
		key, ok := "", false
		for _, k := range fn.SortedKeys(importer.MeasurementKeys) {
			if target := importer.MeasurementKeys[k]; target.Part == m.Part && target.Dimension == m.Dimension {
				key, ok = k, true
			}
		}
		if !ok {
			s.warn("measurement %s %s has no key in the seed format", m.Part, m.Dimension)
			continue
		}
		span := Span{Key: key, Von: m.Low, Bis: m.High, Einheit: m.Unit}
		if i := slices.IndexFunc(s.base.Masse, func(b Span) bool { return b.Key == key }); i >= 0 {
			source := s.base.Masse[i]
			unchanged := source.Von == m.Low && source.Bis == m.High
			if source.SeltenBis != nil && (unchanged || *source.SeltenBis > m.High) {
				span.SeltenBis = source.SeltenBis
			}
		}
		out = append(out, span)
	}
	return out
}

// colourKey gives the key of the table farben for a body part.
func (s *speciesExport) colourKey(part enums.BodyPart) (string, bool) {
	if key, ok := word(fn.ToMap(fn.SortedKeys(importer.ColourParts), func(k string) (string, string) {
		return k, string(importer.ColourParts[k])
	}), string(part)); ok {
		return key, true
	}
	hymenium := ""
	if s.db.Row.HymeniumType != nil {
		hymenium = *s.db.Row.HymeniumType
	}
	if importer.HymeniumBodyParts[hymenium] == part {
		return "sporenlager", true
	}
	return "", false
}

func (s *speciesExport) colours() []importer.ColourSet {
	var out []importer.ColourSet
	for _, part := range s.db.PartColour {
		list := s.db.Colours[part]
		key, ok := s.colourKey(part)
		if !ok {
			s.warn("colours of %s have no key in the seed format", part)
			continue
		}
		mode := enums.ColourModeDistinct
		if len(list) == 1 {
			mode = enums.ColourModeSingle
		}
		if stored, ok := s.db.Modes[part]; ok && stored != mode {
			s.warn("colour mode %s of %s becomes %s on import", stored, part, mode)
		}
		out = append(out, importer.ColourSet{Key: key, Colours: list})
	}
	// The import skips an empty list and a sporenlager without a hymenium part, so these stay as in the source file.
	for _, set := range s.base.Farben {
		has := slices.ContainsFunc(out, func(o importer.ColourSet) bool { return o.Key == set.Key })
		skipped := len(set.Colours) == 0 || (set.Key == "sporenlager" && !s.hasHymeniumPart())
		if set.Key != changeKey && !has && skipped {
			out = append(out, set)
		}
	}
	if change := s.cutChange(); change != nil {
		out = append(out, importer.ColourSet{Key: changeKey, Change: change})
	}
	return out
}

func (s *speciesExport) hasHymeniumPart() bool {
	if s.db.Row.HymeniumType == nil {
		return false
	}
	_, ok := importer.HymeniumBodyParts[*s.db.Row.HymeniumType]
	return ok
}

func isCut(c change) bool {
	return c.Part == enums.BodyPartFlesh && c.From == nil && slices.Equal(c.Triggers, []string{importer.CutTriggerSlug})
}

func isReagent(c change) bool {
	if c.From != nil || len(c.Triggers) != 1 {
		return false
	}
	_, ok := importer.ReagentName[c.Triggers[0]]
	return ok
}

// cutChange gives the table farben.verfaerbung: the colours after a cut. The colours before stay from the source file.
func (s *speciesExport) cutChange() *importer.ColourChange {
	var source *importer.ColourChange
	for _, set := range s.base.Farben {
		if set.Key == changeKey {
			source = set.Change
		}
	}
	out := &importer.ColourChange{Nach: []importer.NamedColour{}}
	for _, c := range s.db.Changes {
		switch {
		case isCut(c):
			out.Nach = append(out.Nach, c.To)
			if c.Speed != nil && out.Dauer == nil {
				out.Dauer = s.optionalWord(importer.Speed, c.Speed, sourceSpeed(source), "speed")
			}
		case !isReagent(c):
			s.warn("colour change of %s to %s with triggers %v has no form in the seed format", c.Part, c.To.Name, c.Triggers)
		}
	}
	if source == nil && len(out.Nach) == 0 {
		return nil
	}
	out.Von = []importer.NamedColour{}
	if source != nil {
		out.Von = source.Von
		if source.Nach == nil && len(out.Nach) == 0 {
			out.Nach = nil
		}
	}
	return out
}

func sourceSpeed(c *importer.ColourChange) *string {
	if c == nil {
		return nil
	}
	return c.Dauer
}
