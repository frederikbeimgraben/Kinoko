package render

import (
	"bytes"
	"errors"
	"fmt"
	"io"
	"io/fs"
	"os"
	"path/filepath"
	"strings"

	"github.com/frederikbeimgraben/kinoko/backend/internal/pipeline/core/pyjson"
)

// SourceMarker is the file in a published static tile folder that holds the tag of its source.
const SourceMarker = ".source"

// StaticSource is a folder with layers.json and layers_kacheln/<name>/ of static layers.
// Tag names the version of the folder. An empty tag always copies the tiles.
type StaticSource struct {
	Dir string
	Tag string
}

// StaticResult tells what InstallStaticLayers did. Copied and Kept name the tile folders;
// Written tells that layers.json changed.
type StaticResult struct {
	Manifest *pyjson.Obj
	Copied   []string
	Kept     []string
	Written  bool
}

// InstallStaticLayers publishes the static layers of srcs in maps; a later source wins a name.
// A tile folder changes in one rename, and only when its marker does not hold the tag of its source.
// Then layers.json gets the new static entries, the kept old static entries and the weekly entries.
func InstallStaticLayers(maps string, srcs ...StaticSource) (StaticResult, error) {
	incoming, origin, bounds, err := readStatic(srcs)
	if err != nil {
		return StaticResult{}, err
	}
	var res StaticResult
	for _, name := range incoming.Keys() {
		entry, _ := incoming.Get(name)
		rel, err := staticTiles(name, entry.(*pyjson.Obj))
		if err != nil {
			return StaticResult{}, err
		}
		src, dst := origin[name], filepath.Join(maps, filepath.FromSlash(rel))
		if src.Tag != "" && markerOf(dst) == src.Tag {
			res.Kept = append(res.Kept, name)
			continue
		}
		if err := replaceTree(filepath.Join(src.Dir, filepath.FromSlash(rel)), dst, src.Tag); err != nil {
			return StaticResult{}, err
		}
		res.Copied = append(res.Copied, name)
	}
	path := filepath.Join(maps, LayersFile)
	old, err := readLayers(path)
	if err != nil {
		return StaticResult{}, err
	}
	res.Manifest = mergeStatic(old, incoming, bounds)
	res.Written, err = writeChanged(path, pyjson.MarshalManifest(res.Manifest))
	return res, err
}

// readStatic reads the entries of each source. Each entry must be static.
func readStatic(srcs []StaticSource) (*pyjson.Obj, map[string]StaticSource, any, error) {
	incoming, origin := pyjson.NewObj(), map[string]StaticSource{}
	var bounds any
	for _, src := range srcs {
		upload, err := readLayers(filepath.Join(src.Dir, LayersFile))
		if err != nil {
			return nil, nil, nil, err
		}
		entries := layerEntries(upload)
		if staticEntries(entries).Len() != entries.Len() {
			return nil, nil, nil, fmt.Errorf("render: %s holds a layer that is not static", src.Dir)
		}
		for _, name := range entries.Keys() {
			v, _ := entries.Get(name)
			incoming.Set(name, v)
			origin[name] = src
		}
		if b, ok := upload.Get("bounds"); ok && bounds == nil {
			bounds = b
		}
	}
	return incoming, origin, bounds, nil
}

// mergeStatic gives the manifest with the incoming static entries first, then the
// other old static entries, then the weekly entries. The old bounds win.
func mergeStatic(old, incoming *pyjson.Obj, bounds any) *pyjson.Obj {
	oldLayers := layerEntries(old)
	merged := pyjson.NewObj()
	for _, group := range []*pyjson.Obj{incoming, staticEntries(oldLayers), oldLayers} {
		for _, k := range group.Keys() {
			if _, done := merged.Get(k); !done {
				v, _ := group.Get(k)
				merged.Set(k, v)
			}
		}
	}
	if b, ok := old.Get("bounds"); ok {
		bounds = b
	}
	meta := pyjson.NewObj()
	if bounds != nil {
		meta.Set("bounds", bounds)
	}
	return meta.Set("layers", merged)
}

// writeChanged writes data to path in one rename when the file holds other data.
func writeChanged(path string, data []byte) (bool, error) {
	current, err := os.ReadFile(path)
	if err == nil && bytes.Equal(current, data) {
		return false, nil
	}
	if err := os.MkdirAll(filepath.Dir(path), 0o755); err != nil {
		return false, err
	}
	return true, pyjson.WriteFileAtomic(path, data)
}

// markerOf gives the tag in the marker of a tile folder, or "".
func markerOf(dir string) string {
	data, err := os.ReadFile(filepath.Join(dir, SourceMarker))
	if err != nil {
		return ""
	}
	return string(data)
}

// staticTiles checks the tile path of a static entry: it must be layers_kacheln/<name>.
func staticTiles(name string, entry *pyjson.Obj) (string, error) {
	v, _ := entry.Get("tiles")
	rel, _ := v.(string)
	if !safeName(name) || rel != "layers_kacheln/"+name {
		return "", fmt.Errorf("render: static layer %q has the tile path %q", name, rel)
	}
	return rel, nil
}

// replaceTree copies the folder src and the marker with tag to dst.tmp, then
// puts it in the place of dst. A missing src gives an empty folder.
func replaceTree(src, dst, tag string) error {
	tmp, old := dst+".tmp", dst+".old"
	for _, p := range []string{tmp, old} {
		if err := os.RemoveAll(p); err != nil {
			return err
		}
	}
	if err := copyTree(src, tmp); err != nil {
		return errors.Join(err, os.RemoveAll(tmp))
	}
	if tag != "" {
		if err := os.WriteFile(filepath.Join(tmp, SourceMarker), []byte(tag), 0o644); err != nil {
			return errors.Join(err, os.RemoveAll(tmp))
		}
	}
	if err := os.Rename(dst, old); err != nil && !errors.Is(err, fs.ErrNotExist) {
		return errors.Join(err, os.RemoveAll(tmp))
	}
	if err := os.Rename(tmp, dst); err != nil {
		return err
	}
	return os.RemoveAll(old)
}

// copyTree copies the regular files and folders of src to dst. A marker of src stays behind.
func copyTree(src, dst string) error {
	if err := os.MkdirAll(dst, 0o755); err != nil {
		return err
	}
	err := filepath.WalkDir(src, func(p string, d fs.DirEntry, err error) error {
		if err != nil {
			return err
		}
		rel, err := filepath.Rel(src, p)
		if err != nil || strings.HasPrefix(rel, "..") {
			return fmt.Errorf("render: %s lies outside %s", p, src)
		}
		target := filepath.Join(dst, rel)
		switch {
		case d.IsDir():
			return os.MkdirAll(target, 0o755)
		case d.Type().IsRegular() && rel != SourceMarker:
			return copyFile(p, target)
		}
		return nil
	})
	if errors.Is(err, fs.ErrNotExist) {
		if _, statErr := os.Stat(src); errors.Is(statErr, fs.ErrNotExist) {
			return nil
		}
	}
	return err
}

func copyFile(src, dst string) error {
	in, err := os.Open(src)
	if err != nil {
		return err
	}
	defer func() { _ = in.Close() }()
	out, err := os.OpenFile(dst, os.O_CREATE|os.O_TRUNC|os.O_WRONLY, 0o644)
	if err != nil {
		return err
	}
	_, err = io.Copy(out, in)
	return errors.Join(err, out.Close())
}
