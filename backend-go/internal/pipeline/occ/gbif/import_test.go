package gbif_test

import (
	"archive/zip"
	"context"
	"os"
	"path/filepath"
	"strings"
	"testing"

	"github.com/frederikbeimgraben/kinoko/backend/internal/pipeline/occ"
	"github.com/frederikbeimgraben/kinoko/backend/internal/pipeline/occ/gbif"
)

const metaXML = `<?xml version="1.0" encoding="utf-8"?>
<archive xmlns="http://rs.tdwg.org/dwc/text/" metadata="metadata.xml">
  <core encoding="UTF-8" fieldsTerminatedBy="\t" linesTerminatedBy="\n" fieldsEnclosedBy="" ignoreHeaderLines="1" rowType="http://rs.tdwg.org/dwc/terms/Occurrence">
    <files><location>occurrence.txt</location></files>
    <id index="0" />
    <field index="0" term="http://rs.gbif.org/terms/1.0/gbifID"/>
    <field index="1" term="http://rs.tdwg.org/dwc/terms/basisOfRecord"/>
    <field index="2" term="http://rs.tdwg.org/dwc/terms/recordedBy"/>
    <field index="3" term="http://rs.tdwg.org/dwc/terms/eventDate"/>
    <field index="4" term="http://rs.tdwg.org/dwc/terms/year"/>
    <field index="5" term="http://rs.tdwg.org/dwc/terms/month"/>
    <field index="6" term="http://rs.tdwg.org/dwc/terms/day"/>
    <field index="7" term="http://rs.tdwg.org/dwc/terms/countryCode"/>
    <field index="8" term="http://rs.tdwg.org/dwc/terms/decimalLatitude"/>
    <field index="9" term="http://rs.tdwg.org/dwc/terms/decimalLongitude"/>
    <field index="10" term="http://rs.tdwg.org/dwc/terms/coordinateUncertaintyInMeters"/>
    <field index="11" term="http://rs.tdwg.org/dwc/terms/kingdom"/>
    <field index="12" term="http://rs.tdwg.org/dwc/terms/class"/>
    <field index="13" term="http://rs.gbif.org/terms/1.0/species"/>
    <field index="14" term="http://rs.gbif.org/terms/1.0/issue"/>
    <field index="15" term="http://rs.tdwg.org/dwc/terms/occurrenceStatus"/>
  </core>
</archive>`

const metadataXML = `<?xml version="1.0" encoding="utf-8"?>
<eml:eml xmlns:eml="eml://ecoinformatics.org/eml-2.1.1"><dataset><pubDate>2025-03-02</pubDate></dataset></eml:eml>`

// rows of the core file: kept rows and one dropped row per filter reason.
var rows = []string{
	"gbifID\tbasisOfRecord\trecordedBy\teventDate\tyear\tmonth\tday\tcountryCode\tdecimalLatitude\tdecimalLongitude\tcoordinateUncertaintyInMeters\tkingdom\tclass\tspecies\tissue\toccurrenceStatus",
	"101\tHUMAN_OBSERVATION\tAnna Muster\t2019-09-14T10:30:00\t2019\t9\t14\tDE\t48.52\t9.05\t25.0\tFungi\tAgaricomycetes\tBoletus edulis\tCOORDINATE_ROUNDED;GEODETIC_DATUM_ASSUMED_WGS84\tPRESENT",
	"102\tHUMAN_OBSERVATION\t\t2020-10-01\t2020\t10\t1\tDE\t50.1\t8.6\t\tFungi\tAgaricomycetes\tImleria badia\t\tPRESENT",
	"103\tHUMAN_OBSERVATION\tBert\t2020-10-02\t2020\t10\t2\tDE\t50.2\t8.7\t100\tFungi\tAgaricomycetes\tCantharellus cibarius\t\tPRESENT",
	"201\tHUMAN_OBSERVATION\tBert\t2020-10-02\t2020\t10\t2\tAT\t47.2\t13.7\t\tFungi\tAgaricomycetes\tBoletus edulis\t\tPRESENT",
	"202\tHUMAN_OBSERVATION\tBert\t2020-10-02\t2020\t10\t2\tDE\t50.2\t8.7\t\tPlantae\tMagnoliopsida\tFagus sylvatica\t\tPRESENT",
	"203\tPRESERVED_SPECIMEN\tBert\t2020-10-02\t2020\t10\t2\tDE\t50.2\t8.7\t\tFungi\tAgaricomycetes\tBoletus edulis\t\tPRESENT",
	"204\tHUMAN_OBSERVATION\tBert\t2020-10-02\t2020\t10\t2\tDE\t50.2\t8.7\t\tFungi\tAgaricomycetes\tBoletus edulis\t\tABSENT",
	"205\tHUMAN_OBSERVATION\tBert\t2020-10-02\t2020\t10\t2\tDE\t\t8.7\t\tFungi\tAgaricomycetes\tBoletus edulis\t\tPRESENT",
	"206\tHUMAN_OBSERVATION\tBert\t2020-10-02\t2020\t10\t2\tDE\t0\t0\t\tFungi\tAgaricomycetes\tBoletus edulis\tZERO_COORDINATE\tPRESENT",
	"207\tHUMAN_OBSERVATION\tBert\t\t\t\t\tDE\t50.2\t8.7\t\tFungi\tAgaricomycetes\tBoletus edulis\t\tPRESENT",
}

func writeZip(t *testing.T, files map[string]string) string {
	t.Helper()
	path := filepath.Join(t.TempDir(), "download.zip")
	out, err := os.Create(path)
	if err != nil {
		t.Fatal(err)
	}
	z := zip.NewWriter(out)
	for name, body := range files {
		w, err := z.Create(name)
		if err != nil {
			t.Fatal(err)
		}
		w.Write([]byte(body))
	}
	if err := z.Close(); err != nil {
		t.Fatal(err)
	}
	out.Close()
	return path
}

func TestImportDwCA(t *testing.T) {
	zipPath := writeZip(t, map[string]string{
		"meta.xml": metaXML, "metadata.xml": metadataXML, "occurrence.txt": strings.Join(rows, "\n") + "\n",
	})
	out := t.TempDir()
	meta, err := gbif.ImportArchive(context.Background(), zipPath, out, gbif.ImportOptions{MinRecords: 3})
	if err != nil {
		t.Fatal(err)
	}
	if meta.Format != "dwca" || meta.Records != 10 || meta.RecordsDE != 3 || meta.Years != [2]int{2019, 2020} ||
		meta.Cutoff != "2025-03-02" || meta.CutoffYear != 2025 {
		t.Errorf("meta %+v", meta)
	}
	for _, reason := range []string{gbif.DropCountry, gbif.DropKingdom, gbif.DropBasis, gbif.DropStatus,
		gbif.DropCoordinate, gbif.DropGeospatial, gbif.DropYear} {
		if meta.Dropped[reason] != 1 {
			t.Errorf("dropped %s: %d, want 1", reason, meta.Dropped[reason])
		}
	}
	y2019 := readLines(t, filepath.Join(out, "fungi_de_2019.jsonl.gz"))
	hash, _ := gbif.HashObserver("Anna Muster")
	r := y2019[0]
	if r["gbifID"] != "101" || r["recordedByHash"] != hash || r["recordedBy"] != nil || r["year"] != 2019.0 ||
		r["decimalLatitude"] != 48.52 || r["coordinateUncertaintyInMeters"] != 25.0 {
		t.Errorf("record %v", r)
	}
	if issues, _ := r["issues"].([]any); len(issues) != 2 || issues[0] != "COORDINATE_ROUNDED" {
		t.Errorf("issues %v", r["issues"])
	}
	y2020 := readLines(t, filepath.Join(out, "fungi_de_2020.jsonl.gz"))
	if len(y2020) != 2 || y2020[0]["recordedByHash"] != nil || y2020[0]["coordinateUncertaintyInMeters"] != nil {
		t.Errorf("2020 %v", y2020)
	}
	// The occurrence builder reads the import as the archive source.
	recs, st, err := occ.BuildOccurrences(occ.Sources{Archive: out, ArchiveCutoff: meta.CutoffYear}, nil, occ.MaxUncertainty)
	if err != nil || len(recs) != 3 || st.Kept != 3 || recs[0].ISOWeek != 37 {
		t.Errorf("build: %v %d %+v", err, len(recs), st)
	}
}

func TestImportSimpleCSVAndTooFewRows(t *testing.T) {
	csv := strings.Join(rows, "\n") + "\n"
	zipPath := writeZip(t, map[string]string{"0001234-250302.csv": csv})
	out := t.TempDir()
	meta, err := gbif.ImportArchive(context.Background(), zipPath, out, gbif.ImportOptions{MinRecords: 3})
	if err != nil {
		t.Fatal(err)
	}
	if meta.Format != "simple_csv" || meta.RecordsDE != 3 || meta.Cutoff != "2020-10-02" {
		t.Errorf("meta %+v", meta)
	}
	empty := t.TempDir()
	if _, err := gbif.ImportArchive(context.Background(), zipPath, empty, gbif.ImportOptions{}); err == nil {
		t.Fatal("3 rows must fail the default minimum")
	}
	if entries, _ := os.ReadDir(empty); len(entries) != 0 {
		t.Errorf("a failed import left files: %v", entries)
	}
	bad := writeZip(t, map[string]string{"x.csv": "gbifID\tspecies\n1\tA\n"})
	if _, err := gbif.ImportArchive(context.Background(), bad, empty, gbif.ImportOptions{}); err == nil ||
		!strings.Contains(err.Error(), "decimalLatitude") {
		t.Errorf("missing columns: %v", err)
	}
}
