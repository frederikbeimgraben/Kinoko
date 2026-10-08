package render

import (
	"errors"
	"fmt"
	"io"
	"io/fs"
	"os"
	"path/filepath"
	"strings"

	"github.com/frederikbeimgraben/kinoko/backend/internal/pipeline/core/pyjson"
)

// InstallStaticLayers copies the static layers of an unpacked upload src (layers.json, layers_kacheln/<name>/...)
// into maps and merges them into layers.json: new static entries, kept old static entries, then weekly entries.
// Each tile folder changes in one rename before layers.json, so a reader never sees an entry without tiles.
func InstallStaticLayers(maps, src string) (*pyjson.Obj, error) {
	upload, err := readLayers(filepath.Join(src, LayersFile))
	if err != nil {
		return nil, err
	}
	incoming := staticEntries(layerEntries(upload))
	if incoming.Len() != layerEntries(upload).Len() {
		return nil, fmt.Errorf("render: the upload holds a layer that is not static")
	}
	for _, name := range incoming.Keys() {
		entry, _ := incoming.Get(name)
		rel, err := staticTiles(name, entry.(*pyjson.Obj))
		if err != nil {
			return nil, err
		}
		if err := replaceTree(filepath.Join(src, filepath.FromSlash(rel)), filepath.Join(maps, filepath.FromSlash(rel))); err != nil {
			return nil, err
		}
	}
	path := filepath.Join(maps, LayersFile)
	old, err := readLayers(path)
	if err != nil {
		return nil, err
	}
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
	bounds, ok := old.Get("bounds")
	if !ok {
		bounds, _ = upload.Get("bounds")
	}
	meta := pyjson.NewObj()
	if bounds != nil {
		meta.Set("bounds", bounds)
	}
	meta.Set("layers", merged)
	return meta, pyjson.WriteManifest(path, meta)
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

// replaceTree copies the folder src to dst.tmp and then renames it over dst.
func replaceTree(src, dst string) error {
	tmp := dst + ".tmp"
	if err := os.RemoveAll(tmp); err != nil {
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
		target := filepath.Join(tmp, rel)
		switch {
		case d.IsDir():
			return os.MkdirAll(target, 0o755)
		case d.Type().IsRegular():
			return copyFile(p, target)
		}
		return nil
	})
	if err != nil {
		return errors.Join(err, os.RemoveAll(tmp))
	}
	if err := os.RemoveAll(dst); err != nil {
		return err
	}
	return os.Rename(tmp, dst)
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
