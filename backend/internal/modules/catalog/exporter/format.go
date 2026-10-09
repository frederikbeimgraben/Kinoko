package exporter

import (
	"github.com/frederikbeimgraben/kinoko/backend/internal/modules/catalog/importer"
)

// canonical gives the key order of each table for keys that the source file did not have.
var canonical = map[string][]string{
	"": {"name", "lateinisch", "gruppe", "speisewert", "wertigkeit", "marktfaehigSchweiz", "marktfaehig",
		"sammelbar", "jahreszeiten", "baeume", "warnung", "karte", "speisewertHinweis", "schutzHinweis",
		"haeufigkeit", "gefaehrdung", "beschreibung", "weitereNamen", "synonyme", "fruchtschicht", "hutform",
		"hutmerkmale", "hutrand", "stielmerkmale", "baeumeAusErfahrung", "quelle", "reagenzien", "masse",
		"zeitraum", "farben", "geruch", "geschmack", "schutz", "teilnotizen", "merkmale", "verwechslungen", "links"},
	"masse": {"hutBreiteCm", "fruchtkoerperBreiteCm", "fruchtkoerperHoeheCm", "stielLaengeCm", "stielDickeCm",
		"sporenLaengeUm", "sporenBreiteUm"},
	"farben": {"hut", "sporenlager", "stiel", "fleisch", "sporenpulver", "verfaerbung"},
	"merkmale": {"hut", "fruchtkoerper", "roehren", "lamellen", "stacheln", "leisten", "poren", "milch", "stiel",
		"fleisch", "geruch", "geschmack", "sporenpulver", "reagenzien", "vorkommen", "zeit", "speisewert", "schutz"},
	"teilnotizen": {"fruchtkoerper", "hut", "stiel", "ring", "stielbasis", "lamellen", "roehren", "poren",
		"fleisch", "sporenpulver", "sporen"},
}

// Format writes a profile in the style of the seed files.
func Format(f File) []byte {
	return render(arrange(topLevel(f), f.Orders[""], canonical[""]))
}

type builder []kv

func (b *builder) add(key string, value any) { *b = append(*b, kv{key, value}) }

func (b *builder) text(key string, value *string) {
	if value != nil {
		b.add(key, *value)
	}
}

func (b *builder) list(key string, value []string) {
	if value != nil {
		b.add(key, value)
	}
}

func topLevel(f File) []kv {
	var b builder
	b.add("name", f.Name)
	b.add("lateinisch", f.Lateinisch)
	b.add("gruppe", f.Gruppe)
	b.add("speisewert", f.Speisewert)
	if f.Wertigkeit != nil {
		b.add("wertigkeit", *f.Wertigkeit)
	}
	if f.MarktfaehigSchweiz != nil {
		b.add("marktfaehigSchweiz", *f.MarktfaehigSchweiz)
	}
	b.add("marktfaehig", f.Marktfaehig)
	if f.Sammelbar != nil {
		b.add("sammelbar", *f.Sammelbar)
	}
	b.add("jahreszeiten", orEmpty(f.Jahreszeiten))
	b.add("baeume", orEmpty(f.Baeume))
	b.text("warnung", f.Warnung)
	b.text("karte", f.Karte)
	b.text("speisewertHinweis", f.SpeisewertHinweis)
	b.text("schutzHinweis", f.SchutzHinweis)
	b.text("haeufigkeit", f.Haeufigkeit)
	b.text("gefaehrdung", f.Gefaehrdung)
	b.text("beschreibung", f.Beschreibung)
	b.list("weitereNamen", f.WeitereNamen)
	b.list("synonyme", f.Synonyme)
	if h := f.Fruchtschicht; h != nil {
		var t builder
		t.text("art", h.Art)
		t.text("ansatz", h.Ansatz)
		t.text("stand", h.Stand)
		t.text("schneide", h.Schneide)
		b.add("fruchtschicht", inline(arrange(t, f.Orders["fruchtschicht"], nil)))
	}
	if s := f.Hutform; s != nil {
		var t builder
		t.text("von", s.Von)
		t.text("nach", s.Nach)
		b.add("hutform", inline(t))
	}
	b.list("hutmerkmale", f.Hutmerkmale)
	if m := f.Hutrand; m != nil {
		t := builder{{"von", orEmpty(m.Von)}}
		if m.Nach != nil {
			t.add("nach", orEmpty(*m.Nach))
		}
		b.add("hutrand", inline(t))
	}
	b.list("stielmerkmale", f.Stielmerkmale)
	sections(&b, f)
	return b
}

func sections(b *builder, f File) {
	if e := f.BaeumeAusErfahrung; e != nil {
		t := builder{{"baeume", orEmpty(e.Baeume)}}
		t.text("quelle", e.Quelle)
		b.add("baeumeAusErfahrung", section(t))
	}
	b.add("quelle", section{{"titel", f.Quelle.Titel}, {"url", f.Quelle.URL}, {"geprueftAm", f.Quelle.GeprueftAm}})
	if len(f.Reagenzien) > 0 {
		items := make([]section, len(f.Reagenzien))
		for i, r := range f.Reagenzien {
			items[i] = section{{"reagenz", r.Reagenz}, {"reaktion", r.Reaktion}}
		}
		b.add("reagenzien", items)
	}
	if len(f.Masse) > 0 {
		var t builder
		for _, s := range f.Masse {
			span := builder{{"von", s.Von}, {"bis", s.Bis}}
			if s.SeltenBis != nil {
				span.add("seltenBis", *s.SeltenBis)
			}
			span.add("einheit", s.Einheit)
			t.add(s.Key, inline(span))
		}
		b.add("masse", section(arrange(t, f.Orders["masse"], canonical["masse"])))
	}
	if p := f.Zeitraum; p != nil {
		var t builder
		for _, month := range []struct {
			key   string
			value *int
		}{{"vonMonat", p.VonMonat}, {"bisMonat", p.BisMonat}, {"spitzeMonat", p.SpitzeMonat}} {
			if month.value != nil {
				t.add(month.key, *month.value)
			}
		}
		b.add("zeitraum", section(t))
	}
	if len(f.Farben) > 0 {
		b.add("farben", section(arrange(colourTable(f.Farben), f.Orders["farben"], canonical["farben"])))
	}
	senses(b, f)
	b.add("schutz", protection(f.Schutz))
	if len(f.Teilnotizen) > 0 {
		var t builder
		for _, n := range f.Teilnotizen {
			t.add(n.Key, inline{{"beschreibung", n.Beschreibung}, {"kommentar", n.Kommentar}})
		}
		b.add("teilnotizen", section(arrange(t, f.Orders["teilnotizen"], canonical["teilnotizen"])))
	}
	if len(f.Merkmale) > 0 {
		var t builder
		for _, m := range f.Merkmale {
			t.add(m.Key, m.Text)
		}
		b.add("merkmale", section(arrange(t, f.Orders["merkmale"], canonical["merkmale"])))
	}
	lists(b, f)
}

func protection(p Protection) section {
	t := builder{{"status", p.Status}}
	t.text("quelle", p.Quelle)
	return section(t)
}

func senses(b *builder, f File) {
	for _, s := range []struct {
		key   string
		sense *importer.Sense
	}{{"geruch", f.Geruch}, {"geschmack", f.Geschmack}} {
		if s.sense == nil {
			continue
		}
		var t builder
		t.list("tags", s.sense.Tags)
		t.text("text", s.sense.Text)
		b.add(s.key, section(t))
	}
}

func lists(b *builder, f File) {
	if len(f.Verwechslungen) > 0 {
		items := make([]section, len(f.Verwechslungen))
		for i, v := range f.Verwechslungen {
			t := builder{{"slug", v.Slug}, {"unterschied", v.Unterschied}}
			t.text("eigenerUnterschied", v.EigenerUnterschied)
			items[i] = section(t)
		}
		b.add("verwechslungen", items)
	}
	if len(f.Links) > 0 {
		items := make([]section, len(f.Links))
		for i, l := range f.Links {
			items[i] = section{{"titel", l.Titel}, {"url", l.URL}}
		}
		b.add("links", items)
	}
}

func colourTable(sets []importer.ColourSet) builder {
	var t builder
	for _, set := range sets {
		if set.Key != changeKey {
			t.add(set.Key, colours(set.Colours))
			continue
		}
		if set.Change == nil {
			continue
		}
		var c builder
		if set.Change.Von != nil {
			c.add("von", colours(set.Change.Von))
		}
		if set.Change.Nach != nil {
			c.add("nach", colours(set.Change.Nach))
		}
		c.text("dauer", set.Change.Dauer)
		t.add(changeKey, section(c))
	}
	return t
}

func colours(list []importer.NamedColour) []inline {
	out := make([]inline, len(list))
	for i, c := range list {
		out[i] = inline{{"name", c.Name}, {"hex", c.Hex}}
	}
	return out
}

func orEmpty(list []string) []string {
	if list == nil {
		return []string{}
	}
	return list
}
