// Package exporter writes the catalogue of the database back into the seed
// files under daten/: the species profiles, the reactions and the glossary.
package exporter

import (
	"fmt"
	"strings"

	"github.com/BurntSushi/toml"

	"github.com/frederikbeimgraben/kinoko/backend/internal/modules/catalog/importer"
)

// File is one species profile with all its keys, also the keys that the importer does not read.
type File struct {
	Name               string
	Lateinisch         string
	Gruppe             string
	Speisewert         string
	Wertigkeit         *int64
	MarktfaehigSchweiz *bool
	Marktfaehig        bool
	Sammelbar          *bool
	Jahreszeiten       []string
	Baeume             []string
	Warnung            *string
	Karte              *string
	SpeisewertHinweis  *string
	SchutzHinweis      *string
	Haeufigkeit        *string
	Gefaehrdung        *string
	Beschreibung       *string
	BeschreibungEn     *string
	Entwurf            *bool
	WeitereNamen       []string
	Synonyme           []string
	Fruchtschicht      *importer.HymeniumEntry
	Hutform            *importer.CapShapeEntry
	Hutmerkmale        []string
	Hutrand            *importer.CapMarginEntry
	Stielmerkmale      []string
	BaeumeAusErfahrung *ExperienceTrees
	Quelle             importer.SourceEntry
	Reagenzien         []importer.Reagent
	Masse              []Span
	Zeitraum           *importer.Period
	Farben             []importer.ColourSet
	Geruch             *importer.Sense
	Geschmack          *importer.Sense
	Schutz             Protection
	Teilnotizen        []importer.PartNoteText
	Merkmale           []importer.TraitText
	Verwechslungen     []importer.Lookalike
	Links              []importer.Link
	// Orders keep the key order of the source file, by table path.
	Orders map[string][]string
}

// ExperienceTrees are the trees known from experience, with the source of the knowledge.
type ExperienceTrees struct {
	Baeume []string `toml:"baeume"`
	Quelle *string  `toml:"quelle"`
}

// Span is one measurement of the table masse. SeltenBis is the rare upper end.
type Span struct {
	Key       string
	Von       float64  `toml:"von"`
	Bis       float64  `toml:"bis"`
	SeltenBis *float64 `toml:"seltenBis"`
	Einheit   string   `toml:"einheit"`
}

// Protection is the table schutz.
type Protection struct {
	Status string  `toml:"status"`
	Quelle *string `toml:"quelle"`
}

type rawFile struct {
	Name               string                           `toml:"name"`
	Lateinisch         string                           `toml:"lateinisch"`
	Gruppe             string                           `toml:"gruppe"`
	Speisewert         string                           `toml:"speisewert"`
	Wertigkeit         *int64                           `toml:"wertigkeit"`
	MarktfaehigSchweiz *bool                            `toml:"marktfaehigSchweiz"`
	Marktfaehig        bool                             `toml:"marktfaehig"`
	Sammelbar          *bool                            `toml:"sammelbar"`
	Jahreszeiten       []string                         `toml:"jahreszeiten"`
	Baeume             []string                         `toml:"baeume"`
	Warnung            *string                          `toml:"warnung"`
	Karte              *string                          `toml:"karte"`
	SpeisewertHinweis  *string                          `toml:"speisewertHinweis"`
	SchutzHinweis      *string                          `toml:"schutzHinweis"`
	Haeufigkeit        *string                          `toml:"haeufigkeit"`
	Gefaehrdung        *string                          `toml:"gefaehrdung"`
	Beschreibung       *string                          `toml:"beschreibung"`
	BeschreibungEn     *string                          `toml:"beschreibungEn"`
	Entwurf            *bool                            `toml:"entwurf"`
	WeitereNamen       []string                         `toml:"weitereNamen"`
	Synonyme           []string                         `toml:"synonyme"`
	Fruchtschicht      *importer.HymeniumEntry          `toml:"fruchtschicht"`
	Hutform            *importer.CapShapeEntry          `toml:"hutform"`
	Hutmerkmale        []string                         `toml:"hutmerkmale"`
	Hutrand            *importer.CapMarginEntry         `toml:"hutrand"`
	Stielmerkmale      []string                         `toml:"stielmerkmale"`
	BaeumeAusErfahrung *ExperienceTrees                 `toml:"baeumeAusErfahrung"`
	Quelle             importer.SourceEntry             `toml:"quelle"`
	Reagenzien         []importer.Reagent               `toml:"reagenzien"`
	Masse              map[string]Span                  `toml:"masse"`
	Zeitraum           *importer.Period                 `toml:"zeitraum"`
	Farben             map[string]toml.Primitive        `toml:"farben"`
	Geruch             *importer.Sense                  `toml:"geruch"`
	Geschmack          *importer.Sense                  `toml:"geschmack"`
	Schutz             Protection                       `toml:"schutz"`
	Teilnotizen        map[string]importer.PartNoteText `toml:"teilnotizen"`
	Merkmale           map[string]string                `toml:"merkmale"`
	Verwechslungen     []importer.Lookalike             `toml:"verwechslungen"`
	Links              []importer.Link                  `toml:"links"`
}

// ParseFile reads a profile with all its keys. A key that File does not know is an error,
// so that an export never drops data.
func ParseFile(text, source string) (File, error) {
	var raw rawFile
	meta, err := toml.Decode(text, &raw)
	if err != nil {
		return File{}, fmt.Errorf("%s: %w", source, err)
	}
	orders := keyOrders(meta)
	farben, err := decodeColours(meta, raw.Farben, orders["farben"])
	if err != nil {
		return File{}, fmt.Errorf("%s: %w", source, err)
	}
	if undecoded := meta.Undecoded(); len(undecoded) > 0 {
		return File{}, fmt.Errorf("%s: unknown key %s", source, undecoded[0])
	}
	present := func(key string, list []string) []string {
		if list == nil && meta.IsDefined(strings.Split(key, ".")...) {
			return []string{}
		}
		return list
	}
	f := File{
		Name: raw.Name, Lateinisch: raw.Lateinisch, Gruppe: raw.Gruppe, Speisewert: raw.Speisewert,
		Wertigkeit: raw.Wertigkeit, MarktfaehigSchweiz: raw.MarktfaehigSchweiz, Marktfaehig: raw.Marktfaehig,
		Sammelbar: raw.Sammelbar, Jahreszeiten: present("jahreszeiten", raw.Jahreszeiten),
		Baeume: present("baeume", raw.Baeume), Warnung: raw.Warnung, Karte: raw.Karte,
		SpeisewertHinweis: raw.SpeisewertHinweis, SchutzHinweis: raw.SchutzHinweis, Haeufigkeit: raw.Haeufigkeit,
		Gefaehrdung: raw.Gefaehrdung, Beschreibung: raw.Beschreibung, BeschreibungEn: raw.BeschreibungEn,
		Entwurf:      raw.Entwurf,
		WeitereNamen: present("weitereNamen", raw.WeitereNamen), Synonyme: present("synonyme", raw.Synonyme),
		Fruchtschicht: raw.Fruchtschicht, Hutform: raw.Hutform, Hutmerkmale: present("hutmerkmale", raw.Hutmerkmale),
		Hutrand: raw.Hutrand, Stielmerkmale: present("stielmerkmale", raw.Stielmerkmale),
		BaeumeAusErfahrung: raw.BaeumeAusErfahrung, Quelle: raw.Quelle, Reagenzien: raw.Reagenzien,
		Zeitraum: raw.Zeitraum, Farben: farben, Geruch: raw.Geruch, Geschmack: raw.Geschmack, Schutz: raw.Schutz,
		Verwechslungen: raw.Verwechslungen, Links: raw.Links, Orders: orders,
	}
	for _, key := range orders["masse"] {
		span := raw.Masse[key]
		span.Key = key
		f.Masse = append(f.Masse, span)
	}
	for _, key := range orders["merkmale"] {
		f.Merkmale = append(f.Merkmale, importer.TraitText{Key: key, Text: raw.Merkmale[key]})
	}
	for _, key := range orders["teilnotizen"] {
		note := raw.Teilnotizen[key]
		note.Key = key
		f.Teilnotizen = append(f.Teilnotizen, note)
	}
	if f.Hutrand != nil && f.Hutrand.Von == nil {
		f.Hutrand.Von = []string{}
	}
	for _, set := range f.Farben {
		if set.Change != nil {
			set.Change.Von = presentColours(meta, set.Change.Von, "von")
			set.Change.Nach = presentColours(meta, set.Change.Nach, "nach")
		}
	}
	for key, sense := range map[string]*importer.Sense{"geruch": f.Geruch, "geschmack": f.Geschmack} {
		if sense != nil {
			sense.Tags = present(key+".tags", sense.Tags)
		}
	}
	return f, nil
}

// keyOrders gives the direct keys of each table in document order. The path of a table joins its keys with dots.
func keyOrders(meta toml.MetaData) map[string][]string {
	orders := map[string][]string{}
	for _, key := range meta.Keys() {
		parent := strings.Join(key[:len(key)-1], ".")
		last := key[len(key)-1]
		if !contains(orders[parent], last) {
			orders[parent] = append(orders[parent], last)
		}
	}
	return orders
}

func decodeColours(meta toml.MetaData, raw map[string]toml.Primitive, order []string) ([]importer.ColourSet, error) {
	var out []importer.ColourSet
	for _, key := range order {
		set := importer.ColourSet{Key: key}
		var err error
		if key == changeKey {
			set.Change = &importer.ColourChange{}
			err = meta.PrimitiveDecode(raw[key], set.Change)
		} else {
			set.Colours = []importer.NamedColour{}
			err = meta.PrimitiveDecode(raw[key], &set.Colours)
		}
		if err != nil {
			return nil, fmt.Errorf("farben.%s: %w", key, err)
		}
		out = append(out, set)
	}
	return out, nil
}

func presentColours(meta toml.MetaData, list []importer.NamedColour, key string) []importer.NamedColour {
	if list == nil && meta.IsDefined("farben", changeKey, key) {
		return []importer.NamedColour{}
	}
	return list
}

const changeKey = "verfaerbung"

func contains[T comparable](list []T, value T) bool {
	for _, item := range list {
		if item == value {
			return true
		}
	}
	return false
}
