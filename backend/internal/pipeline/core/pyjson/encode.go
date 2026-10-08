package pyjson

import (
	"fmt"
	"reflect"
	"regexp"
	"slices"
	"strconv"
	"strings"
	"unicode/utf8"
)

// layout holds the formatting options of json.dumps.
type layout struct {
	indent      int // below 0: no line breaks
	itemSep     string
	keySep      string
	ensureASCII bool
}

// Marshal formats v as json.dumps(v, indent=indent, ensure_ascii=ensureASCII); a negative indent means None.
// It accepts nil, bool, string, integers, floats, *Obj, Valuer, slices, arrays, maps with string keys
// (in key order) and pointers to these. It panics on another type.
func Marshal(v any, indent int, ensureASCII bool) []byte {
	l := layout{indent: indent, itemSep: ", ", keySep: ": ", ensureASCII: ensureASCII}
	if indent >= 0 {
		l.itemSep = ","
	}
	return l.encode(nil, v, 0)
}

// MarshalCompact formats v as json.dumps(v, separators=(",", ":"), ensure_ascii=ensureASCII).
func MarshalCompact(v any, ensureASCII bool) []byte {
	l := layout{indent: -1, itemSep: ",", keySep: ":", ensureASCII: ensureASCII}
	return l.encode(nil, v, 0)
}

// numberList is the pattern of manifest._ZAHLENLISTE. It holds no quote and
// no bracket, so it catches neither strings nor nested lists.
var numberList = regexp.MustCompile(`\[[\s\d.,eE+-]*\]`)

// MarshalManifest formats v as manifest.schreibe: json.dumps(v, indent=1)
// with each list of plain numbers on one line. It adds no newline at the end.
func MarshalManifest(v any) []byte {
	return numberList.ReplaceAllFunc(Marshal(v, 1, true), func(m []byte) []byte {
		inner := strings.ReplaceAll(string(m[1:len(m)-1]), ",", " ")
		return []byte("[" + strings.Join(strings.Fields(inner), ", ") + "]")
	})
}

func (l layout) newline(buf []byte, level int) []byte {
	if l.indent < 0 {
		return buf
	}
	return append(append(buf, '\n'), strings.Repeat(" ", l.indent*level)...)
}

func (l layout) encode(buf []byte, v any, level int) []byte {
	switch x := v.(type) {
	case nil:
		return append(buf, "null"...)
	case *Obj:
		if x == nil {
			return append(buf, "null"...)
		}
		return l.object(buf, x.keys, func(k string) any { return x.vals[k] }, level)
	case Obj:
		return l.encode(buf, &x, level)
	case Valuer:
		return l.encode(buf, x.PyJSON(), level)
	case bool:
		return strconv.AppendBool(buf, x)
	case string:
		return l.str(buf, x)
	case float64:
		return append(buf, PyFloat(x)...)
	case float32:
		return append(buf, PyFloat(float64(x))...)
	case []any:
		return l.list(buf, len(x), func(i int) any { return x[i] }, level)
	}
	return l.reflected(buf, reflect.ValueOf(v), level)
}

func (l layout) reflected(buf []byte, rv reflect.Value, level int) []byte {
	switch rv.Kind() {
	case reflect.Int, reflect.Int8, reflect.Int16, reflect.Int32, reflect.Int64:
		return strconv.AppendInt(buf, rv.Int(), 10)
	case reflect.Uint, reflect.Uint8, reflect.Uint16, reflect.Uint32, reflect.Uint64, reflect.Uintptr:
		return strconv.AppendUint(buf, rv.Uint(), 10)
	case reflect.Float32, reflect.Float64:
		return append(buf, PyFloat(rv.Float())...)
	case reflect.Bool:
		return strconv.AppendBool(buf, rv.Bool())
	case reflect.String:
		return l.str(buf, rv.String())
	case reflect.Pointer, reflect.Interface:
		if rv.IsNil() {
			return append(buf, "null"...)
		}
		return l.encode(buf, rv.Elem().Interface(), level)
	case reflect.Slice, reflect.Array:
		return l.list(buf, rv.Len(), func(i int) any { return rv.Index(i).Interface() }, level)
	case reflect.Map:
		if rv.Type().Key().Kind() != reflect.String {
			break
		}
		keys := slices.Sorted(func(yield func(string) bool) {
			for _, k := range rv.MapKeys() {
				if !yield(k.String()) {
					return
				}
			}
		})
		get := func(k string) any { return rv.MapIndex(reflect.ValueOf(k).Convert(rv.Type().Key())).Interface() }
		return l.object(buf, keys, get, level)
	}
	panic(fmt.Sprintf("pyjson: type %s is not JSON serializable", rv.Type()))
}

func (l layout) list(buf []byte, n int, item func(int) any, level int) []byte {
	if n == 0 {
		return append(buf, "[]"...)
	}
	buf = append(buf, '[')
	for i := range n {
		if i > 0 {
			buf = append(buf, l.itemSep...)
		}
		buf = l.newline(buf, level+1)
		buf = l.encode(buf, item(i), level+1)
	}
	return append(l.newline(buf, level), ']')
}

func (l layout) object(buf []byte, keys []string, get func(string) any, level int) []byte {
	if len(keys) == 0 {
		return append(buf, "{}"...)
	}
	buf = append(buf, '{')
	for i, k := range keys {
		if i > 0 {
			buf = append(buf, l.itemSep...)
		}
		buf = l.newline(buf, level+1)
		buf = append(l.str(buf, k), l.keySep...)
		buf = l.encode(buf, get(k), level+1)
	}
	return append(l.newline(buf, level), '}')
}

var namedEscapes = map[rune]string{'"': `\"`, '\\': `\\`, '\n': `\n`, '\r': `\r`, '\t': `\t`, '\b': `\b`, '\f': `\f`}

// str quotes s as json.encoder.py_encode_basestring(_ascii). An invalid UTF-8
// byte counts as U+FFFD.
func (l layout) str(buf []byte, s string) []byte {
	buf = append(buf, '"')
	for _, r := range s {
		if esc, ok := namedEscapes[r]; ok {
			buf = append(buf, esc...)
			continue
		}
		switch {
		case r < 0x20 || (l.ensureASCII && r == 0x7f):
			buf = fmt.Appendf(buf, `\u%04x`, r)
		case !l.ensureASCII || r < 0x80:
			buf = utf8.AppendRune(buf, r)
		case r > 0xffff:
			r -= 0x10000
			buf = fmt.Appendf(buf, `\u%04x\u%04x`, 0xd800|(r>>10)&0x3ff, 0xdc00|r&0x3ff)
		default:
			buf = fmt.Appendf(buf, `\u%04x`, r)
		}
	}
	return append(buf, '"')
}
