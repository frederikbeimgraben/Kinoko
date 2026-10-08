package pyjson

import (
	"encoding/binary"
	"encoding/hex"
	"encoding/json"
	"math"
	"os"
	"path/filepath"
	"strconv"
	"testing"
)

func f64(t *testing.T, s string) float64 {
	t.Helper()
	b, err := hex.DecodeString(s)
	if err != nil || len(b) != 8 {
		t.Fatalf("bad hex %q", s)
	}
	return math.Float64frombits(binary.BigEndian.Uint64(b))
}

func readJSON(t *testing.T, path string, v any) {
	t.Helper()
	raw, err := os.ReadFile(path)
	if err != nil {
		t.Fatal(err)
	}
	if err := json.Unmarshal(raw, v); err != nil {
		t.Fatal(err)
	}
}

// typed is a value of the golden files with its Python type.
type typed struct {
	T string          `json:"t"`
	V json.RawMessage `json:"v"`
}

func (n typed) build(t *testing.T) any {
	t.Helper()
	var s string
	switch n.T {
	case "null":
		return nil
	case "bool":
		var b bool
		_ = json.Unmarshal(n.V, &b)
		return b
	case "int":
		_ = json.Unmarshal(n.V, &s)
		i, err := strconv.ParseInt(s, 10, 64)
		if err != nil {
			t.Fatal(err)
		}
		return i
	case "float":
		_ = json.Unmarshal(n.V, &s)
		return f64(t, s)
	case "str":
		_ = json.Unmarshal(n.V, &s)
		return s
	case "list":
		var items []typed
		_ = json.Unmarshal(n.V, &items)
		out := make([]any, len(items))
		for i, item := range items {
			out[i] = item.build(t)
		}
		return out
	case "obj":
		var pairs [][2]json.RawMessage
		_ = json.Unmarshal(n.V, &pairs)
		o := NewObj()
		for _, p := range pairs {
			var k string
			var v typed
			_ = json.Unmarshal(p[0], &k)
			_ = json.Unmarshal(p[1], &v)
			o.Set(k, v.build(t))
		}
		return o
	}
	t.Fatalf("unknown type %q", n.T)
	return nil
}

// dumps.json comes from testdata/golden.py (pyjson_golden): manifest.schreibe and
// json.dumps with indent 2, 0, None, ensure_ascii False and separators (",", ":").
func TestMarshalMatchesPython(t *testing.T) {
	var cases []struct {
		Value                               typed
		Manifest, Indent2, Indent0, Default string
		Unicode, Compact, CompactUnicode    string
	}
	readJSON(t, "testdata/dumps.json", &cases)
	for i, c := range cases {
		v := c.Value.build(t)
		checks := []struct {
			name string
			got  []byte
			want string
		}{
			{"manifest", MarshalManifest(v), c.Manifest},
			{"indent2", Marshal(v, 2, true), c.Indent2},
			{"indent0", Marshal(v, 0, true), c.Indent0},
			{"default", Marshal(v, -1, true), c.Default},
			{"unicode", Marshal(v, 1, false), c.Unicode},
			{"compact", MarshalCompact(v, true), c.Compact},
			{"compactUnicode", MarshalCompact(v, false), c.CompactUnicode},
		}
		for _, k := range checks {
			if string(k.got) != k.want {
				t.Errorf("case %d %s:\n got %q\nwant %q", i, k.name, k.got, k.want)
			}
		}
	}
}

// floats.json comes from testdata/golden.py (pyjson_golden): repr(float) and round(x, nd).
func TestFloatsMatchPython(t *testing.T) {
	var g struct {
		Repr  []struct{ Bits, Repr string }
		Round []struct {
			X  string
			Nd int
			R  string
		}
	}
	readJSON(t, "testdata/floats.json", &g)
	for _, r := range g.Repr {
		if got := PyFloat(f64(t, r.Bits)); got != r.Repr {
			t.Errorf("PyFloat(%v) = %s, want %s", f64(t, r.Bits), got, r.Repr)
		}
	}
	for _, r := range g.Round {
		x, want := f64(t, r.X), f64(t, r.R)
		if got := Round(x, r.Nd); math.Float64bits(got) != math.Float64bits(want) {
			t.Errorf("Round(%v, %d) = %v, want %v", x, r.Nd, got, want)
		}
	}
}

func TestMarshalGoTypes(t *testing.T) {
	type label string
	v := O("f32", float32(0.1), "ints", []int32{1, 2}, "map", map[string]int{"b": 2, "a": 1},
		"ptr", new(int), "nilptr", (*int)(nil), "label", label("x"), "arr", [2]float64{1, 2.5},
		"strs", []string{"a"}, "empty", []float64(nil))
	want := `{"f32":0.10000000149011612,"ints":[1,2],"map":{"a":1,"b":2},"ptr":0,"nilptr":null,` +
		`"label":"x","arr":[1.0,2.5],"strs":["a"],"empty":[]}`
	if got := string(MarshalCompact(v, true)); got != want {
		t.Errorf("got  %s\nwant %s", got, want)
	}
	o := O("a", 1, "b", 2).Set("a", 3)
	if got := string(MarshalCompact(o, true)); got != `{"a":3,"b":2}` {
		t.Errorf("Set keeps the position of a key: %s", got)
	}
	defer func() {
		if recover() == nil {
			t.Error("a struct must panic")
		}
	}()
	Marshal(struct{}{}, 1, true)
}

func TestWriteManifest(t *testing.T) {
	dir := t.TempDir()
	path := filepath.Join(dir, "boletus-edulis.json")
	v := O("name", "Steinpilz", "top", 0.5, "zooms", []int{5, 9})
	if err := WriteManifest(path, v); err != nil {
		t.Fatal(err)
	}
	if err := WriteManifest(path, v.Set("top", 0.25)); err != nil {
		t.Fatal(err)
	}
	got, err := os.ReadFile(path)
	if err != nil {
		t.Fatal(err)
	}
	want := "{\n \"name\": \"Steinpilz\",\n \"top\": 0.25,\n \"zooms\": [5, 9]\n}"
	if string(got) != want {
		t.Errorf("got %q, want %q", got, want)
	}
	entries, _ := os.ReadDir(dir)
	if len(entries) != 1 {
		t.Errorf("temporary files stay: %v", entries)
	}
	if info, _ := os.Stat(path); info.Mode().Perm() != 0o644 {
		t.Errorf("mode %v", info.Mode())
	}
	if err := WriteManifest(filepath.Join(dir, "missing", "x.json"), v); err == nil {
		t.Error("a missing folder must fail")
	}
}
