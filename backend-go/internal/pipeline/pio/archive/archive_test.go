package archive

import (
	"archive/zip"
	"errors"
	"io"
	"os"
	"path/filepath"
	"slices"
	"strings"
	"testing"
	"time"
)

// writeZip writes a zip with the given entries. Each value is the entry content.
func writeZip(t *testing.T, entries [][2]string) string {
	t.Helper()
	p := filepath.Join(t.TempDir(), "upload.zip")
	f, err := os.Create(p)
	if err != nil {
		t.Fatal(err)
	}
	zw := zip.NewWriter(f)
	for _, e := range entries {
		w, err := zw.Create(e[0])
		if err != nil {
			t.Fatal(err)
		}
		if _, err := io.WriteString(w, e[1]); err != nil {
			t.Fatal(err)
		}
	}
	if err := zw.Close(); err != nil {
		t.Fatal(err)
	}
	if err := f.Close(); err != nil {
		t.Fatal(err)
	}
	return p
}

// dwcaEntries reads the DwC-A fixture in testdata/dwca. It follows a GBIF download:
// meta.xml with term URIs and no field enclosure, occurrence.txt, metadata.xml and an extension.
func dwcaEntries(t *testing.T, prefix string) [][2]string {
	t.Helper()
	var out [][2]string
	for _, name := range []string{"meta.xml", "occurrence.txt", "metadata.xml", "verbatim.txt"} {
		raw, err := os.ReadFile(filepath.Join("testdata", "dwca", name))
		if err != nil {
			t.Fatal(err)
		}
		out = append(out, [2]string{prefix + name, string(raw)})
	}
	return out
}

func collect(t *testing.T, o *Occurrences) []Record {
	t.Helper()
	var out []Record
	for rec, err := range o.Records() {
		if err != nil {
			t.Fatal(err)
		}
		out = append(out, rec)
	}
	return out
}

func TestDwCA(t *testing.T) {
	for _, prefix := range []string{"", "0001234-240101000000000/"} {
		o, err := OpenOccurrences(writeZip(t, dwcaEntries(t, prefix)))
		if err != nil {
			t.Fatal(err)
		}
		defer o.Close()
		if o.Format() != FormatDwCA {
			t.Errorf("format %q", o.Format())
		}
		if m := o.Missing(OccurrenceTerms); len(m) != 0 {
			t.Errorf("missing %v", m)
		}
		if m := o.Missing([]string{"occurrenceStatus", "taxonKey"}); !slices.Equal(m, []string{"taxonKey"}) {
			t.Errorf("missing %v, want [taxonKey]", m)
		}
		recs := collect(t, o)
		if len(recs) != 3 {
			t.Fatalf("%d records, want 3", len(recs))
		}
		first := recs[0]
		checks := map[string]string{
			"gbifID": "4011234567", "decimalLatitude": "48.52", "eventDate": "2023-09-14T10:30:00",
			"http://rs.tdwg.org/dwc/terms/recordedBy": "Anna Muster", "occurrenceStatus": "PRESENT",
			"issue": "COORDINATE_ROUNDED;GEODETIC_DATUM_ASSUMED_WGS84", "license": "CC_BY_4_0",
		}
		for term, want := range checks {
			if got := first.Get(term); got != want {
				t.Errorf("%s = %q, want %q", term, got, want)
			}
		}
		if got := recs[1].Get("recordedBy"); got != `"Pilz" Freund` {
			t.Errorf("quote changed the field: %q", got)
		}
		if got := recs[1].Get("species"); got != `"Stein"pilz` {
			t.Errorf("species = %q", got)
		}
		if recs[1].Get("day") != "" || recs[2].Get("issue") != "" || recs[2].Get("class") != "Lecanoromycetes" {
			t.Errorf("empty or short fields: %q %q", recs[1].Get("day"), recs[2].Get("issue"))
		}
		date, ok, err := o.PubDate()
		if err != nil || !ok || !date.Equal(time.Date(2024, 5, 2, 0, 0, 0, 0, time.UTC)) {
			t.Errorf("pubDate = %v %v %v", date, ok, err)
		}
	}
}

func TestSimpleCSV(t *testing.T) {
	body := "\ufeffgbifID\tspecies\tdecimalLatitude\tcountryCode\n1\tBoletus edulis\t48.5\tDE\r\n2\t\"Krause\" Glucke\t49\tDE\r\n"
	o, err := OpenOccurrences(writeZip(t, [][2]string{{"0001-240101.csv", body}}))
	if err != nil {
		t.Fatal(err)
	}
	defer o.Close()
	if o.Format() != FormatSimpleCSV {
		t.Errorf("format %q", o.Format())
	}
	if m := o.Missing([]string{"gbifID", "species", "eventDate"}); !slices.Equal(m, []string{"eventDate"}) {
		t.Errorf("missing %v", m)
	}
	recs := collect(t, o)
	if len(recs) != 2 || recs[1].Get("species") != `"Krause" Glucke` || recs[0].Get("countryCode") != "DE" {
		t.Errorf("records %v", recs)
	}
	if _, ok, _ := o.PubDate(); ok {
		t.Error("SIMPLE_CSV has no pubDate")
	}
}

func TestOpenOccurrencesErrors(t *testing.T) {
	if _, err := OpenOccurrences(writeZip(t, [][2]string{{"a.csv", "x\n"}, {"b.csv", "y\n"}})); err == nil {
		t.Error("two csv files give no error")
	}
	meta := strings.Replace(dwcaEntries(t, "")[0][1], "dwc/terms/Occurrence\">", "dwc/terms/Event\">", 1)
	if _, err := OpenOccurrences(writeZip(t, [][2]string{{"meta.xml", meta}})); err == nil {
		t.Error("event core gives no error")
	}
	if _, err := OpenOccurrences(filepath.Join(t.TempDir(), "none.zip")); err == nil {
		t.Error("missing zip gives no error")
	}
}

func TestParseMetaDefaults(t *testing.T) {
	m, err := ParseMeta(strings.NewReader(`<archive><core rowType="r"><files><location> o.csv </location></files>` +
		`<field index="1" term="http://purl.org/dc/terms/modified"/></core></archive>`))
	if err != nil {
		t.Fatal(err)
	}
	if m.Delim != ',' || m.Quote != '"' || m.IgnoreHeader != 0 || m.Location != "o.csv" || m.IDIndex != -1 {
		t.Errorf("meta = %+v", m)
	}
	if m.Columns()["modified"] != 1 {
		t.Errorf("columns = %v", m.Columns())
	}
}

func TestTSVReaderQuoted(t *testing.T) {
	r, err := NewTSVReader(strings.NewReader("a\t\"b\tc\"\td\n\"e \"\"f\"\" g\"\t\"h\nx\"\n"), TSVOptions{Quote: '"'})
	if err != nil {
		t.Fatal(err)
	}
	var recs [][]string
	for {
		rec, err := r.Read()
		if errors.Is(err, io.EOF) {
			break
		}
		if err != nil {
			t.Fatal(err)
		}
		recs = append(recs, rec)
	}
	if len(recs) != 2 || !slices.Equal(recs[0], []string{"a", "b\tc", "d"}) || !slices.Equal(recs[1], []string{`e "f" g`, "h\nx"}) {
		t.Errorf("records %q", recs)
	}
	if _, err := NewTSVReader(strings.NewReader(""), TSVOptions{Quote: '\''}); err == nil {
		t.Error("single quote gives no error")
	}
}

func TestExtractZip(t *testing.T) {
	zp := writeZip(t, [][2]string{
		{"sand_0-5cm_mean.tif", "tif"}, {"sub/phh2o_0-5cm_mean.tif", "ph"}, {"readme.txt", "x"},
	})
	dir := t.TempDir()
	got, err := ExtractZip(zp, dir, func(n string) bool { return strings.HasSuffix(n, ".tif") })
	if err != nil {
		t.Fatal(err)
	}
	want := []string{filepath.Join(dir, "sand_0-5cm_mean.tif"), filepath.Join(dir, "sub", "phh2o_0-5cm_mean.tif")}
	if !slices.Equal(got, want) {
		t.Errorf("written %v", got)
	}
	if raw, _ := os.ReadFile(want[1]); string(raw) != "ph" {
		t.Errorf("content %q", raw)
	}
	for _, bad := range []string{"../evil.tif", "a/../../evil.tif", "/abs.tif"} {
		_, err := ExtractZip(writeZip(t, [][2]string{{bad, "x"}}), dir, func(string) bool { return true })
		if !errors.Is(err, ErrUnsafePath) {
			t.Errorf("%q: err = %v, want ErrUnsafePath", bad, err)
		}
	}
	z, err := OpenZip(zp)
	if err != nil {
		t.Fatal(err)
	}
	defer z.Close()
	if es := z.Entries(); len(es) != 3 || es[0].Size != 3 {
		t.Errorf("entries %v", es)
	}
	if _, err := z.Open("nope"); !errors.Is(err, os.ErrNotExist) {
		t.Errorf("open missing entry: %v", err)
	}
}
