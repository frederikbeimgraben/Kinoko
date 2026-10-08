package render

import (
	"encoding/json"
	"errors"
	"io/fs"
	"os"
	"path"
	"path/filepath"
	"slices"
	"strings"
)

// Cleanup removes the week folders that no manifest in maps names, as step 4b
// of update.sh. A species manifest keeps the folders of its weeks under
// <name>_kacheln; layers.json keeps the weeks of each weekly layer.
func Cleanup(maps string) error {
	files, err := filepath.Glob(filepath.Join(maps, "*.json"))
	if err != nil {
		return err
	}
	var errs []error
	for _, file := range files {
		data, err := os.ReadFile(file)
		if err != nil {
			errs = append(errs, err)
			continue
		}
		if filepath.Base(file) == LayersFile {
			errs = append(errs, cleanLayers(maps, data))
			continue
		}
		var m struct {
			Name  string `json:"name"`
			Weeks []struct {
				Tiles string `json:"tiles"`
			} `json:"weeks"`
		}
		if err := json.Unmarshal(data, &m); err != nil || !safeName(m.Name) {
			continue
		}
		var keep []string
		for _, w := range m.Weeks {
			if w.Tiles != "" {
				keep = append(keep, path.Base(w.Tiles))
			}
		}
		errs = append(errs, cleanSpecies(maps, m.Name, keep))
	}
	return errors.Join(errs...)
}

// cleanLayers removes the old week folders of each weekly layer of layers.json.
func cleanLayers(maps string, data []byte) error {
	var m struct {
		Layers map[string]struct {
			Static bool     `json:"static"`
			Tiles  string   `json:"tiles"`
			Weeks  []string `json:"weeks"`
		} `json:"layers"`
	}
	if err := json.Unmarshal(data, &m); err != nil {
		return nil
	}
	var errs []error
	for _, l := range m.Layers {
		if !l.Static && l.Tiles != "" && safeRel(l.Tiles) {
			errs = append(errs, keepOnly(filepath.Join(maps, filepath.FromSlash(l.Tiles)), l.Weeks))
		}
	}
	return errors.Join(errs...)
}

func cleanSpecies(maps, name string, keep []string) error {
	return keepOnly(filepath.Join(maps, name+"_kacheln"), keep)
}

// keepOnly removes each folder in root whose name is not in keep. An empty
// keep list or a missing root changes nothing, as raeume in update.sh.
func keepOnly(root string, keep []string) error {
	if len(keep) == 0 {
		return nil
	}
	entries, err := os.ReadDir(root)
	if errors.Is(err, fs.ErrNotExist) {
		return nil
	}
	if err != nil {
		return err
	}
	var errs []error
	for _, e := range entries {
		if e.IsDir() && !slices.Contains(keep, e.Name()) {
			errs = append(errs, os.RemoveAll(filepath.Join(root, e.Name())))
		}
	}
	return errors.Join(errs...)
}

// safeName tells if s is a plain file name, so that a manifest cannot point outside maps.
func safeName(s string) bool {
	return s != "" && s != "." && s != ".." && !strings.ContainsAny(s, `/\`)
}

// safeRel tells if s is a relative slash path that stays inside its root.
func safeRel(s string) bool {
	if s == "" || strings.HasPrefix(s, "/") || strings.Contains(s, `\`) {
		return false
	}
	return !slices.Contains(strings.Split(s, "/"), "..")
}
