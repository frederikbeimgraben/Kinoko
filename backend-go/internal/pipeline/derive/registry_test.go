package derive_test

import (
	"archive/zip"
	"bytes"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"net/http"
	"os"
	"path/filepath"
	"strconv"
	"strings"
	"testing"

	"github.com/frederikbeimgraben/kinoko/backend/internal/core/config"
	"github.com/frederikbeimgraben/kinoko/backend/internal/modules/sources"
	"github.com/frederikbeimgraben/kinoko/backend/internal/pipeline/derive"
	"github.com/frederikbeimgraben/kinoko/backend/internal/pipeline/occ/gbif"
	"github.com/frederikbeimgraben/kinoko/backend/internal/testkit"
)

// service is a running service whose processors work on the synthetic crop.
type service struct {
	t     *testing.T
	env   *testkit.Env
	m     *sources.Module
	admin *testkit.Person
}

func newService(t *testing.T) *service {
	t.Helper()
	env := testkit.New(t, testkit.WithSettings(func(s *config.Settings) { s.DataRoot = filepath.Join(t.TempDir(), "daten") }))
	var m *sources.Module
	for _, module := range env.Service.Modules {
		if found, ok := module.(*sources.Module); ok {
			m = found
		}
	}
	if m == nil {
		t.Fatal("the service has no sources module")
	}
	t.Cleanup(m.Wait)
	raw, err := os.ReadFile(filepath.Join("testdata", "golden", "grid.json"))
	if err != nil {
		t.Fatal(err)
	}
	var g struct {
		Crop     [4]int     `json:"crop"`
		TreeTile int        `json:"treeTile"`
		FineBox  [4]float64 `json:"fineBox"`
	}
	if err := json.Unmarshal(raw, &g); err != nil {
		t.Fatal(err)
	}
	// The service registers the processors for Germany; the test replaces
	// them with processors on the crop, without fine layers.
	derive.Register(derive.Config{
		Resolve: m.Resolver(), Install: m, TreeTile: g.TreeTile,
		Grid: derive.Grid{X0: g.Crop[0], Y0: g.Crop[1], X1: g.Crop[2], Y1: g.Crop[3], Step: derive.CellStep},
		Fine: derive.FineOptions{Box: g.FineBox, Layers: []string{"none"}},
		GBIF: gbif.ImportOptions{MinRecords: 3},
	})
	return &service{t: t, env: env, m: m, admin: testkit.Ptr(testkit.Admin())}
}

// upload sends a file in one part and gives the version after processing.
func (s *service) upload(kind sources.Kind, name string, data []byte) map[string]any {
	s.t.Helper()
	sum := sha256.Sum256(data)
	session := s.env.Post("/data-sources/"+string(kind)+"/uploads", map[string]any{
		"fileName": name, "sizeBytes": len(data), "sha256": hex.EncodeToString(sum[:]), "activate": true,
	}, s.admin).Expect(s.t, http.StatusCreated).Map(s.t)
	id := session["id"].(string)
	for offset := 0; offset < len(data); offset += sources.PartSize {
		end := min(offset+sources.PartSize, len(data))
		s.env.Do(testkit.Request{
			Method: http.MethodPatch, Path: "/data-source-uploads/" + id, As: s.admin, RawBody: data[offset:end],
			Type: "application/octet-stream", Header: http.Header{"Upload-Offset": {strconv.Itoa(offset)}},
		}).Expect(s.t, http.StatusOK)
	}
	version := s.env.Post("/data-source-uploads/"+id+"/complete", nil, s.admin).Expect(s.t, http.StatusAccepted).Map(s.t)
	s.m.Wait()
	return s.env.Get("/data-sources/"+string(kind)+"/versions/"+version["id"].(string), s.admin).
		Expect(s.t, http.StatusOK).Map(s.t)
}

func (s *service) ready(kind sources.Kind, name string, data []byte) map[string]any {
	s.t.Helper()
	v := s.upload(kind, name, data)
	if v["state"] != "ready" {
		s.t.Fatalf("%s: state %v, error %v", kind, v["state"], v["error"])
	}
	return v
}

func read(t *testing.T, parts ...string) []byte {
	t.Helper()
	data, err := os.ReadFile(filepath.Join(append([]string{"testdata", "in"}, parts...)...))
	if err != nil {
		t.Fatal(err)
	}
	return data
}

func zipOf(t *testing.T, files map[string][]byte) []byte {
	t.Helper()
	var buf bytes.Buffer
	w := zip.NewWriter(&buf)
	for name, content := range files {
		part, err := w.Create(name)
		if err != nil {
			t.Fatal(err)
		}
		if _, err := part.Write(content); err != nil {
			t.Fatal(err)
		}
	}
	if err := w.Close(); err != nil {
		t.Fatal(err)
	}
	return buf.Bytes()
}

// TestKindsReachReadyThroughRegistry uploads one version of each raw kind
// through the HTTP endpoints. The registered processors must make each
// version ready and install the derived trees grid, tree scales and site grid.
func TestKindsReachReadyThroughRegistry(t *testing.T) {
	if testing.Short() {
		t.Skip("the processors take a while")
	}
	s := newService(t)
	s.ready(sources.KindTreeSpeciesMap, "map.tif", read(t, "trees_32632.tif"))
	s.ready(sources.KindDEM, "glo90.zip", zipOf(t, map[string][]byte{
		"dem_w.tif": read(t, "dem", "dem_w.tif"), "dem_e.tif": read(t, "dem", "dem_e.tif")}))
	s.ready(sources.KindSoilGrids, "soilgrids.zip", zipOf(t, map[string][]byte{
		"phh2o_0-5cm_mean.tif": read(t, "soil", "phh2o_0-5cm_mean.tif"),
		"sand_0-5cm_mean.tif":  read(t, "soil", "sand_0-5cm_mean.tif"),
		"soc_0-5cm_mean.tif":   read(t, "soil", "soc_0-5cm_mean.tif")}))
	archive := s.ready(sources.KindGBIFArchive, "download.zip", zipOf(t, map[string][]byte{
		"meta.xml": []byte(metaXML), "metadata.xml": []byte(metadataXML), "occurrence.txt": []byte(strings.Join(rows, "\n") + "\n")}))
	meta := archive["metadata"].(map[string]any)
	if meta["records"] != 4.0 || meta["recordsDE"] != 3.0 || meta["cutoff"] != "2025-03-02" || meta["cutoffYear"] != 2025.0 {
		t.Errorf("gbif metadata %v", meta)
	}
	res := s.m.Resolver()
	for _, c := range []struct {
		kind sources.Kind
		name string
	}{{sources.KindTreesGrid, derive.ArtTreesGrid}, {sources.KindTreeScales, derive.ArtTreeScales}, {sources.KindSiteGrid, derive.ArtSite}} {
		p, err := res.Path(c.kind, c.name)
		if err != nil {
			t.Fatalf("%s: %v", c.kind, err)
		}
		if info, err := os.Stat(p); err != nil || info.Size() == 0 {
			t.Errorf("%s: %s is empty: %v", c.kind, p, err)
		}
	}
}

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

var rows = []string{
	"gbifID\tbasisOfRecord\trecordedBy\teventDate\tyear\tmonth\tday\tcountryCode\tdecimalLatitude\tdecimalLongitude\tcoordinateUncertaintyInMeters\tkingdom\tclass\tspecies\tissue\toccurrenceStatus",
	"101\tHUMAN_OBSERVATION\tAnna Muster\t2019-09-14T10:30:00\t2019\t9\t14\tDE\t48.52\t9.05\t25.0\tFungi\tAgaricomycetes\tBoletus edulis\t\tPRESENT",
	"102\tHUMAN_OBSERVATION\t\t2020-10-01\t2020\t10\t1\tDE\t50.1\t8.6\t\tFungi\tAgaricomycetes\tImleria badia\t\tPRESENT",
	"103\tHUMAN_OBSERVATION\tBert\t2020-10-02\t2020\t10\t2\tDE\t50.2\t8.7\t100\tFungi\tAgaricomycetes\tCantharellus cibarius\t\tPRESENT",
	"201\tHUMAN_OBSERVATION\tBert\t2020-10-02\t2020\t10\t2\tAT\t47.2\t13.7\t\tFungi\tAgaricomycetes\tBoletus edulis\t\tPRESENT",
}
