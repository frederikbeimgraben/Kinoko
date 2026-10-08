package objects

import (
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
	"strings"

	"github.com/frederikbeimgraben/kinoko/backend/internal/core/problem"
	"github.com/frederikbeimgraben/kinoko/backend/internal/fn"
)

// layersFile is the index of the input layers next to the tiles.
const layersFile = "layers.json"

type layerEntry struct {
	Label *string `json:"label"`
	Unit  *string `json:"unit"`
}

// layerNames gives the names of the input layers under the maps folder.
// A missing or broken index gives no names.
func layerNames(maps string) map[string]struct{} {
	file := filepath.Join(maps, layersFile)
	if !isFile(file) {
		return map[string]struct{}{}
	}
	data, err := os.ReadFile(file)
	if err != nil {
		return map[string]struct{}{}
	}
	var index struct {
		Layers map[string]layerEntry `json:"layers"`
	}
	if err := json.Unmarshal(data, &index); err != nil {
		return map[string]struct{}{}
	}
	names := make([]string, 0, len(index.Layers))
	for name := range index.Layers {
		names = append(names, name)
	}
	return fn.Set(names)
}

// mapNames gives the names of the forecast maps: the stems of the JSON
// files under the maps folder, without the layer index.
func mapNames(maps string) map[string]struct{} {
	entries, err := os.ReadDir(maps)
	if err != nil {
		return map[string]struct{}{}
	}
	names := fn.Filter(fn.Map(entries, func(e os.DirEntry) string { return e.Name() }), func(name string) bool {
		return strings.HasSuffix(name, ".json") && name != layersFile
	})
	return fn.Set(fn.Map(names, func(name string) string { return strings.TrimSuffix(name, ".json") }))
}

// checkSources gives an error for each source that is not a layer or a map.
// Without layers and maps there is nothing to check against.
func checkSources(maps string, sources []string) []problem.FieldError {
	known := layerNames(maps)
	for name := range mapNames(maps) {
		known[name] = struct{}{}
	}
	if len(known) == 0 {
		return nil
	}
	unknown := fn.Filter(fn.Enumerate(sources), func(p fn.Pair[int, string]) bool {
		_, ok := known[p.Second]
		return !ok
	})
	return append([]problem.FieldError{}, fn.Map(unknown, func(p fn.Pair[int, string]) problem.FieldError {
		return problem.FieldError{Field: fmt.Sprintf("factors.%d.source", p.First), Code: "unknown_source"}
	})...)
}

func isFile(path string) bool {
	info, err := os.Stat(path)
	return err == nil && info.Mode().IsRegular()
}
