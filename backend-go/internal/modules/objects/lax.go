package objects

import (
	"errors"
	"math"
	"strconv"
	"strings"
)

// laxInt reads an integer as pydantic does: 3 and 3.0 are both 3.
type laxInt int64

var errNotInteger = errors.New("not an integer")

// UnmarshalJSON reads a JSON number with no fraction, or a text with such a number.
func (n *laxInt) UnmarshalJSON(data []byte) error {
	value, ok := parseLaxInt(data)
	if !ok {
		return errNotInteger
	}
	*n = laxInt(value)
	return nil
}

// parseLaxInt reads integer digits exactly. Only a number with a fraction or
// an exponent goes through float64, as pydantic reads it as a float first.
// A value out of the int64 range gives false, so it never wraps.
func parseLaxInt(data []byte) (int64, bool) {
	text := strings.TrimSpace(strings.Trim(strings.TrimSpace(string(data)), `"`))
	value, err := strconv.ParseInt(text, 10, 64)
	if err == nil {
		return value, true
	}
	if errors.Is(err, strconv.ErrRange) {
		return 0, false
	}
	number, err := strconv.ParseFloat(text, 64)
	if err != nil || number != math.Trunc(number) || number < math.MinInt64 || number >= math.MaxInt64 {
		return 0, false
	}
	return int64(number), true
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
