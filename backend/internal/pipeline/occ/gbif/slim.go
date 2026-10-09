// Package gbif fills the GBIF occurrence cache of the chain: it pages the
// public occurrence search API and imports an uploaded GBIF
// download archive. Both write the same slim JSON-Lines files.
package gbif

import (
	"bytes"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"strconv"
	"strings"
	"unicode"

	"github.com/frederikbeimgraben/kinoko/backend/internal/pipeline/core/pyjson"
)

// Fields are the keys that a slim record keeps, in this order.
var Fields = strings.Fields("gbifID datasetKey publishingOrgKey license basisOfRecord occurrenceStatus " +
	"kingdom phylum class order family genus species scientificName " +
	"acceptedScientificName taxonRank taxonKey acceptedTaxonKey speciesKey genusKey " +
	"decimalLatitude decimalLongitude coordinateUncertaintyInMeters elevation " +
	"eventDate year month day stateProvince individualCount " +
	"identificationVerificationStatus issues lastInterpreted")

// ObserverKey is the key of the observer hash in a slim record.
const ObserverKey = "recordedByHash"

// HashObserver gives the first 16 hex digits of the SHA-256 of the
// trimmed, lower-case observer text. ok is false for an empty value.
// A value that is not a string is hashed in its json.dumps(sort_keys=True) form.
func HashObserver(value any) (hash string, ok bool) {
	text, ok := observerText(value)
	if !ok {
		return "", false
	}
	sum := sha256.Sum256([]byte(pyLower(pyStrip(text))))
	return hex.EncodeToString(sum[:])[:16], true
}

// observerText gives the text of the observer hash. null, "", 0, false and
// empty containers count as no observer.
func observerText(value any) (string, bool) {
	switch v := value.(type) {
	case nil:
		return "", false
	case string:
		return v, v != ""
	case bool:
		if !v {
			return "", false
		}
	case int64:
		if v == 0 {
			return "", false
		}
	case float64:
		if v == 0 {
			return "", false
		}
	case []any:
		if len(v) == 0 {
			return "", false
		}
	case map[string]any:
		if len(v) == 0 {
			return "", false
		}
	}
	return string(pyjson.Marshal(value, -1, true)), true
}

// pyStrip is str.strip(): it also removes the separators U+001C..U+001F, which Python counts as space.
func pyStrip(s string) string {
	return strings.TrimFunc(s, func(r rune) bool { return unicode.IsSpace(r) || (r >= 0x1c && r <= 0x1f) })
}

// pyLower is str.lower(). Go maps U+0130 to "i", Python to "i" plus a combining dot.
func pyLower(s string) string {
	return strings.ToLower(strings.ReplaceAll(s, "İ", "i̇"))
}

// Slim is slim(): the kept fields of a record in Fields order, then the observer hash.
func Slim(record map[string]any) *pyjson.Obj {
	out := pyjson.NewObj()
	for _, k := range Fields {
		if v, ok := record[k]; ok {
			out.Set(k, v)
		}
	}
	if h, ok := HashObserver(record["recordedBy"]); ok {
		out.Set(ObserverKey, h)
	} else {
		out.Set(ObserverKey, nil)
	}
	return out
}

// Line formats a slim record as one JSON line, as json.dumps(ensure_ascii=False) plus "\n".
func Line(slim *pyjson.Obj) []byte {
	return append(pyjson.Marshal(slim, -1, false), '\n')
}

// DecodeObject reads a JSON object with the number rules of Python json:
// an integer literal gives int64, another number gives float64.
func DecodeObject(raw []byte) (map[string]any, error) {
	dec := json.NewDecoder(bytes.NewReader(raw))
	dec.UseNumber()
	var v map[string]any
	if err := dec.Decode(&v); err != nil {
		return nil, err
	}
	return pyNumbers(v).(map[string]any), nil
}

// pyNumbers replaces each json.Number in v as Python json.loads types it.
func pyNumbers(v any) any {
	switch x := v.(type) {
	case json.Number:
		return pyNumber(string(x))
	case []any:
		out := make([]any, len(x))
		for i, e := range x {
			out[i] = pyNumbers(e)
		}
		return out
	case map[string]any:
		out := make(map[string]any, len(x))
		for k, e := range x {
			out[k] = pyNumbers(e)
		}
		return out
	}
	return v
}

func pyNumber(s string) any {
	if !strings.ContainsAny(s, ".eE") {
		if i, err := strconv.ParseInt(s, 10, 64); err == nil {
			return i
		}
	}
	f, err := strconv.ParseFloat(s, 64)
	if err != nil {
		panic(fmt.Sprintf("gbif: bad JSON number %q", s))
	}
	return f
}
