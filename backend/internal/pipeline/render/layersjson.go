package render

import (
	"bytes"
	"encoding/json"
	"errors"
	"fmt"
	"io/fs"
	"os"
	"strconv"
	"strings"

	"github.com/frederikbeimgraben/kinoko/backend/internal/pipeline/core/pyjson"
)

// LayersFile is the name of the layer manifest in PILZE_MAPS.
const LayersFile = "layers.json"

// decodeOrdered reads JSON as json.loads does: objects keep their key order
// (*pyjson.Obj), a number with a point or an exponent is a float64, other
// numbers are int64. Writing the result with pyjson gives the same text again.
func decodeOrdered(data []byte) (any, error) {
	dec := json.NewDecoder(bytes.NewReader(data))
	dec.UseNumber()
	v, err := decodeValue(dec)
	if err != nil {
		return nil, err
	}
	if _, err := dec.Token(); err == nil {
		return nil, errors.New("render: data after the JSON value")
	}
	return v, nil
}

func decodeValue(dec *json.Decoder) (any, error) {
	tok, err := dec.Token()
	if err != nil {
		return nil, err
	}
	switch t := tok.(type) {
	case json.Delim:
		switch t {
		case '{':
			obj := pyjson.NewObj()
			for dec.More() {
				key, err := dec.Token()
				if err != nil {
					return nil, err
				}
				v, err := decodeValue(dec)
				if err != nil {
					return nil, err
				}
				obj.Set(key.(string), v)
			}
			_, err := dec.Token()
			return obj, err
		case '[':
			list := []any{}
			for dec.More() {
				v, err := decodeValue(dec)
				if err != nil {
					return nil, err
				}
				list = append(list, v)
			}
			_, err := dec.Token()
			return list, err
		}
		return nil, fmt.Errorf("render: unexpected %v", t)
	case json.Number:
		if strings.ContainsAny(string(t), ".eE") {
			return strconv.ParseFloat(string(t), 64)
		}
		return strconv.ParseInt(string(t), 10, 64)
	default:
		return t, nil
	}
}

// readLayers reads layers.json as an ordered object. A missing file gives an empty object.
func readLayers(path string) (*pyjson.Obj, error) {
	data, err := os.ReadFile(path)
	if errors.Is(err, fs.ErrNotExist) {
		return pyjson.NewObj(), nil
	}
	if err != nil {
		return nil, err
	}
	v, err := decodeOrdered(data)
	if err != nil {
		return nil, fmt.Errorf("render: %s: %w", path, err)
	}
	obj, ok := v.(*pyjson.Obj)
	if !ok {
		return nil, fmt.Errorf("render: %s is not a JSON object", path)
	}
	return obj, nil
}

// layerEntries returns the "layers" object of a manifest, or an empty one.
func layerEntries(m *pyjson.Obj) *pyjson.Obj {
	v, _ := m.Get("layers")
	if obj, ok := v.(*pyjson.Obj); ok {
		return obj
	}
	return pyjson.NewObj()
}

// isStatic tells if a layer entry has "static" set to true, as v.get("static").
func isStatic(entry any) bool {
	obj, ok := entry.(*pyjson.Obj)
	if !ok {
		return false
	}
	v, _ := obj.Get("static")
	b, ok := v.(bool)
	return ok && b
}

// staticEntries returns the static entries of layers in their order.
func staticEntries(layers *pyjson.Obj) *pyjson.Obj {
	out := pyjson.NewObj()
	for _, k := range layers.Keys() {
		v, _ := layers.Get(k)
		if isStatic(v) {
			out.Set(k, v)
		}
	}
	return out
}
