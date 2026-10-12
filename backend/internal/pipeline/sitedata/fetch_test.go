package sitedata

import (
	"archive/zip"
	"context"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"strings"
	"sync/atomic"
	"testing"
	"time"
)

var tiff = []byte{'I', 'I', 42, 0, 1, 2, 3, 4}

// fakeServer serves each source. It counts the tile requests of the tree map.
func fakeServer(t *testing.T, treeHits *atomic.Int32, badTree string) *Fetcher {
	t.Helper()
	mux := http.NewServeMux()
	mux.HandleFunc("/outline.geojson", func(w http.ResponseWriter, _ *http.Request) {
		_, _ = w.Write([]byte(`{"type":"FeatureCollection","features":[]}`))
	})
	mux.HandleFunc("/ows", func(w http.ResponseWriter, r *http.Request) {
		treeHits.Add(1)
		if badTree != "" && strings.Contains(r.URL.RawQuery, badTree) {
			_, _ = w.Write([]byte(`<ows:ExceptionReport>No service</ows:ExceptionReport>`))
			return
		}
		_, _ = w.Write(tiff)
	})
	mux.HandleFunc("/dem/tileList.txt", func(w http.ResponseWriter, _ *http.Request) {
		_, _ = w.Write([]byte("Copernicus_DSM_COG_30_N00_00_E006_00_DEM\r\n" +
			"Copernicus_DSM_COG_30_N48_00_E009_00_DEM\r\nCopernicus_DSM_COG_30_N54_00_E013_00_DEM\r\n"))
	})
	mux.HandleFunc("/dem/", func(w http.ResponseWriter, _ *http.Request) { _, _ = w.Write(tiff) })
	mux.HandleFunc("/mapserv", func(w http.ResponseWriter, _ *http.Request) { _, _ = w.Write(tiff) })
	srv := httptest.NewServer(mux)
	t.Cleanup(srv.Close)
	return &Fetcher{
		HTTP: srv.Client(), Dir: t.TempDir(), Attempts: 2, Backoff: func(int) time.Duration { return 0 },
		OutlineURL: srv.URL + "/outline.geojson", TreesWCS: srv.URL + "/ows", DEMBase: srv.URL + "/dem", SoilWCS: srv.URL + "/mapserv",
	}
}

func zipNames(t *testing.T, path string) []string {
	t.Helper()
	r, err := zip.OpenReader(path)
	if err != nil {
		t.Fatal(err)
	}
	defer func() { _ = r.Close() }()
	var names []string
	for _, f := range r.File {
		names = append(names, f.Name)
	}
	return names
}

func TestOutline(t *testing.T) {
	f := fakeServer(t, &atomic.Int32{}, "")
	path, err := f.Outline(context.Background())
	if err != nil {
		t.Fatal(err)
	}
	if got, _ := os.ReadFile(path); !strings.Contains(string(got), "FeatureCollection") || filepath.Base(path) != OutlineFile {
		t.Fatalf("%s: %q", path, got)
	}
}

func TestTreesPacksEachTileAndRemovesThem(t *testing.T) {
	hits := &atomic.Int32{}
	f := fakeServer(t, hits, "")
	path, err := f.Trees(context.Background())
	if err != nil {
		t.Fatal(err)
	}
	names := zipNames(t, path)
	if len(names) != 13*18 || int(hits.Load()) != 13*18 {
		t.Fatalf("%d tiles in the zip, %d requests", len(names), hits.Load())
	}
	if _, err := os.Stat(filepath.Join(f.Dir, "trees")); !os.IsNotExist(err) {
		t.Errorf("the tiles are still there: %v", err)
	}
}

func TestTreesKeepsTheTilesOfAStoppedFetch(t *testing.T) {
	hits := &atomic.Int32{}
	f := fakeServer(t, hits, "subset=E(880000,930000)&subset=N(6050000,6100000)")
	if _, err := f.Trees(context.Background()); err == nil || !strings.Contains(err.Error(), "no GeoTIFF") {
		t.Fatalf("err = %v", err)
	}
	kept, _ := filepath.Glob(filepath.Join(f.Dir, "trees", "*.tif"))
	if len(kept) == 0 {
		t.Fatal("no tile was kept")
	}
	before := hits.Load()
	g := fakeServer(t, hits, "")
	g.Dir = f.Dir
	hits.Store(0)
	if _, err := g.Trees(context.Background()); err != nil {
		t.Fatal(err)
	}
	if got := int(hits.Load()); got != 13*18-len(kept) {
		t.Fatalf("the second fetch asked for %d tiles, want %d (first fetch: %d)", got, 13*18-len(kept), before)
	}
}

func TestDEMTakesTheTilesOfGermanyFromTheList(t *testing.T) {
	f := fakeServer(t, &atomic.Int32{}, "")
	path, err := f.DEM(context.Background())
	if err != nil {
		t.Fatal(err)
	}
	names := zipNames(t, path)
	want := []string{"Copernicus_DSM_COG_30_N48_00_E009_00_DEM.tif", "Copernicus_DSM_COG_30_N54_00_E013_00_DEM.tif"}
	if strings.Join(names, ",") != strings.Join(want, ",") {
		t.Fatalf("names = %v", names)
	}
}

func TestSoilNamesTheFilesAsTheUploadExpects(t *testing.T) {
	f := fakeServer(t, &atomic.Int32{}, "")
	path, err := f.Soil(context.Background())
	if err != nil {
		t.Fatal(err)
	}
	names := zipNames(t, path)
	if len(names) != len(SoilProperties) || names[0] != "phh2o_0-5cm_mean.tif" {
		t.Fatalf("names = %v", names)
	}
}
