package exporter

import (
	"fmt"
	"slices"
	"strconv"
	"strings"
)

// kv is one key of a table. The value is a string, bool, int64, float64, []string, inline,
// []inline, section or []section.
type kv struct {
	key   string
	value any
}

// inline is a table on one line: { a = 1, b = 2 }.
type inline []kv

// section is a table with its own header: [name].
type section []kv

// arrange orders the keys as the source file had them. A key that the source file did not have
// goes behind the last key that comes before it in the canonical order.
func arrange(entries []kv, source, canonical []string) []kv {
	rank := func(key string) int {
		if i := slices.Index(canonical, key); i >= 0 {
			return i
		}
		return len(canonical)
	}
	var out, added []kv
	for _, key := range source {
		if i := slices.IndexFunc(entries, func(e kv) bool { return e.key == key }); i >= 0 {
			out = append(out, entries[i])
		}
	}
	for _, e := range entries {
		if !slices.Contains(source, e.key) {
			added = append(added, e)
		}
	}
	slices.SortStableFunc(added, func(a, b kv) int { return rank(a.key) - rank(b.key) })
	for _, e := range added {
		at := 0
		for i, o := range out {
			if rank(o.key) <= rank(e.key) {
				at = i + 1
			}
		}
		out = slices.Insert(out, at, e)
	}
	return out
}

// render writes a document in the style of the seed files: plain keys first, then each
// section with a blank line before its header.
func render(top []kv) []byte {
	var b strings.Builder
	writeTable(&b, "", top)
	return []byte(b.String())
}

func writeTable(b *strings.Builder, path string, entries []kv) {
	for _, e := range entries {
		switch e.value.(type) {
		case section, []section:
		default:
			b.WriteString(e.key + " = " + value(e.value) + "\n")
		}
	}
	for _, e := range entries {
		name := e.key
		if path != "" {
			name = path + "." + e.key
		}
		switch v := e.value.(type) {
		case section:
			b.WriteString("\n[" + name + "]\n")
			writeTable(b, name, v)
		case []section:
			for _, item := range v {
				b.WriteString("\n[[" + name + "]]\n")
				writeTable(b, name, item)
			}
		}
	}
}

func value(v any) string {
	switch v := v.(type) {
	case string:
		return quote(v)
	case bool:
		return strconv.FormatBool(v)
	case int64:
		return strconv.FormatInt(v, 10)
	case int:
		return strconv.Itoa(v)
	case float64:
		text := strconv.FormatFloat(v, 'f', -1, 64)
		if !strings.Contains(text, ".") {
			text += ".0"
		}
		return text
	case []string:
		parts := make([]string, len(v))
		for i, s := range v {
			parts[i] = quote(s)
		}
		return "[" + strings.Join(parts, ", ") + "]"
	case []inline:
		parts := make([]string, len(v))
		for i, t := range v {
			parts[i] = value(t)
		}
		return "[" + strings.Join(parts, ", ") + "]"
	case inline:
		if len(v) == 0 {
			return "{}"
		}
		parts := make([]string, len(v))
		for i, e := range v {
			parts[i] = e.key + " = " + value(e.value)
		}
		return "{ " + strings.Join(parts, ", ") + " }"
	}
	panic(fmt.Sprintf("exporter: no TOML form for %T", v))
}

// quote writes a TOML basic string.
func quote(s string) string {
	var b strings.Builder
	b.WriteByte('"')
	for _, r := range s {
		switch {
		case r == '"' || r == '\\':
			b.WriteByte('\\')
			b.WriteRune(r)
		case r == '\n':
			b.WriteString(`\n`)
		case r == '\t':
			b.WriteString(`\t`)
		case r < 0x20 || r == 0x7f:
			fmt.Fprintf(&b, `\u%04X`, r)
		default:
			b.WriteRune(r)
		}
	}
	b.WriteByte('"')
	return b.String()
}
