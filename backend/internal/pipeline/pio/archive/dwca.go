package archive

import (
	"encoding/xml"
	"fmt"
	"io"
	"strconv"
	"strings"
)

// Field maps a column of a DwC-A data file to a term URI.
// Index is -1 for a field that has only a Default value for each row.
type Field struct {
	Index   int
	Term    string
	Default string
}

// CoreMeta is the core file entry of a DwC-A meta.xml.
type CoreMeta struct {
	RowType      string
	Location     string
	Encoding     string
	Delim        rune
	Quote        rune
	IgnoreHeader int
	IDIndex      int
	Fields       []Field
	Metadata     string
}

type xmlArchive struct {
	Metadata string  `xml:"metadata,attr"`
	Core     xmlCore `xml:"core"`
}

type xmlCore struct {
	RowType            string     `xml:"rowType,attr"`
	Encoding           string     `xml:"encoding,attr"`
	FieldsTerminatedBy *string    `xml:"fieldsTerminatedBy,attr"`
	FieldsEnclosedBy   *string    `xml:"fieldsEnclosedBy,attr"`
	IgnoreHeaderLines  string     `xml:"ignoreHeaderLines,attr"`
	Locations          []string   `xml:"files>location"`
	ID                 *xmlIndex  `xml:"id"`
	Fields             []xmlField `xml:"field"`
}

type xmlIndex struct {
	Index string `xml:"index,attr"`
}

type xmlField struct {
	Index   *string `xml:"index,attr"`
	Term    string  `xml:"term,attr"`
	Default string  `xml:"default,attr"`
}

// ParseMeta reads the core entry of a DwC-A meta.xml. Missing attributes take the
// defaults of the DwC text guide: comma, double quote, no header line, UTF-8.
func ParseMeta(r io.Reader) (CoreMeta, error) {
	var doc xmlArchive
	if err := xml.NewDecoder(r).Decode(&doc); err != nil {
		return CoreMeta{}, fmt.Errorf("archive: meta.xml: %w", err)
	}
	c := doc.Core
	if len(c.Locations) == 0 {
		return CoreMeta{}, fmt.Errorf("archive: meta.xml: core has no file location")
	}
	m := CoreMeta{RowType: c.RowType, Location: strings.TrimSpace(c.Locations[0]),
		Encoding: or(c.Encoding, "UTF-8"), Delim: ',', Quote: '"', IDIndex: -1, Metadata: doc.Metadata}
	if c.FieldsTerminatedBy != nil {
		d := []rune(unescape(*c.FieldsTerminatedBy))
		if len(d) != 1 {
			return CoreMeta{}, fmt.Errorf("archive: meta.xml: delimiter %q is not one character", *c.FieldsTerminatedBy)
		}
		m.Delim = d[0]
	}
	if c.FieldsEnclosedBy != nil {
		q := []rune(unescape(*c.FieldsEnclosedBy))
		m.Quote = 0
		if len(q) > 0 {
			m.Quote = q[0]
		}
	}
	var err error
	if m.IgnoreHeader, err = atoiOr(c.IgnoreHeaderLines, 0); err != nil {
		return CoreMeta{}, fmt.Errorf("archive: meta.xml: ignoreHeaderLines: %w", err)
	}
	if c.ID != nil {
		if m.IDIndex, err = atoiOr(c.ID.Index, -1); err != nil {
			return CoreMeta{}, fmt.Errorf("archive: meta.xml: id index: %w", err)
		}
	}
	for _, f := range c.Fields {
		idx := -1
		if f.Index != nil {
			if idx, err = strconv.Atoi(strings.TrimSpace(*f.Index)); err != nil {
				return CoreMeta{}, fmt.Errorf("archive: meta.xml: field %s: %w", f.Term, err)
			}
		}
		m.Fields = append(m.Fields, Field{Index: idx, Term: f.Term, Default: f.Default})
	}
	return m, nil
}

// unescape decodes the backslash escapes that meta.xml uses for tab and line ends.
func unescape(s string) string {
	return strings.NewReplacer(`\t`, "\t", `\n`, "\n", `\r`, "\r", `\\`, `\`).Replace(s)
}

func or(s, fallback string) string {
	if s == "" {
		return fallback
	}
	return s
}

func atoiOr(s string, fallback int) (int, error) {
	if strings.TrimSpace(s) == "" {
		return fallback, nil
	}
	return strconv.Atoi(strings.TrimSpace(s))
}

// ShortTerm gives the local name of a term URI, for example "decimalLatitude"
// for "http://rs.tdwg.org/dwc/terms/decimalLatitude".
func ShortTerm(uri string) string {
	if i := strings.LastIndexAny(uri, "/#:"); i >= 0 {
		return uri[i+1:]
	}
	return uri
}

// Columns gives a map from term to column index. It holds the full URI and the
// short name of each term. When two URIs have the same short name, the first one wins.
func (m CoreMeta) Columns() map[string]int {
	out := map[string]int{}
	for _, f := range m.Fields {
		if f.Index < 0 {
			continue
		}
		out[f.Term] = f.Index
		if _, ok := out[ShortTerm(f.Term)]; !ok {
			out[ShortTerm(f.Term)] = f.Index
		}
	}
	return out
}

// Defaults gives the constant values of the fields that have a default, by full URI and short name.
func (m CoreMeta) Defaults() map[string]string {
	out := map[string]string{}
	for _, f := range m.Fields {
		if f.Default == "" {
			continue
		}
		out[f.Term] = f.Default
		if _, ok := out[ShortTerm(f.Term)]; !ok {
			out[ShortTerm(f.Term)] = f.Default
		}
	}
	return out
}
