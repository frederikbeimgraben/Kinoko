package archive

import (
	"bufio"
	"encoding/csv"
	"errors"
	"fmt"
	"io"
	"strings"
)

// TSVOptions sets the format of delimited text.
// Quote 0 means that fields have no enclosure: a quote is a normal character.
type TSVOptions struct {
	Delim rune
	Quote rune
}

// TSVReader reads delimited text one record at a time.
// Records can have different field counts. A UTF-8 byte order mark at the start is removed.
type TSVReader struct {
	br    *bufio.Reader
	csv   *csv.Reader
	delim string
	line  int
}

// utf8BOM is the byte order mark that some tools write at the start of UTF-8 text.
const utf8BOM = "\ufeff"

// NewTSVReader gives a reader for r. Delim 0 means a tab.
// With Quote '"' it uses encoding/csv with LazyQuotes, so a bad quote does not stop the read.
func NewTSVReader(r io.Reader, opt TSVOptions) (*TSVReader, error) {
	if opt.Delim == 0 {
		opt.Delim = '\t'
	}
	br := bufio.NewReaderSize(r, 1<<20)
	if bom, err := br.Peek(len(utf8BOM)); err == nil && string(bom) == utf8BOM {
		// Peek holds these bytes, so Discard cannot fail.
		_, _ = br.Discard(len(utf8BOM))
	}
	t := &TSVReader{br: br, delim: string(opt.Delim)}
	switch opt.Quote {
	case 0:
	case '"':
		t.csv = csv.NewReader(br)
		t.csv.Comma = opt.Delim
		t.csv.LazyQuotes = true
		t.csv.FieldsPerRecord = -1
	default:
		return nil, fmt.Errorf("archive: quote %q is not supported", opt.Quote)
	}
	return t, nil
}

// Read gives the next record. It gives io.EOF after the last record.
// Without quotes, an empty line gives one empty field. With quotes, encoding/csv skips empty lines.
func (t *TSVReader) Read() ([]string, error) {
	t.line++
	if t.csv != nil {
		rec, err := t.csv.Read()
		if err != nil && !errors.Is(err, io.EOF) {
			return nil, fmt.Errorf("archive: line %d: %w", t.line, err)
		}
		return rec, err
	}
	s, err := t.br.ReadString('\n')
	if errors.Is(err, io.EOF) && s == "" {
		return nil, io.EOF
	}
	if err != nil && !errors.Is(err, io.EOF) {
		return nil, fmt.Errorf("archive: line %d: %w", t.line, err)
	}
	s = strings.TrimSuffix(strings.TrimSuffix(s, "\n"), "\r")
	return strings.Split(s, t.delim), nil
}

// Line gives the number of the record that Read gave last, from 1.
// With quotes, a record can cover more than one line of text.
func (t *TSVReader) Line() int { return t.line }
