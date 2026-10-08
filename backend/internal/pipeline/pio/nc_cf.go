package pio

import (
	"fmt"
	"math"
	"regexp"
	"strconv"
	"strings"
	"time"
)

// NumType is the class of a netCDF number type that xarray uses to choose the decode type.
type NumType int

// Number classes.
const (
	NumSmallInt NumType = iota // 1- and 2-byte integers.
	NumInt32                   // 4-byte integers.
	NumInt64                   // 8-byte integers.
	NumFloat32
	NumFloat64
)

// Att is a numeric attribute and its type.
type Att struct {
	Value float64
	Type  NumType
}

// Packing holds the CF mask and scale rules of one variable.
// Wide tells that xarray decodes the variable to float64; else it decodes to float32.
type Packing struct {
	Fills  []float64
	Scale  *Att
	Offset *Att
	Wide   bool
}

// NewPacking gives the decode rules for raw data of type raw. It follows
// _choose_float_dtype and CFMaskCoder of xarray 2026.4: these choose float32 or float64.
func NewPacking(raw NumType, fills []float64, scale, offset *Att) Packing {
	keep := make([]float64, 0, len(fills))
	for _, fv := range fills {
		if !math.IsNaN(fv) {
			keep = append(keep, fv)
		}
	}
	return Packing{Fills: keep, Scale: scale, Offset: offset, Wide: wideDecode(raw, scale, offset)}
}

func wideDecode(raw NumType, scale, offset *Att) bool {
	isFloat := func(a *Att) bool { return a.Type == NumFloat32 || a.Type == NumFloat64 }
	switch {
	case scale != nil && offset != nil && scale.Type == offset.Type && isFloat(scale):
		return raw == NumInt32 || scale.Type == NumFloat64
	case offset != nil:
		return true
	case scale != nil:
		return scale.Type != NumFloat32
	case raw == NumFloat32 || raw == NumSmallInt:
		return false
	case raw == NumFloat64:
		return true
	}
	// xarray decodes masked int32 and int64 data to float64. Unmasked data stays integer, and float64 holds it.
	return true
}

// Decode32 masks and scales one raw value in float32 arithmetic.
// Each step rounds to float32, as numpy does for a float32 array.
func (p Packing) Decode32(raw float32) float32 {
	for _, fv := range p.Fills {
		if float64(raw) == fv {
			return nan32
		}
	}
	x := raw
	if p.Scale != nil {
		x = float32(x * float32(p.Scale.Value))
	}
	if p.Offset != nil {
		x = float32(x + float32(p.Offset.Value))
	}
	return x
}

// Decode64 masks and scales one raw value in float64 arithmetic.
// The conversions stop a fused multiply-add, which numpy does not use.
func (p Packing) Decode64(raw float64) float64 {
	for _, fv := range p.Fills {
		if raw == fv {
			return math.NaN()
		}
	}
	x := raw
	if p.Scale != nil {
		x = float64(x * p.Scale.Value)
	}
	if p.Offset != nil {
		x = float64(x + p.Offset.Value)
	}
	return x
}

var cfTimeUnits = regexp.MustCompile(`^\s*(\w+)\s+since\s+(-?\d{1,4})-(\d{1,2})-(\d{1,2})` +
	`(?:[ t]+(\d{1,2}):(\d{1,2})(?::(\d{1,2}(?:\.\d*)?))?)?` +
	`\s*(z|utc|gmt|[+-]\d{1,2}(?::?\d{2})?)?\s*$`)

var cfUnitNanos = map[string]float64{
	"days": 86400e9, "day": 86400e9, "d": 86400e9,
	"hours": 3600e9, "hour": 3600e9, "hrs": 3600e9, "hr": 3600e9, "h": 3600e9,
	"minutes": 60e9, "minute": 60e9, "mins": 60e9, "min": 60e9,
	"seconds": 1e9, "second": 1e9, "secs": 1e9, "sec": 1e9, "s": 1e9,
	"milliseconds": 1e6, "millisecond": 1e6, "msecs": 1e6, "ms": 1e6,
	"microseconds": 1e3, "microsecond": 1e3, "us": 1e3,
}

// gregorianStart is the first day of the Gregorian calendar. The "standard" calendar is Julian before it.
var gregorianStart = time.Date(1582, 10, 15, 0, 0, 0, 0, time.UTC)

// DecodeCFTime decodes CF time values like "days since 1951-01-01" to UTC times.
// It accepts the standard, gregorian and proleptic_gregorian calendars.
func DecodeCFTime(values []float64, units, calendar string) ([]time.Time, error) {
	cal := strings.ToLower(strings.TrimSpace(calendar))
	switch cal {
	case "", "standard", "gregorian", "proleptic_gregorian":
	default:
		return nil, fmt.Errorf("calendar %q is not supported", calendar)
	}
	ref, step, err := parseCFUnits(units)
	if err != nil {
		return nil, err
	}
	out := make([]time.Time, len(values))
	for i, v := range values {
		if math.IsNaN(v) || math.IsInf(v, 0) {
			return nil, fmt.Errorf("time value %d is %v", i, v)
		}
		ns := v * step
		if math.Abs(ns) > math.MaxInt64/2 {
			return nil, fmt.Errorf("time value %d is out of range", i)
		}
		out[i] = ref.Add(time.Duration(math.Round(ns)))
		if cal != "proleptic_gregorian" && out[i].Before(gregorianStart) {
			return nil, fmt.Errorf("time %s is before the Gregorian calendar", out[i])
		}
	}
	return out, nil
}

// parseCFUnits gives the reference time and the length of one unit in nanoseconds.
func parseCFUnits(units string) (time.Time, float64, error) {
	m := cfTimeUnits.FindStringSubmatch(strings.ToLower(units))
	if m == nil {
		return time.Time{}, 0, fmt.Errorf("time units %q are not CF units", units)
	}
	step, ok := cfUnitNanos[m[1]]
	if !ok {
		return time.Time{}, 0, fmt.Errorf("time unit %q is not supported", m[1])
	}
	num := func(s string) int {
		n, _ := strconv.Atoi(s)
		return n
	}
	sec, _ := strconv.ParseFloat(orZero(m[7]), 64)
	whole := math.Floor(sec)
	ref := time.Date(num(m[2]), time.Month(num(m[3])), num(m[4]), num(m[5]), num(m[6]),
		int(whole), int(math.Round((sec-whole)*1e9)), time.UTC)
	zone, err := zoneOffset(m[8])
	if err != nil {
		return time.Time{}, 0, err
	}
	return ref.Add(-zone), step, nil
}

func orZero(s string) string {
	if s == "" {
		return "0"
	}
	return s
}

// zoneOffset parses "+01:00", "+0100", "-5" or "Z" to the offset east of UTC.
func zoneOffset(s string) (time.Duration, error) {
	if s == "" || s == "z" || s == "utc" || s == "gmt" {
		return 0, nil
	}
	sign := time.Duration(1)
	if s[0] == '-' {
		sign = -1
	}
	digits := strings.ReplaceAll(s[1:], ":", "")
	hh, mm := digits, "0"
	if len(digits) > 2 {
		hh, mm = digits[:len(digits)-2], digits[len(digits)-2:]
	}
	h, err1 := strconv.Atoi(hh)
	m, err2 := strconv.Atoi(mm)
	if err1 != nil || err2 != nil {
		return 0, fmt.Errorf("time zone %q is not valid", s)
	}
	return sign * (time.Duration(h)*time.Hour + time.Duration(m)*time.Minute), nil
}

// Normalize sets a time to midnight of its UTC day, as pandas DatetimeIndex.normalize() does.
func Normalize(t time.Time) time.Time {
	y, m, d := t.UTC().Date()
	return time.Date(y, m, d, 0, 0, 0, 0, time.UTC)
}
