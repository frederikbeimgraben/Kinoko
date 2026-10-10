package importer

import (
	"encoding/json"
	"fmt"
	"io/fs"
	"path"
	"slices"
	"strings"

	"github.com/BurntSushi/toml"
)

// Profile is one species file under daten/arten. The tables farben, masse and
// merkmale keep the key order of the file because the result depends on it.
// Entwurf is true when nobody has reviewed the descriptions.
type Profile struct {
	Name               string
	Lateinisch         string
	Gruppe             string
	Speisewert         string
	Marktfaehig        bool
	Karte              *string
	Haeufigkeit        *string
	Gefaehrdung        *string
	SpeisewertHinweis  *string
	SchutzHinweis      *string
	Beschreibung       *string
	BeschreibungEn     *string
	Entwurf            bool
	Jahreszeiten       []string
	Baeume             []string
	BaeumeAusErfahrung *ExperienceTrees
	WeitereNamen       []string
	Synonyme           []string
	Hutmerkmale        []string
	Stielmerkmale      []string
	Hutrand            *CapMarginEntry
	Hutform            *CapShapeEntry
	Ringform           *string
	Fruchtschicht      *HymeniumEntry
	Zeitraum           *Period
	Geruch             *Sense
	Geschmack          *Sense
	Schutz             ProtectionEntry
	Quelle             SourceEntry
	Links              []Link
	Reagenzien         []Reagent
	Verwechslungen     []Lookalike
	Masse              []Span
	Farben             []ColourSet
	Merkmale           []TraitText
	Teilnotizen        []PartNoteText
}

// ExperienceTrees are trees known from experience, not from the source.
type ExperienceTrees struct {
	Baeume []string `toml:"baeume"`
}

// CapMarginEntry is the cap margin when young and, if it changes, when old.
type CapMarginEntry struct {
	Von  []string  `toml:"von"`
	Nach *[]string `toml:"nach"`
}

// CapShapeEntry is the cap shape when young and when old.
type CapShapeEntry struct {
	Von  *string `toml:"von"`
	Nach *string `toml:"nach"`
}

// HymeniumEntry describes the spore-bearing surface.
type HymeniumEntry struct {
	Art      *string `toml:"art"`
	Ansatz   *string `toml:"ansatz"`
	Stand    *string `toml:"stand"`
	Schneide *string `toml:"schneide"`
}

// Period is the season of the fruit bodies in months.
type Period struct {
	VonMonat    *int `toml:"vonMonat"`
	BisMonat    *int `toml:"bisMonat"`
	SpitzeMonat *int `toml:"spitzeMonat"`
}

// Sense is the smell or the taste: tags and a free text.
type Sense struct {
	Tags []string `toml:"tags"`
	Text *string  `toml:"text"`
}

// ProtectionEntry is the protection status.
type ProtectionEntry struct {
	Status string `toml:"status"`
}

// SourceEntry is the main source of the profile. Without a title, the host name of the address is the title.
type SourceEntry struct {
	Titel      string `toml:"titel"`
	URL        string `toml:"url"`
	GeprueftAm string `toml:"geprueftAm"`
}

// Link is a further source.
type Link struct {
	Titel string `toml:"titel"`
	URL   string `toml:"url"`
}

// Reagent is the text of a reaction to a reagent.
type Reagent struct {
	Reagenz  string `toml:"reagenz"`
	Reaktion string `toml:"reaktion"`
}

// Lookalike names another species by its file stem and the difference.
type Lookalike struct {
	Slug               string  `toml:"slug"`
	Unterschied        string  `toml:"unterschied"`
	EigenerUnterschied *string `toml:"eigenerUnterschied"`
}

// Span is one measurement of the table masse.
type Span struct {
	Key     string
	Von     float64 `toml:"von"`
	Bis     float64 `toml:"bis"`
	Einheit string  `toml:"einheit"`
}

// NamedColour is a colour word with its hex value.
type NamedColour struct {
	Name string `toml:"name"`
	Hex  string `toml:"hex"`
}

// ColourChange is the entry farben.verfaerbung.
type ColourChange struct {
	Von   []NamedColour `toml:"von"`
	Nach  []NamedColour `toml:"nach"`
	Dauer *string       `toml:"dauer"`
}

// ColourSet is one key of the table farben. Change is set only for "verfaerbung".
type ColourSet struct {
	Key     string
	Colours []NamedColour
	Change  *ColourChange
}

// PartNoteText is one key of the table teilnotizen: the note and the comment of a body part.
type PartNoteText struct {
	Key          string
	Beschreibung string `toml:"beschreibung"`
	Kommentar    string `toml:"kommentar"`
}

// TraitText is one key of the table merkmale.
type TraitText struct {
	Key  string
	Text string
}

const changeKey = "verfaerbung"

type rawProfile struct {
	Name               string                    `toml:"name"`
	Lateinisch         string                    `toml:"lateinisch"`
	Gruppe             string                    `toml:"gruppe"`
	Speisewert         string                    `toml:"speisewert"`
	Marktfaehig        bool                      `toml:"marktfaehig"`
	Karte              *string                   `toml:"karte"`
	Haeufigkeit        *string                   `toml:"haeufigkeit"`
	Gefaehrdung        *string                   `toml:"gefaehrdung"`
	SpeisewertHinweis  *string                   `toml:"speisewertHinweis"`
	SchutzHinweis      *string                   `toml:"schutzHinweis"`
	Beschreibung       *string                   `toml:"beschreibung"`
	BeschreibungEn     *string                   `toml:"beschreibungEn"`
	Entwurf            bool                      `toml:"entwurf"`
	Jahreszeiten       []string                  `toml:"jahreszeiten"`
	Baeume             []string                  `toml:"baeume"`
	BaeumeAusErfahrung *ExperienceTrees          `toml:"baeumeAusErfahrung"`
	WeitereNamen       []string                  `toml:"weitereNamen"`
	Synonyme           []string                  `toml:"synonyme"`
	Hutmerkmale        []string                  `toml:"hutmerkmale"`
	Stielmerkmale      []string                  `toml:"stielmerkmale"`
	Hutrand            *CapMarginEntry           `toml:"hutrand"`
	Hutform            *CapShapeEntry            `toml:"hutform"`
	Ringform           *string                   `toml:"ringform"`
	Fruchtschicht      *HymeniumEntry            `toml:"fruchtschicht"`
	Zeitraum           *Period                   `toml:"zeitraum"`
	Geruch             *Sense                    `toml:"geruch"`
	Geschmack          *Sense                    `toml:"geschmack"`
	Schutz             ProtectionEntry           `toml:"schutz"`
	Quelle             SourceEntry               `toml:"quelle"`
	Links              []Link                    `toml:"links"`
	Reagenzien         []Reagent                 `toml:"reagenzien"`
	Verwechslungen     []Lookalike               `toml:"verwechslungen"`
	Masse              map[string]Span           `toml:"masse"`
	Farben             map[string]toml.Primitive `toml:"farben"`
	Merkmale           map[string]string         `toml:"merkmale"`
	Teilnotizen        map[string]PartNoteText   `toml:"teilnotizen"`
}

// ParseProfile reads one TOML profile. The source names the file in errors.
func ParseProfile(text, source string) (Profile, error) {
	var raw rawProfile
	meta, err := toml.Decode(text, &raw)
	if err != nil {
		return Profile{}, fmt.Errorf("%s: %w", source, err)
	}
	farben, err := orderedColours(meta, raw.Farben, keyOrder(meta, "farben"), source)
	if err != nil {
		return Profile{}, err
	}
	return Profile{
		Name:               raw.Name,
		Lateinisch:         raw.Lateinisch,
		Gruppe:             raw.Gruppe,
		Speisewert:         raw.Speisewert,
		Marktfaehig:        raw.Marktfaehig,
		Karte:              raw.Karte,
		Haeufigkeit:        raw.Haeufigkeit,
		Gefaehrdung:        raw.Gefaehrdung,
		SpeisewertHinweis:  raw.SpeisewertHinweis,
		SchutzHinweis:      raw.SchutzHinweis,
		Beschreibung:       raw.Beschreibung,
		BeschreibungEn:     raw.BeschreibungEn,
		Entwurf:            raw.Entwurf,
		Jahreszeiten:       raw.Jahreszeiten,
		Baeume:             raw.Baeume,
		BaeumeAusErfahrung: raw.BaeumeAusErfahrung,
		WeitereNamen:       raw.WeitereNamen,
		Synonyme:           raw.Synonyme,
		Hutmerkmale:        raw.Hutmerkmale,
		Stielmerkmale:      raw.Stielmerkmale,
		Hutrand:            raw.Hutrand,
		Hutform:            raw.Hutform,
		Ringform:           raw.Ringform,
		Fruchtschicht:      raw.Fruchtschicht,
		Zeitraum:           raw.Zeitraum,
		Geruch:             raw.Geruch,
		Geschmack:          raw.Geschmack,
		Schutz:             raw.Schutz,
		Quelle:             raw.Quelle,
		Links:              raw.Links,
		Reagenzien:         raw.Reagenzien,
		Verwechslungen:     raw.Verwechslungen,
		Masse: mapInOrder(keyOrder(meta, "masse"), raw.Masse, func(key string, span Span) Span {
			span.Key = key
			return span
		}),
		Farben: farben,
		Merkmale: mapInOrder(keyOrder(meta, "merkmale"), raw.Merkmale, func(key, text string) TraitText {
			return TraitText{Key: key, Text: text}
		}),
		Teilnotizen: mapInOrder(keyOrder(meta, "teilnotizen"), raw.Teilnotizen, func(key string, note PartNoteText) PartNoteText {
			note.Key = key
			return note
		}),
	}, nil
}

// keyOrder gives the direct keys of a top-level table in document order.
func keyOrder(meta toml.MetaData, table string) []string {
	var keys []string
	for _, key := range meta.Keys() {
		if len(key) == 2 && key[0] == table && !slices.Contains(keys, key[1]) {
			keys = append(keys, key[1])
		}
	}
	return keys
}

func mapInOrder[V, T any](order []string, values map[string]V, f func(string, V) T) []T {
	out := make([]T, 0, len(values))
	for _, key := range order {
		if value, ok := values[key]; ok {
			out = append(out, f(key, value))
		}
	}
	return out
}

func orderedColours(meta toml.MetaData, raw map[string]toml.Primitive, order []string, source string) ([]ColourSet, error) {
	out := make([]ColourSet, 0, len(raw))
	for _, key := range order {
		primitive, ok := raw[key]
		if !ok {
			continue
		}
		set := ColourSet{Key: key}
		var err error
		if key == changeKey {
			set.Change = &ColourChange{}
			err = meta.PrimitiveDecode(primitive, set.Change)
		} else {
			err = meta.PrimitiveDecode(primitive, &set.Colours)
		}
		if err != nil {
			return nil, fmt.Errorf("%s: farben.%s: %w", source, key, err)
		}
		out = append(out, set)
	}
	return out, nil
}

// StemProfile is a profile with the stem of its file name.
type StemProfile struct {
	Stem    string
	Profile Profile
}

// LoadProfiles reads each arten/*.toml of the data folder, sorted by file name.
func LoadProfiles(data fs.FS) ([]StemProfile, error) {
	names, err := fs.Glob(data, "arten/*.toml")
	if err != nil {
		return nil, err
	}
	slices.Sort(names)
	out := make([]StemProfile, 0, len(names))
	for _, name := range names {
		body, err := fs.ReadFile(data, name)
		if err != nil {
			return nil, err
		}
		profile, err := ParseProfile(string(body), name)
		if err != nil {
			return nil, err
		}
		out = append(out, StemProfile{Stem: strings.TrimSuffix(path.Base(name), ".toml"), Profile: profile})
	}
	return out, nil
}

// TaxonEntry is one taxon of daten/taxonomie.json.
type TaxonEntry struct {
	Slug       string  `json:"slug"`
	Rang       string  `json:"rang"`
	Lateinisch string  `json:"lateinisch"`
	Name       string  `json:"name"`
	Elter      *string `json:"elter"`
}

// LoadTaxonEntries reads the taxa of daten/taxonomie.json.
func LoadTaxonEntries(data fs.FS) ([]TaxonEntry, error) {
	body, err := fs.ReadFile(data, "taxonomie.json")
	if err != nil {
		return nil, err
	}
	var file struct {
		Taxa []TaxonEntry `json:"taxa"`
	}
	if err := json.Unmarshal(body, &file); err != nil {
		return nil, fmt.Errorf("taxonomie.json: %w", err)
	}
	return file.Taxa, nil
}
