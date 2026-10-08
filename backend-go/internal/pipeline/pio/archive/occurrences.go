package archive

import (
	"encoding/xml"
	"errors"
	"fmt"
	"io"
	"iter"
	"path"
	"slices"
	"strings"
	"time"
)

// Archive formats of a GBIF download.
const (
	FormatDwCA      = "dwca"
	FormatSimpleCSV = "simple_csv"
)

// occurrenceRowType is the DwC row type of an occurrence core.
const occurrenceRowType = "http://rs.tdwg.org/dwc/terms/Occurrence"

// OccurrenceTerms are the columns that a GBIF archive upload must have (plan section 7.1).
var OccurrenceTerms = []string{
	"gbifID", "kingdom", "class", "species", "decimalLatitude", "decimalLongitude",
	"coordinateUncertaintyInMeters", "eventDate", "year", "month", "day",
	"recordedBy", "basisOfRecord", "countryCode",
}

// Occurrences is an open GBIF download zip: a DwC-A with an occurrence core,
// or a SIMPLE_CSV file. It streams the rows and does not unpack the zip.
type Occurrences struct {
	zip      *Zip
	format   string
	dir      string
	core     CoreMeta
	cols     map[string]int
	defaults map[string]string
}

// OpenOccurrences opens a GBIF download zip and reads its column map.
// It uses meta.xml when the zip has one. Else it takes the one *.csv file and its header.
func OpenOccurrences(zipPath string) (*Occurrences, error) {
	z, err := OpenZip(zipPath)
	if err != nil {
		return nil, err
	}
	o, err := openOccurrences(z)
	if err != nil {
		z.Close()
		return nil, fmt.Errorf("archive: %s: %w", zipPath, err)
	}
	return o, nil
}

func openOccurrences(z *Zip) (*Occurrences, error) {
	if metas := z.Find(func(n string) bool { return path.Base(n) == "meta.xml" }); len(metas) > 0 {
		slices.SortFunc(metas, func(a, b string) int { return strings.Count(a, "/") - strings.Count(b, "/") })
		return openDwCA(z, metas[0])
	}
	csvs := z.Find(func(n string) bool { return strings.EqualFold(path.Ext(n), ".csv") })
	if len(csvs) != 1 {
		return nil, fmt.Errorf("no meta.xml and %d *.csv files, expected one", len(csvs))
	}
	return openSimpleCSV(z, csvs[0])
}

func openDwCA(z *Zip, metaName string) (*Occurrences, error) {
	r, err := z.Open(metaName)
	if err != nil {
		return nil, err
	}
	defer r.Close()
	core, err := ParseMeta(r)
	if err != nil {
		return nil, err
	}
	if core.RowType != occurrenceRowType {
		return nil, fmt.Errorf("core row type %q is not %s", core.RowType, occurrenceRowType)
	}
	if !strings.EqualFold(strings.ReplaceAll(core.Encoding, "-", ""), "UTF8") {
		return nil, fmt.Errorf("core encoding %q is not UTF-8", core.Encoding)
	}
	return &Occurrences{zip: z, format: FormatDwCA, dir: path.Dir(metaName), core: core,
		cols: core.Columns(), defaults: core.Defaults()}, nil
}

// openSimpleCSV reads the header of a GBIF SIMPLE_CSV file: tab-separated, no quotes, one header line.
func openSimpleCSV(z *Zip, name string) (*Occurrences, error) {
	core := CoreMeta{RowType: occurrenceRowType, Location: name, Encoding: "UTF-8",
		Delim: '\t', IgnoreHeader: 1, IDIndex: -1}
	r, err := z.Open(name)
	if err != nil {
		return nil, err
	}
	defer r.Close()
	tr, err := NewTSVReader(r, TSVOptions{Delim: core.Delim})
	if err != nil {
		return nil, err
	}
	header, err := tr.Read()
	if err != nil {
		return nil, fmt.Errorf("%s: header: %w", name, err)
	}
	for i, h := range header {
		core.Fields = append(core.Fields, Field{Index: i, Term: strings.TrimSpace(h)})
	}
	return &Occurrences{zip: z, format: FormatSimpleCSV, dir: ".", core: core,
		cols: core.Columns(), defaults: map[string]string{}}, nil
}

// Close closes the zip.
func (o *Occurrences) Close() error { return o.zip.Close() }

// Format gives FormatDwCA or FormatSimpleCSV.
func (o *Occurrences) Format() string { return o.format }

// Core gives the core file description. For SIMPLE_CSV it comes from the header.
func (o *Occurrences) Core() CoreMeta { return o.core }

// Missing gives the terms of required that the archive has neither as a column nor as a default.
func (o *Occurrences) Missing(required []string) []string {
	var out []string
	for _, term := range required {
		_, col := o.cols[term]
		_, def := o.defaults[term]
		if !col && !def {
			out = append(out, term)
		}
	}
	return out
}

// Record is one row of the core file.
type Record struct {
	fields   []string
	cols     map[string]int
	defaults map[string]string
}

// Get gives the value of a term, by short name or full URI. A missing column gives its
// meta.xml default or "". An empty field also gives the default, as the DwC text guide says.
func (r Record) Get(term string) string {
	if i, ok := r.cols[term]; ok && i < len(r.fields) && r.fields[i] != "" {
		return r.fields[i]
	}
	return r.defaults[term]
}

// Fields gives the raw fields of the row.
func (r Record) Fields() []string { return r.fields }

// Records gives the rows of the core file after the header lines.
// It streams the zip entry. The sequence stops after the first error.
func (o *Occurrences) Records() iter.Seq2[Record, error] {
	return func(yield func(Record, error) bool) {
		name := path.Join(o.dir, o.core.Location)
		r, err := o.zip.Open(name)
		if err != nil {
			yield(Record{}, err)
			return
		}
		defer r.Close()
		tr, err := NewTSVReader(r, TSVOptions{Delim: o.core.Delim, Quote: o.core.Quote})
		if err != nil {
			yield(Record{}, err)
			return
		}
		for skip := o.core.IgnoreHeader; ; skip-- {
			fields, err := tr.Read()
			if errors.Is(err, io.EOF) {
				return
			}
			if err != nil {
				yield(Record{}, fmt.Errorf("archive: %s: %w", name, err))
				return
			}
			if skip > 0 || (len(fields) == 1 && fields[0] == "") {
				continue
			}
			if !yield(Record{fields: fields, cols: o.cols, defaults: o.defaults}, nil) {
				return
			}
		}
	}
}

// PubDate gives the pubDate of the EML metadata file of a DwC-A. ok is false when the
// archive has no metadata file or no valid pubDate.
func (o *Occurrences) PubDate() (date time.Time, ok bool, err error) {
	if o.core.Metadata == "" {
		return time.Time{}, false, nil
	}
	r, err := o.zip.Open(path.Join(o.dir, o.core.Metadata))
	if err != nil {
		return time.Time{}, false, nil
	}
	defer r.Close()
	dec := xml.NewDecoder(r)
	for {
		tok, err := dec.Token()
		if errors.Is(err, io.EOF) {
			return time.Time{}, false, nil
		}
		if err != nil {
			return time.Time{}, false, fmt.Errorf("archive: %s: %w", o.core.Metadata, err)
		}
		start, isStart := tok.(xml.StartElement)
		if !isStart || start.Name.Local != "pubDate" {
			continue
		}
		var text string
		if err := dec.DecodeElement(&text, &start); err != nil {
			return time.Time{}, false, fmt.Errorf("archive: %s: pubDate: %w", o.core.Metadata, err)
		}
		text = strings.TrimSpace(text)
		if len(text) < 10 {
			return time.Time{}, false, nil
		}
		d, err := time.Parse("2006-01-02", text[:10])
		return d, err == nil, nil
	}
}
