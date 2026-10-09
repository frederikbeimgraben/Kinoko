package exporter

import (
	"bytes"
	"encoding/json"
	"errors"
	"fmt"
	"io/fs"
)

// member is one key of a JSON object with its raw value.
type member struct {
	Key   string
	Value json.RawMessage
}

// readObject reads the keys of a JSON object in file order. An absent file gives no keys.
func readObject(data fs.FS, name string) ([]member, error) {
	body, err := fs.ReadFile(data, name)
	if errors.Is(err, fs.ErrNotExist) {
		return nil, nil
	}
	if err != nil {
		return nil, err
	}
	dec := json.NewDecoder(bytes.NewReader(body))
	if token, err := dec.Token(); err != nil || token != json.Delim('{') {
		return nil, fmt.Errorf("%s: no JSON object", name)
	}
	var out []member
	for dec.More() {
		token, err := dec.Token()
		if err != nil {
			return nil, fmt.Errorf("%s: %w", name, err)
		}
		key, _ := token.(string)
		var value json.RawMessage
		if err := dec.Decode(&value); err != nil {
			return nil, fmt.Errorf("%s: %w", name, err)
		}
		out = append(out, member{key, value})
	}
	return out, nil
}

// raw encodes a value without HTML escapes, as the seed files have it.
func raw(value any) (json.RawMessage, error) {
	var b bytes.Buffer
	enc := json.NewEncoder(&b)
	enc.SetEscapeHTML(false)
	if err := enc.Encode(value); err != nil {
		return nil, err
	}
	return bytes.TrimSpace(b.Bytes()), nil
}

// setMember replaces the value of a key, or adds the key at the end.
func setMember(members []member, key string, value json.RawMessage) []member {
	for i := range members {
		if members[i].Key == key {
			members[i].Value = value
			return members
		}
	}
	return append(members, member{key, value})
}

// writeObject writes the object with an indent of two spaces and a newline at the end.
func writeObject(members []member) ([]byte, error) {
	var compact bytes.Buffer
	compact.WriteByte('{')
	for i, m := range members {
		if i > 0 {
			compact.WriteByte(',')
		}
		key, err := raw(m.Key)
		if err != nil {
			return nil, err
		}
		compact.Write(key)
		compact.WriteByte(':')
		if err := json.Compact(&compact, m.Value); err != nil {
			return nil, err
		}
	}
	compact.WriteByte('}')
	var out bytes.Buffer
	if err := json.Indent(&out, compact.Bytes(), "", "  "); err != nil {
		return nil, err
	}
	out.WriteByte('\n')
	return out.Bytes(), nil
}
