package occ

import "time"

// Bounds of a pandas Timestamp in nanoseconds. A date outside gives NaT.
var (
	minTimestamp = time.Unix(0, -1<<63+1)
	maxTimestamp = time.Unix(0, 1<<63-1)
)

// ParseEventDate is the date step of build_occurrences.add_time:
// pd.to_datetime(eventDate, format="ISO8601", errors="coerce", utc=True), made naive and normalised.
// A time with an offset goes to UTC first, so the day can change. ok is false where pandas gives NaT.
// "now" and "today" also give false: pandas reads them as the clock, which a record never means.
func ParseEventDate(s string) (day time.Time, ok bool) {
	t, ok := parseISO(s)
	if !ok || t.Before(minTimestamp) || t.After(maxTimestamp) {
		return time.Time{}, false
	}
	t = t.UTC()
	return time.Date(t.Year(), t.Month(), t.Day(), 0, 0, 0, 0, time.UTC), true
}

// isoScanner walks a string as parse_iso_8601_datetime of pandas np_datetime_strings.c.
type isoScanner struct {
	s string
	i int
}

func (p *isoScanner) left() int { return len(p.s) - p.i }
func (p *isoScanner) peek() byte {
	if p.i < len(p.s) {
		return p.s[p.i]
	}
	return 0
}
func (p *isoScanner) digit() bool { c := p.peek(); return c >= '0' && c <= '9' }
func (p *isoScanner) space() bool {
	switch p.peek() {
	case ' ', '\t', '\n', '\v', '\f', '\r':
		return true
	}
	return false
}
func (p *isoScanner) next() int { c := p.s[p.i]; p.i++; return int(c - '0') }

// number reads one digit and a second one when it follows. need2 refuses a single digit.
func (p *isoScanner) number(need2 bool) (n, digits int, ok bool) {
	if !p.digit() {
		return 0, 0, false
	}
	n, digits = p.next(), 1
	if p.digit() {
		n, digits = n*10+p.next(), 2
	} else if need2 {
		return 0, 0, false
	}
	return n, digits, true
}

const ymdSeparators = "-./\\ "

// parseISO gives the instant of an ISO 8601 text. A text without an offset is UTC, as utc=True does.
func parseISO(s string) (time.Time, bool) {
	p := &isoScanner{s: s}
	for p.left() > 0 && p.space() {
		p.i++
	}
	if p.peek() == '-' || p.left() < 4 {
		return time.Time{}, false
	}
	year := 0
	for range 4 {
		if !p.digit() {
			return time.Time{}, false
		}
		year = year*10 + p.next()
	}
	if p.left() == 0 {
		return date(year, 1, 1, 0, 0, 0, 0)
	}
	sep := byte(0)
	if !p.digit() {
		sep = p.peek()
		if !containsByte(ymdSeparators, sep) {
			return time.Time{}, false
		}
		p.i++
		if !p.digit() {
			return time.Time{}, false
		}
	}
	month, _, ok := p.number(sep == 0)
	if !ok || month < 1 || month > 12 {
		return time.Time{}, false
	}
	if p.left() == 0 {
		if sep == 0 {
			return time.Time{}, false
		}
		return date(year, month, 1, 0, 0, 0, 0)
	}
	if sep != 0 {
		if p.peek() != sep {
			return time.Time{}, false
		}
		p.i++
	}
	day, _, ok := p.number(sep == 0)
	if !ok || day < 1 || day > daysIn(year, month) {
		return time.Time{}, false
	}
	if p.left() == 0 {
		return date(year, month, day, 0, 0, 0, 0)
	}
	if (p.peek() != 'T' && p.peek() != ' ') || p.left() == 1 {
		return time.Time{}, false
	}
	p.i++
	return p.parseTime(year, month, day)
}

func (p *isoScanner) parseTime(year, month, day int) (time.Time, bool) {
	hour, hourDigits, ok := p.number(false)
	if !ok || hour >= 24 {
		return time.Time{}, false
	}
	minute, sec := 0, 0
	if p.left() == 0 {
		if hourDigits != 2 {
			return time.Time{}, false
		}
		return date(year, month, day, hour, 0, 0, 0)
	}
	hms := false
	switch {
	case p.peek() == ':':
		hms = true
		p.i++
		if !p.digit() {
			return time.Time{}, false
		}
	case !p.digit():
		if hourDigits != 2 {
			return time.Time{}, false
		}
		return p.parseZone(year, month, day, hour, 0, 0)
	}
	minute, _, ok = p.number(!hms)
	if !ok || minute >= 60 {
		return time.Time{}, false
	}
	if p.left() == 0 {
		return date(year, month, day, hour, minute, 0, 0)
	}
	switch {
	case hms && p.peek() == ':':
		p.i++
		if !p.digit() {
			return time.Time{}, false
		}
	case !hms && p.digit():
	default:
		return p.parseZone(year, month, day, hour, minute, 0)
	}
	sec, _, ok = p.number(!hms)
	if !ok || sec >= 60 {
		return time.Time{}, false
	}
	if p.peek() == '.' {
		p.i++
		for k := 0; k < maxFraction && p.digit(); k++ {
			p.i++
		}
	}
	return p.parseZone(year, month, day, hour, minute, sec)
}

// maxFraction is the number of fraction digits that pandas reads (micro, pico and atto seconds).
// The fraction cannot change the day, so the parser skips it.
const maxFraction = 18

func (p *isoScanner) parseZone(year, month, day, hour, minute, sec int) (time.Time, bool) {
	for p.left() > 0 && p.space() {
		p.i++
	}
	offset := 0
	switch {
	case p.left() == 0:
	case p.peek() == 'Z':
		p.i++
	case p.peek() == '+' || p.peek() == '-':
		neg := p.peek() == '-'
		p.i++
		oh, digits, ok := p.number(false)
		if !ok || (digits == 2 && oh >= 24) {
			return time.Time{}, false
		}
		om := 0
		if p.left() > 0 {
			if p.peek() == ':' {
				p.i++
			}
			if om, digits, ok = p.number(false); !ok || (digits == 2 && om >= 60) {
				return time.Time{}, false
			}
		}
		offset = oh*60 + om
		if neg {
			offset = -offset
		}
	default:
		return time.Time{}, false
	}
	for p.left() > 0 && p.space() {
		p.i++
	}
	if p.left() != 0 {
		return time.Time{}, false
	}
	return date(year, month, day, hour, minute, sec, offset)
}

// date gives the UTC instant of a local time with an offset in minutes.
func date(year, month, day, hour, minute, sec, offset int) (time.Time, bool) {
	t := time.Date(year, time.Month(month), day, hour, minute, sec, 0, time.UTC)
	return t.Add(-time.Duration(offset) * time.Minute), true
}

func daysIn(year, month int) int {
	return time.Date(year, time.Month(month)+1, 0, 0, 0, 0, 0, time.UTC).Day()
}

func containsByte(s string, c byte) bool {
	for i := range len(s) {
		if s[i] == c {
			return true
		}
	}
	return false
}
