package sources

import (
	"archive/zip"
	"bytes"
	"context"
	"encoding/binary"
	"encoding/json"
	"os"
	"path/filepath"
	"regexp"
	"strconv"
	"strings"

	"github.com/frederikbeimgraben/kinoko/backend/internal/fn"
)

// staticLayers checks a zip with layers.json and the tiles
// layers_kacheln/<name>/<z>/<x>/<y>.png of the static layers.
type staticLayers struct{}

const (
	layersFile   = "layers.json"
	tilesFolder  = "layers_kacheln"
	tileSide     = 256
	maxManifest  = 64 << 20
	pngHeaderLen = 26
)

var tilePattern = regexp.MustCompile(`^layers_kacheln/([^/]+)/(\d+)/(\d+)/(\d+)\.png$`)

type layerEntry struct {
	Static   *bool               `json:"static"`
	Tiles    *string             `json:"tiles"`
	Have     map[string][]string `json:"have"`
	HaveZoom *int                `json:"haveZoom"`
}

// tileKey is "z/x/y".
type tileKey = string

// tilesOf groups the tile entries of the archive by layer.
func tilesOf(names []string) map[string][]tileKey {
	matches := fn.FlatMap(names, func(name string) [][]string {
		if m := tilePattern.FindStringSubmatch(name); m != nil {
			return [][]string{m}
		}
		return nil
	})
	return fn.Reduce(matches, map[string][]tileKey{}, func(acc map[string][]tileKey, m []string) map[string][]tileKey {
		acc[m[1]] = append(acc[m[1]], m[2]+"/"+m[3]+"/"+m[4])
		return acc
	})
}

func zoomOf(key tileKey) int {
	z, _ := strconv.Atoi(key[:strings.IndexByte(key, '/')])
	return z
}

// checkLayer compares one manifest entry with the tiles of its layer.
func checkLayer(name string, e layerEntry, tiles []tileKey) error {
	if e.Static == nil || !*e.Static {
		return Fail("manifest", "the layer %q is not static", name)
	}
	if e.Tiles == nil || *e.Tiles != tilesFolder+"/"+name {
		return Fail("manifest", "the layer %q does not name the folder %s/%s", name, tilesFolder, name)
	}
	listed := fn.FlatMap(fn.SortedKeys(e.Have), func(z string) []tileKey {
		return fn.Map(e.Have[z], func(xy string) tileKey { return z + "/" + xy })
	})
	present := fn.Set(tiles)
	if absent, found := fn.Find(listed, func(k tileKey) bool { _, ok := present[k]; return !ok }); found {
		return Fail("tiles", "the layer %q has no tile %s", name, absent)
	}
	counted := tiles
	if e.HaveZoom != nil {
		counted = fn.Filter(tiles, func(k tileKey) bool { return zoomOf(k) <= *e.HaveZoom })
	}
	if len(counted) != len(listed) {
		return Fail("tiles", "the layer %q has %d tiles, the manifest lists %d", name, len(counted), len(listed))
	}
	return nil
}

var pngSignature = []byte("\x89PNG\r\n\x1a\n")

// checkTile reads the PNG header: 256×256 pixels, 8-bit gray with or
// without alpha.
func checkTile(f *zip.File) error {
	head, err := readEntry(f, pngHeaderLen)
	if err != nil {
		return err
	}
	if len(head) < pngHeaderLen || !bytes.Equal(head[:8], pngSignature) || string(head[12:16]) != "IHDR" {
		return Fail("tiles", "%s is not a PNG file", f.Name)
	}
	width, height := binary.BigEndian.Uint32(head[16:20]), binary.BigEndian.Uint32(head[20:24])
	depth, colour := head[24], head[25]
	if width != tileSide || height != tileSide || depth != 8 || (colour != 0 && colour != 4) {
		return Fail("tiles", "%s is %d×%d, depth %d, colour type %d; expected 256×256 8-bit gray",
			f.Name, width, height, depth, colour)
	}
	return nil
}

func readManifest(entries map[string]*zip.File) (map[string]layerEntry, error) {
	f, ok := entries[layersFile]
	if !ok {
		return nil, Fail("missing_files", "the archive has no %s", layersFile)
	}
	raw, err := readEntry(f, maxManifest)
	if err != nil {
		return nil, err
	}
	var doc struct {
		Layers map[string]layerEntry `json:"layers"`
	}
	if err := json.Unmarshal(raw, &doc); err != nil {
		return nil, Fail("manifest", "%s is not valid: %v", layersFile, err)
	}
	if len(doc.Layers) == 0 {
		return nil, Fail("manifest", "%s has no layers", layersFile)
	}
	return doc.Layers, nil
}

func (staticLayers) Validate(ctx context.Context, v *Version) (map[string]any, error) {
	z, err := openZip(v.Original())
	if err != nil {
		return nil, err
	}
	defer func() { _ = z.Close() }()
	entries, err := zipFiles(z)
	if err != nil {
		return nil, err
	}
	layers, err := readManifest(entries)
	if err != nil {
		return nil, err
	}
	names := fn.SortedKeys(entries)
	tiles := tilesOf(names)
	if extra, found := fn.Find(fn.SortedKeys(tiles), func(l string) bool { _, ok := layers[l]; return !ok }); found {
		return nil, Fail("manifest", "the tiles of the layer %q have no entry in %s", extra, layersFile)
	}
	for _, name := range fn.SortedKeys(layers) {
		if err := checkLayer(name, layers[name], tiles[name]); err != nil {
			return nil, err
		}
	}
	for _, name := range names {
		if err := ctx.Err(); err != nil {
			return nil, err
		}
		if tilePattern.MatchString(name) {
			if err := checkTile(entries[name]); err != nil {
				return nil, err
			}
		}
	}
	counts := fn.Map(fn.SortedKeys(layers), func(name string) map[string]any {
		return map[string]any{"name": name, "tiles": len(tiles[name])}
	})
	v.Logf("%d layers", len(layers))
	return map[string]any{"layers": counts}, nil
}

// Derive unpacks the manifest and the tiles. The runner publishes them in
// PILZE_MAPS (runner.Chain.PublishStatic).
func (staticLayers) Derive(ctx context.Context, v *Version) ([]Artifact, error) {
	z, err := openZip(v.Original())
	if err != nil {
		return nil, err
	}
	defer func() { _ = z.Close() }()
	entries, err := zipFiles(z)
	if err != nil {
		return nil, err
	}
	out := v.DerivedDir()
	if err := os.RemoveAll(out); err != nil {
		return nil, err
	}
	kept := fn.Filter(fn.SortedKeys(entries), func(n string) bool { return n == layersFile || tilePattern.MatchString(n) })
	for _, name := range kept {
		if err := ctx.Err(); err != nil {
			return nil, err
		}
		if err := extract(entries[name], filepath.Join(out, filepath.FromSlash(name))); err != nil {
			return nil, err
		}
	}
	layers := fn.SortedKeys(tilesOf(kept))
	return fn.MapErr(append([]string{layersFile}, fn.Map(layers, func(l string) string { return tilesFolder + "/" + l })...),
		func(name string) (Artifact, error) {
			target := filepath.Join(out, filepath.FromSlash(name))
			size, err := treeSize(target)
			return Artifact{Name: name, Path: target, SizeBytes: size}, err
		})
}
