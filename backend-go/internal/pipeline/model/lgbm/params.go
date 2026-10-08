package lgbm

import (
	"bytes"
	"encoding/json"
	"fmt"
	"math"
	"strconv"
	"strings"
)

// Param is one LightGBM parameter. Value is a string, bool, int, float64 or json.Number.
type Param struct {
	Key   string
	Value any
}

// Params is an ordered list of LightGBM parameters, as a Python dict keeps its order.
type Params []Param

// With returns a copy with key set to value. An existing key keeps its place, as in dict(PARAMS, key=value).
func (p Params) With(key string, value any) Params {
	out := make(Params, 0, len(p)+1)
	found := false
	for _, item := range p {
		if item.Key == key {
			item = Param{key, value}
			found = true
		}
		out = append(out, item)
	}
	if !found {
		out = append(out, Param{key, value})
	}
	return out
}

// Get returns the value of key.
func (p Params) Get(key string) (any, bool) {
	for _, item := range p {
		if item.Key == key {
			return item.Value, true
		}
	}
	return nil, false
}

// String returns the "key=value key=value" text of the C API, as Python's _param_dict_to_str.
func (p Params) String() string {
	parts := make([]string, len(p))
	for i, item := range p {
		parts[i] = item.Key + "=" + formatValue(item.Value)
	}
	return strings.Join(parts, " ")
}

func formatValue(v any) string {
	switch v := v.(type) {
	case string:
		return v
	case bool:
		return strconv.FormatBool(v)
	case int:
		return strconv.Itoa(v)
	case float64:
		return pyFloat(v)
	case json.Number:
		return v.String()
	default:
		return fmt.Sprint(v)
	}
}

// pyFloat writes v as Python repr writes a float in the usual range, so 10.0 stays "10.0".
func pyFloat(v float64) string {
	if math.IsInf(v, 0) || math.IsNaN(v) {
		return strconv.FormatFloat(v, 'g', -1, 64)
	}
	s := strconv.FormatFloat(v, 'g', -1, 64)
	if !strings.ContainsAny(s, ".e") {
		s += ".0"
	}
	return s
}

// MarshalJSON writes the parameters as a JSON object in their order.
func (p Params) MarshalJSON() ([]byte, error) {
	var buf bytes.Buffer
	buf.WriteByte('{')
	for i, item := range p {
		if i > 0 {
			buf.WriteByte(',')
		}
		key, _ := json.Marshal(item.Key)
		buf.Write(key)
		buf.WriteByte(':')
		value, err := marshalValue(item.Value)
		if err != nil {
			return nil, err
		}
		buf.Write(value)
	}
	buf.WriteByte('}')
	return buf.Bytes(), nil
}

func marshalValue(v any) ([]byte, error) {
	if f, ok := v.(float64); ok {
		if math.IsInf(f, 0) || math.IsNaN(f) {
			return nil, fmt.Errorf("lgbm: parameter value %v has no JSON form", f)
		}
		return []byte(pyFloat(f)), nil
	}
	return json.Marshal(v)
}

// UnmarshalJSON reads a JSON object and keeps the order of its keys. Numbers stay json.Number.
func (p *Params) UnmarshalJSON(data []byte) error {
	dec := json.NewDecoder(bytes.NewReader(data))
	dec.UseNumber()
	if tok, err := dec.Token(); err != nil || tok != json.Delim('{') {
		return fmt.Errorf("lgbm: parameters are not a JSON object")
	}
	out := Params{}
	for dec.More() {
		tok, err := dec.Token()
		if err != nil {
			return err
		}
		var value any
		if err := dec.Decode(&value); err != nil {
			return err
		}
		out = append(out, Param{tok.(string), value})
	}
	*p = out
	return nil
}
