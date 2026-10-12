// Package sitedata fetches the static site data that the pipeline needs once:
// the outline of Germany, the Thuenen tree species map, the Copernicus
// elevation model and the SoilGrids rasters. Each one becomes a file in the
// form that the matching upload kind accepts.
package sitedata

import (
	"archive/zip"
	"bufio"
	"bytes"
	"context"
	"errors"
	"fmt"
	"io"
	"net/http"
	"os"
	"path/filepath"
	"strings"
	"sync"
	"time"

	"github.com/frederikbeimgraben/kinoko/backend/internal/pipeline/pio"
)

// The public addresses of the sources.
const (
	// OutlineURL is the outline of Germany of the BKG through geoBoundaries (dl-de/by-2-0), 357,734 km².
	OutlineURL = "https://github.com/wmgeolab/geoBoundaries/raw/9469f09/releaseData/gbOpen/DEU/ADM0/geoBoundaries-DEU-ADM0.geojson"
	// TreesWCS serves the Thuenen map of dominant tree species 2017/2018 (CC BY 4.0) in EPSG:32632.
	TreesWCS = "https://atlas.thuenen.de/geoserver/ows"
	// DEMBase is the AWS open-data bucket of Copernicus GLO-90.
	DEMBase = "https://copernicus-dem-90m.s3.amazonaws.com"
	// SoilWCS serves the SoilGrids rasters of ISRIC (CC BY 4.0), one map file per property.
	SoilWCS = "https://maps.isric.org/mapserv"
)

// The tree map comes in tiles of TreeTile metres. The WCS refuses the whole
// map in one request. The tiles cover the extent of the coverage, E 280460 to
// 921220 and N 5236910 to 6098380; the server cuts a tile at the edge.
const (
	TreeTile   = 50_000
	treeEast0  = 280_000
	treeEast1  = 920_000
	treeNorth0 = 5_200_000
	treeNorth1 = 6_050_000
)

// SoilProperties are the SoilGrids properties at 0 to 5 cm. The first three are required.
var SoilProperties = []string{"phh2o", "sand", "soc", "clay", "silt"}

// The file names of the results. Their extensions are the ones the upload kinds accept.
const (
	OutlineFile = "germany-outline.geojson"
	TreesFile   = "tree-species-map.zip"
	DEMFile     = "dem.zip"
	SoilFile    = "soilgrids.zip"
)

// Fetcher downloads into Dir. A stopped download of many tiles continues:
// a tile that is in Dir already is not asked for again.
type Fetcher struct {
	HTTP     *http.Client                     // http.DefaultClient when nil
	Dir      string                           // the work folder, for example PILZE_DATA/cache/sitedata
	Log      func(format string, args ...any) // no log when nil
	Workers  int                              // parallel tile requests, 4 when 0
	Attempts int                              // tries of one request, 4 when 0
	Backoff  func(attempt int) time.Duration  // the wait before the next try
	// These replace the public addresses in tests. Empty means the public ones.
	OutlineURL, TreesWCS, DEMBase, SoilWCS string
}

// Outline downloads the outline of Germany. It gives the path of the file.
func (f *Fetcher) Outline(ctx context.Context) (string, error) {
	out := filepath.Join(f.Dir, OutlineFile)
	if err := f.download(ctx, or(f.OutlineURL, OutlineURL), out, nil); err != nil {
		return "", fmt.Errorf("sitedata: outline: %w", err)
	}
	return out, nil
}

// Trees downloads the tree species map in tiles and packs them in one zip.
func (f *Fetcher) Trees(ctx context.Context) (string, error) {
	dir := filepath.Join(f.Dir, "trees")
	var tiles []tile
	for e := treeEast0; e <= treeEast1; e += TreeTile {
		for n := treeNorth0; n <= treeNorth1; n += TreeTile {
			name := fmt.Sprintf("tile_%d_%d.tif", e, n)
			url := fmt.Sprintf("%s?service=WCS&version=2.0.1&request=GetCoverage&coverageId=geonode__Dominant_Species_Class"+
				"&format=image/tiff&subset=E(%d,%d)&subset=N(%d,%d)", or(f.TreesWCS, TreesWCS), e, e+TreeTile, n, n+TreeTile)
			tiles = append(tiles, tile{url: url, file: filepath.Join(dir, name)})
		}
	}
	if err := f.tiles(ctx, "tree map", tiles); err != nil {
		return "", err
	}
	// Most of a tile is outside the forest and compresses well.
	return f.pack(dir, tiles, TreesFile, zip.Deflate)
}

// DEM downloads the Copernicus GLO-90 tiles of the box N47 to N55, E005 to
// E015 that the bucket holds, 94 tiles, and packs them in one zip.
func (f *Fetcher) DEM(ctx context.Context) (string, error) {
	base := strings.TrimRight(or(f.DEMBase, DEMBase), "/")
	dir := filepath.Join(f.Dir, "dem")
	list := filepath.Join(dir, "tileList.txt")
	if err := f.download(ctx, base+"/tileList.txt", list, nil); err != nil {
		return "", fmt.Errorf("sitedata: tile list: %w", err)
	}
	names, err := demTiles(list)
	if err != nil {
		return "", err
	}
	tiles := make([]tile, 0, len(names))
	for _, name := range names {
		tiles = append(tiles, tile{url: base + "/" + name + "/" + name + ".tif", file: filepath.Join(dir, name+".tif")})
	}
	if err := f.tiles(ctx, "elevation model", tiles); err != nil {
		return "", err
	}
	// The tiles are compressed GeoTIFFs already.
	return f.pack(dir, tiles, DEMFile, zip.Store)
}

// demTiles gives the tiles of the list in the box of Germany.
func demTiles(list string) ([]string, error) {
	raw, err := os.ReadFile(list)
	if err != nil {
		return nil, err
	}
	have := map[string]bool{}
	scanner := bufio.NewScanner(bytes.NewReader(raw))
	for scanner.Scan() {
		have[strings.TrimSpace(scanner.Text())] = true
	}
	var out []string
	for lat := 47; lat <= 55; lat++ {
		for lon := 5; lon <= 15; lon++ {
			name := fmt.Sprintf("Copernicus_DSM_COG_30_N%02d_00_E%03d_00_DEM", lat, lon)
			if have[name] {
				out = append(out, name)
			}
		}
	}
	if len(out) == 0 {
		return nil, errors.New("sitedata: the tile list names no tile of Germany")
	}
	return out, nil
}

// Soil downloads the SoilGrids rasters at 0 to 5 cm over Germany in EPSG:4326
// and packs them as <property>_0-5cm_mean.tif in one zip.
func (f *Fetcher) Soil(ctx context.Context) (string, error) {
	dir := filepath.Join(f.Dir, "soil")
	tiles := make([]tile, 0, len(SoilProperties))
	for _, p := range SoilProperties {
		url := fmt.Sprintf("%s?map=/map/%s.map&SERVICE=WCS&VERSION=2.0.1&REQUEST=GetCoverage&COVERAGEID=%s_0-5cm_mean"+
			"&FORMAT=image/tiff&SUBSET=long(5.5,15.5)&SUBSET=lat(47,55.5)"+
			"&SUBSETTINGCRS=http://www.opengis.net/def/crs/EPSG/0/4326&OUTPUTCRS=http://www.opengis.net/def/crs/EPSG/0/4326",
			or(f.SoilWCS, SoilWCS), p, p)
		tiles = append(tiles, tile{url: url, file: filepath.Join(dir, p+"_0-5cm_mean.tif")})
	}
	if err := f.tiles(ctx, "soil", tiles); err != nil {
		return "", err
	}
	return f.pack(dir, tiles, SoilFile, zip.Store)
}

type tile struct{ url, file string }

// tiles downloads each missing tile, Workers at a time. A WCS sends its
// errors as XML with status 200, so each tile must be a TIFF.
func (f *Fetcher) tiles(ctx context.Context, what string, tiles []tile) error {
	ctx, cancel := context.WithCancel(ctx)
	defer cancel()
	work := make(chan tile)
	var (
		wg    sync.WaitGroup
		mu    sync.Mutex
		first error
		done  int
	)
	workers := f.Workers
	if workers <= 0 {
		workers = 4
	}
	for range workers {
		wg.Go(func() {
			for t := range work {
				err := f.download(ctx, t.url, t.file, isTIFF)
				mu.Lock()
				if err != nil && first == nil {
					first = fmt.Errorf("sitedata: %s: %w", what, err)
					cancel()
				}
				done++
				if done%25 == 0 || done == len(tiles) {
					f.logf("%s: %d of %d tiles", what, done, len(tiles))
				}
				mu.Unlock()
			}
		})
	}
	for _, t := range tiles {
		if info, err := os.Stat(t.file); err == nil && info.Size() > 0 {
			mu.Lock()
			done++
			mu.Unlock()
			continue
		}
		select {
		case work <- t:
		case <-ctx.Done():
		}
	}
	close(work)
	wg.Wait()
	if first != nil {
		return first
	}
	return ctx.Err()
}

// pack writes the tiles into the zip name in f.Dir and removes the tiles.
func (f *Fetcher) pack(dir string, tiles []tile, name string, method uint16) (path string, err error) {
	path = filepath.Join(f.Dir, name)
	partial := path + ".partial"
	out, err := os.Create(partial)
	if err != nil {
		return "", err
	}
	defer func() {
		if err != nil {
			_ = out.Close()
			_ = os.Remove(partial)
		}
	}()
	zw := zip.NewWriter(out)
	for _, t := range tiles {
		if err := addFile(zw, t.file, method); err != nil {
			return "", err
		}
	}
	if err := zw.Close(); err != nil {
		return "", err
	}
	if err := out.Close(); err != nil {
		return "", err
	}
	if err := os.Rename(partial, path); err != nil {
		return "", err
	}
	return path, os.RemoveAll(dir)
}

func addFile(zw *zip.Writer, file string, method uint16) (err error) {
	in, err := os.Open(file)
	if err != nil {
		return err
	}
	defer func() { err = errors.Join(err, in.Close()) }()
	w, err := zw.CreateHeader(&zip.FileHeader{Name: filepath.Base(file), Method: method, Modified: time.Now()})
	if err != nil {
		return err
	}
	_, err = io.Copy(w, in)
	return err
}

// isTIFF checks the first bytes of a file: little or big endian, classic or BigTIFF.
func isTIFF(head []byte) bool {
	for _, magic := range [][]byte{{'I', 'I', 42, 0}, {'M', 'M', 0, 42}, {'I', 'I', 43, 0}, {'M', 'M', 0, 43}} {
		if bytes.HasPrefix(head, magic) {
			return true
		}
	}
	return false
}

// download gets url into target through target.partial, with retries. With
// check, the first bytes of the file must pass it.
func (f *Fetcher) download(ctx context.Context, url, target string, check func([]byte) bool) error {
	attempts := f.Attempts
	if attempts <= 0 {
		attempts = 4
	}
	var err error
	for attempt := 1; attempt <= attempts; attempt++ {
		if err = f.downloadOnce(ctx, url, target, check); err == nil || ctx.Err() != nil {
			return err
		}
		var status *statusError
		if errors.As(err, &status) && status.code >= 400 && status.code < 500 && status.code != http.StatusTooManyRequests {
			return err
		}
		if attempt < attempts {
			f.logf("  retry %d/%d: %v", attempt, attempts, err)
			if err := sleep(ctx, f.backoff(attempt)); err != nil {
				return err
			}
		}
	}
	return err
}

type statusError struct {
	url  string
	code int
}

func (e *statusError) Error() string { return fmt.Sprintf("GET %s: HTTP %d", e.url, e.code) }

func (f *Fetcher) downloadOnce(ctx context.Context, url, target string, check func([]byte) bool) (err error) {
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, url, nil)
	if err != nil {
		return err
	}
	resp, err := pio.Watched(f.HTTP, pio.IdleTimeout).Do(req)
	if err != nil {
		return err
	}
	defer func() { _ = resp.Body.Close() }()
	if resp.StatusCode != http.StatusOK {
		return &statusError{url: url, code: resp.StatusCode}
	}
	if err := os.MkdirAll(filepath.Dir(target), 0o755); err != nil {
		return err
	}
	partial := target + ".partial"
	out, err := os.Create(partial)
	if err != nil {
		return err
	}
	defer func() {
		if err != nil {
			_ = out.Close()
			_ = os.Remove(partial)
		}
	}()
	body := bufio.NewReaderSize(resp.Body, 1<<16)
	if check != nil {
		head, _ := body.Peek(512)
		if !check(head) {
			return fmt.Errorf("GET %s: the server sent no GeoTIFF: %.200s", url, head)
		}
	}
	size, err := io.Copy(out, body)
	if err != nil {
		return err
	}
	if resp.ContentLength >= 0 && size != resp.ContentLength {
		return fmt.Errorf("GET %s: got %d of %d bytes", url, size, resp.ContentLength)
	}
	if err := out.Close(); err != nil {
		return err
	}
	return os.Rename(partial, target)
}

func (f *Fetcher) backoff(attempt int) time.Duration {
	if f.Backoff == nil {
		return time.Duration(attempt) * 10 * time.Second
	}
	return f.Backoff(attempt)
}

func (f *Fetcher) logf(format string, args ...any) {
	if f.Log != nil {
		f.Log(format, args...)
	}
}

func sleep(ctx context.Context, d time.Duration) error {
	if d <= 0 {
		return ctx.Err()
	}
	t := time.NewTimer(d)
	defer t.Stop()
	select {
	case <-ctx.Done():
		return ctx.Err()
	case <-t.C:
		return nil
	}
}

func or(a, b string) string {
	if a != "" {
		return a
	}
	return b
}
