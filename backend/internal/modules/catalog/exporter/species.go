package exporter

import (
	"fmt"
	"slices"
	"strings"

	"github.com/frederikbeimgraben/kinoko/backend/internal/core/enums"
	"github.com/frederikbeimgraben/kinoko/backend/internal/modules/catalog/importer"
)

// speciesExport builds the profile of one species: the values of the database over the
// source file. The keys that the database does not hold keep their values from the source file.
type speciesExport struct {
	stem       string
	base       File
	db         *stored
	report     *Report
	vocabulary map[string]string
}

func (s *speciesExport) warn(format string, args ...any) {
	s.report.Warnings = append(s.report.Warnings, s.stem+": "+fmt.Sprintf(format, args...))
}

func (s *speciesExport) build() File {
	f := s.base
	r := s.db.Row
	f.Name, f.Lateinisch, f.Marktfaehig = r.Name, r.LatinName, r.Marketable
	f.Gruppe = s.requiredWord(importer.Group, r.GroupKey, s.base.Gruppe, "group")
	f.Speisewert = s.requiredWord(importer.Edibility, r.Edibility, s.base.Speisewert, "edibility")
	f.Schutz.Status = s.requiredWord(importer.Protection, r.Protection, s.base.Schutz.Status, "protection")
	f.Haeufigkeit = s.optionalWord(importer.Frequency, r.Frequency, s.base.Haeufigkeit, "frequency")
	f.Gefaehrdung = s.optionalWord(importer.RedList, r.RedList, s.base.Gefaehrdung, "red list")
	f.SpeisewertHinweis, f.SchutzHinweis, f.Beschreibung = r.EdibilityNote, r.ProtectionNote, r.Description
	f.Karte = nil
	if r.ForecastEnabled {
		f.Karte = s.base.Karte
		if f.Karte == nil {
			f.Karte = &s.stem
		}
	}
	f.Zeitraum = nil
	if r.PeriodStartMonth != nil || r.PeriodEndMonth != nil || r.PeriodPeakMonth != nil {
		f.Zeitraum = &importer.Period{VonMonat: r.PeriodStartMonth, BisMonat: r.PeriodEndMonth, SpitzeMonat: r.PeriodPeakMonth}
	}
	f.Jahreszeiten = s.words(importer.Season, s.base.Jahreszeiten, s.db.Seasons, "season")
	f.WeitereNamen = names(s.db.Names, enums.NameKindCommon, s.base.WeitereNamen)
	f.Synonyme = names(s.db.Names, enums.NameKindSynonym, s.base.Synonyme)
	f.Fruchtschicht = s.hymenium()
	f.Hutform = nil
	if r.CapShapeYoung != nil || r.CapShapeOld != nil {
		var young, old *string
		if s.base.Hutform != nil {
			young, old = s.base.Hutform.Von, s.base.Hutform.Nach
		}
		f.Hutform = &importer.CapShapeEntry{
			Von:  s.optionalWord(importer.CapShape, r.CapShapeYoung, young, "cap shape"),
			Nach: s.optionalWord(importer.CapShape, r.CapShapeOld, old, "cap shape"),
		}
	}
	s.features(&f)
	s.trees(&f)
	f.Geruch = s.sense(s.base.Geruch, r.SmellText, enums.TermKindSmell, importer.SmellName)
	f.Geschmack = s.sense(s.base.Geschmack, r.TasteText, enums.TermKindTaste, importer.TasteName)
	f.Masse = s.measures()
	f.Farben, f.Reagenzien = s.colours(), s.reagents()
	f.Merkmale, f.Teilnotizen = s.traits(), s.notes()
	s.sources(&f)
	s.checkTaxon()
	return f
}

// names keeps the key of the source file with an empty list when the database has no name of the kind.
func names(rows []importer.NameRow, kind enums.NameKind, source []string) []string {
	var out []string
	for _, row := range rows {
		if row.Kind == kind {
			out = append(out, row.Name)
		}
	}
	if out == nil && source != nil {
		return []string{}
	}
	return out
}

func (s *speciesExport) hymenium() *importer.HymeniumEntry {
	r := s.db.Row
	source := importer.HymeniumEntry{}
	if s.base.Fruchtschicht != nil {
		source = *s.base.Fruchtschicht
	}
	out := importer.HymeniumEntry{
		Art:      s.optionalWord(importer.HymeniumType, r.HymeniumType, source.Art, "hymenium"),
		Ansatz:   s.optionalWord(importer.GillAttachment, r.GillAttachment, source.Ansatz, "gill attachment"),
		Stand:    s.optionalWord(importer.GillSpacing, r.GillSpacing, source.Stand, "gill spacing"),
		Schneide: s.optionalWord(importer.GillEdge, r.GillEdge, source.Schneide, "gill edge"),
	}
	if out.Art == nil && out.Ansatz == nil && out.Stand == nil && out.Schneide == nil {
		return nil
	}
	return &out
}

func (s *speciesExport) sense(source *importer.Sense, text *string, kind enums.TermKind, vocabulary map[string]string) *importer.Sense {
	var sourceTags []string
	if source != nil {
		sourceTags = source.Tags
	}
	var tags []string
	for _, link := range s.db.Terms {
		if link.Kind != kind {
			continue
		}
		tag, ok := tagWord(vocabulary, link.Slug, sourceTags)
		if !ok {
			s.warn("%s term %q has no tag in the seed format", kind, link.Slug)
			continue
		}
		tags = append(tags, tag)
	}
	tags = keepOrder(sourceTags, tags)
	if source == nil && len(tags) == 0 && text == nil {
		return nil
	}
	return &importer.Sense{Tags: tags, Text: text}
}

// trees splits the tree terms into baeume and baeumeAusErfahrung. A tree in both lists of the
// source file has one row, so the experience list keeps it while the row exists.
func (s *speciesExport) trees(f *File) {
	var plain, experience []string
	var sourceExperience []string
	if s.base.BaeumeAusErfahrung != nil {
		sourceExperience = s.base.BaeumeAusErfahrung.Baeume
	}
	for _, link := range s.db.Terms {
		if link.Kind != enums.TermKindTree {
			continue
		}
		source := s.base.Baeume
		if link.Experience {
			source = sourceExperience
		}
		w, ok := treeWord(link.Slug, source)
		if !ok {
			s.warn("tree term %q has no word in the seed format", link.Slug)
			continue
		}
		if link.Experience {
			experience = append(experience, w)
		} else {
			plain = append(plain, w)
		}
	}
	for _, w := range sourceExperience {
		if slices.Contains(plain, w) && slices.Contains(s.base.Baeume, w) {
			experience = append(experience, w)
		}
	}
	f.Baeume = keepOrder(s.base.Baeume, plain)
	f.BaeumeAusErfahrung = nil
	if len(experience) > 0 {
		var quelle *string
		if s.base.BaeumeAusErfahrung != nil {
			quelle = s.base.BaeumeAusErfahrung.Quelle
		}
		f.BaeumeAusErfahrung = &ExperienceTrees{Baeume: keepOrder(sourceExperience, experience), Quelle: quelle}
	}
}

func (s *speciesExport) traits() []importer.TraitText {
	var out []importer.TraitText
	for _, t := range s.db.Traits {
		key, ok := word(importer.TraitKey, t.Key)
		if !ok {
			s.warn("trait %q has no key in the seed format", t.Key)
			continue
		}
		out = append(out, importer.TraitText{Key: key, Text: t.Body})
	}
	return out
}

func (s *speciesExport) notes() []importer.PartNoteText {
	var out []importer.PartNoteText
	for _, n := range s.db.Notes {
		key, ok := word(importer.PartNoteKey, string(n.Part))
		if !ok {
			s.warn("part note %q has no key in the seed format", n.Part)
			continue
		}
		out = append(out, importer.PartNoteText{Key: key, Beschreibung: n.Description, Kommentar: n.Comment})
	}
	return out
}

func (s *speciesExport) checkTaxon() {
	fields := strings.Fields(s.db.Row.LatinName)
	if s.db.TaxonSlug == nil || len(fields) == 0 {
		return
	}
	if *s.db.TaxonRank != string(enums.TaxonRankGenus) || *s.db.TaxonSlug != importer.Slugify(fields[0]) {
		s.warn("taxon %q is not the genus of the latin name; the import takes the genus", *s.db.TaxonSlug)
	}
}
