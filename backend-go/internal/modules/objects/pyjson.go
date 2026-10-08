package objects

import (
	"errors"
	"fmt"
	"math"
	"strconv"
	"strings"
	"unicode/utf16"
)

// laxInt reads an integer as pydantic does: 3 and 3.0 are both 3.
type laxInt int

var errNotInteger = errors.New("not an integer")

// UnmarshalJSON reads a JSON number with no fraction, or a text with such a number.
func (n *laxInt) UnmarshalJSON(data []byte) error {
	text := strings.Trim(strings.TrimSpace(string(data)), `"`)
	value, err := strconv.ParseFloat(strings.TrimSpace(text), 64)
	if err != nil || value != math.Trunc(value) || math.IsInf(value, 0) {
		return errNotInteger
	}
	*n = laxInt(value)
	return nil
}

// laxFloat reads a number, or a text with a number, as pydantic does.
type laxFloat float64

// UnmarshalJSON reads a JSON number or a text with a number.
func (f *laxFloat) UnmarshalJSON(data []byte) error {
	text := strings.Trim(strings.TrimSpace(string(data)), `"`)
	value, err := strconv.ParseFloat(strings.TrimSpace(text), 64)
	if err != nil {
		return err
	}
	*f = laxFloat(value)
	return nil
}

// pyFloat writes a float as Python repr does. The stored JSON then has the
// same bytes as the rows that the old service wrote.
func pyFloat(f float64) string {
	switch {
	case math.IsNaN(f):
		return "NaN"
	case math.IsInf(f, 1):
		return "Infinity"
	case math.IsInf(f, -1):
		return "-Infinity"
	}
	exact := strconv.FormatFloat(f, 'e', -1, 64)
	exponent, _ := strconv.Atoi(exact[strings.IndexByte(exact, 'e')+1:])
	if exponent < -4 || exponent >= 16 {
		return exact
	}
	fixed := strconv.FormatFloat(f, 'f', -1, 64)
	if !strings.Contains(fixed, ".") {
		fixed += ".0"
	}
	return fixed
}

// pyString writes a JSON string as Python json.dumps does with ensure_ascii.
func pyString(s string) string {
	var b strings.Builder
	b.WriteByte('"')
	for _, r := range s {
		switch r {
		case '"':
			b.WriteString(`\"`)
		case '\\':
			b.WriteString(`\\`)
		case '\n':
			b.WriteString(`\n`)
		case '\r':
			b.WriteString(`\r`)
		case '\t':
			b.WriteString(`\t`)
		case '\b':
			b.WriteString(`\b`)
		case '\f':
			b.WriteString(`\f`)
		default:
			switch {
			case r < 0x20 || (r > 0x7e && r < 0x10000):
				if r == 0x7f {
					b.WriteRune(r)
				} else {
					fmt.Fprintf(&b, `\u%04x`, r)
				}
			case r >= 0x10000:
				high, low := utf16.EncodeRune(r)
				fmt.Fprintf(&b, `\u%04x\u%04x`, high, low)
			default:
				b.WriteRune(r)
			}
		}
	}
	b.WriteByte('"')
	return b.String()
}

func pyOptFloat(f *float64) string {
	if f == nil {
		return "null"
	}
	return pyFloat(*f)
}

func pyBool(v bool) string {
	if v {
		return "true"
	}
	return "false"
}
