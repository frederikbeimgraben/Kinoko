package db

import (
	"database/sql/driver"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"strings"
	"time"

	"github.com/google/uuid"
)

// ID is the key of a row. The database keeps it as 32 hex digits without
// dashes. JSON shows it as a UUID with dashes.
type ID uuid.UUID

// NewID makes a random key.
func NewID() ID { return ID(uuid.New()) }

// ParseID reads a key in UUID form, with or without dashes.
func ParseID(value string) (ID, error) {
	parsed, err := uuid.Parse(value)
	if err != nil {
		return ID{}, err
	}
	return ID(parsed), nil
}

// MustID reads a key and panics on an error. Use it only for constants.
func MustID(value string) ID {
	id, err := ParseID(value)
	if err != nil {
		panic(err)
	}
	return id
}

// String gives the UUID form with dashes.
func (id ID) String() string { return uuid.UUID(id).String() }

// IsZero tells if the key has no value.
func (id ID) IsZero() bool { return id == ID{} }

// Value gives the database form.
func (id ID) Value() (driver.Value, error) { return hex.EncodeToString(id[:]), nil }

// Scan reads the database form.
func (id *ID) Scan(src any) error {
	text, err := asText(src)
	if err != nil {
		return err
	}
	parsed, err := ParseID(text)
	if err != nil {
		return fmt.Errorf("scan id %q: %w", text, err)
	}
	*id = parsed
	return nil
}

// MarshalJSON gives the UUID form with dashes.
func (id ID) MarshalJSON() ([]byte, error) { return json.Marshal(id.String()) }

// UnmarshalJSON reads the UUID form.
func (id *ID) UnmarshalJSON(data []byte) error {
	var text string
	if err := json.Unmarshal(data, &text); err != nil {
		return err
	}
	parsed, err := ParseID(text)
	if err != nil {
		return err
	}
	*id = parsed
	return nil
}

const (
	storedTime = "2006-01-02 15:04:05.000000"
	storedDate = "2006-01-02"
)

// Time is a point in time in UTC. The database keeps it as text without a
// zone. JSON shows it as ISO 8601 with "Z".
type Time struct{ time.Time }

// Now gives the current time in UTC, to the microsecond.
func Now() Time { return Time{time.Now().UTC().Truncate(time.Microsecond)} }

// At wraps t as a database time.
func At(t time.Time) Time { return Time{t.UTC().Truncate(time.Microsecond)} }

// Value gives the database form.
func (t Time) Value() (driver.Value, error) { return t.UTC().Format(storedTime), nil }

// Scan reads the database form.
func (t *Time) Scan(src any) error {
	if value, ok := src.(time.Time); ok {
		*t = At(value)
		return nil
	}
	text, err := asText(src)
	if err != nil {
		return err
	}
	parsed, err := parseTime(text)
	if err != nil {
		return err
	}
	*t = At(parsed)
	return nil
}

// MarshalJSON gives ISO 8601 in UTC: six fraction digits when there is a fraction.
func (t Time) MarshalJSON() ([]byte, error) { return json.Marshal(t.ISO()) }

// ISO gives ISO 8601 in UTC: six fraction digits when there is a fraction.
func (t Time) ISO() string {
	u := t.UTC()
	if u.Nanosecond() == 0 {
		return u.Format("2006-01-02T15:04:05Z")
	}
	return u.Format("2006-01-02T15:04:05.000000Z")
}

// UnmarshalJSON reads ISO 8601. A value without a zone is UTC.
func (t *Time) UnmarshalJSON(data []byte) error {
	var text string
	if err := json.Unmarshal(data, &text); err != nil {
		return err
	}
	parsed, err := parseTime(text)
	if err != nil {
		return err
	}
	*t = At(parsed)
	return nil
}

func parseTime(text string) (time.Time, error) {
	layouts := []string{
		time.RFC3339Nano,
		"2006-01-02 15:04:05.999999999Z07:00",
		"2006-01-02 15:04:05.999999999",
		"2006-01-02T15:04:05.999999999",
		"2006-01-02 15:04:05",
		"2006-01-02T15:04:05",
	}
	for _, layout := range layouts {
		if parsed, err := time.Parse(layout, text); err == nil {
			return parsed, nil
		}
	}
	return time.Time{}, fmt.Errorf("time %q has an unknown form", text)
}

// Date is a calendar day. The database and JSON keep it as YYYY-MM-DD.
type Date struct{ time.Time }

// DateOf gives the day of t.
func DateOf(t time.Time) Date {
	return Date{time.Date(t.Year(), t.Month(), t.Day(), 0, 0, 0, 0, time.UTC)}
}

// ParseDate reads YYYY-MM-DD.
func ParseDate(text string) (Date, error) {
	parsed, err := time.Parse(storedDate, strings.TrimSpace(text))
	if err != nil {
		return Date{}, err
	}
	return Date{parsed}, nil
}

// String gives the stored form YYYY-MM-DD.
func (d Date) String() string { return d.Format(storedDate) }

// Value gives the database form.
func (d Date) Value() (driver.Value, error) { return d.String(), nil }

// Scan reads the database form.
func (d *Date) Scan(src any) error {
	if value, ok := src.(time.Time); ok {
		*d = DateOf(value)
		return nil
	}
	text, err := asText(src)
	if err != nil {
		return err
	}
	if len(text) > len(storedDate) {
		text = text[:len(storedDate)]
	}
	parsed, err := ParseDate(text)
	if err != nil {
		return err
	}
	*d = parsed
	return nil
}

// MarshalJSON gives YYYY-MM-DD.
func (d Date) MarshalJSON() ([]byte, error) { return json.Marshal(d.String()) }

// UnmarshalJSON reads YYYY-MM-DD.
func (d *Date) UnmarshalJSON(data []byte) error {
	var text string
	if err := json.Unmarshal(data, &text); err != nil {
		return err
	}
	parsed, err := ParseDate(text)
	if err != nil {
		return err
	}
	*d = parsed
	return nil
}

func asText(src any) (string, error) {
	switch value := src.(type) {
	case string:
		return value, nil
	case []byte:
		return string(value), nil
	default:
		return "", fmt.Errorf("unexpected database value %T", src)
	}
}
