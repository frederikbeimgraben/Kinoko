// Package paging reads "limit" and "cursor" from a request and builds the
// answer {items, nextCursor}. A cursor is the base64 form of an offset.
package paging

import (
	"encoding/base64"
	"net/http"
	"strconv"
	"strings"

	"github.com/frederikbeimgraben/kinoko/backend/internal/core/problem"
)

const (
	// MaxLimit is the largest page of most lists.
	MaxLimit = 50
	// SmallLimit is the largest page of the species list.
	SmallLimit = 40
)

// Paging is one page: how many rows, and from which offset.
type Paging struct {
	Limit  int
	Offset int
}

// Page is the answer of a list endpoint.
type Page[T any] struct {
	Items      []T     `json:"items"`
	NextCursor *string `json:"nextCursor"`
}

// Encode makes an opaque cursor from an offset.
func Encode(offset int) string {
	return strings.TrimRight(base64.URLEncoding.EncodeToString([]byte(strconv.Itoa(offset))), "=")
}

// Decode reads the offset from a cursor.
func Decode(cursor string) (int, error) {
	padded := cursor + strings.Repeat("=", (4-len(cursor)%4)%4)
	raw, err := base64.URLEncoding.DecodeString(padded)
	if err != nil {
		return 0, problem.InvalidField("cursor", "cursor")
	}
	value, err := strconv.Atoi(string(raw))
	if err != nil || value < 0 {
		return 0, problem.InvalidField("cursor", "cursor")
	}
	return value, nil
}

// FromRequest reads the page. The default limit is max.
func FromRequest(r *http.Request, max int) (Paging, error) {
	query := r.URL.Query()
	limit := max
	if raw := query.Get("limit"); raw != "" {
		value, err := strconv.Atoi(raw)
		if err != nil {
			return Paging{}, problem.InvalidField("limit", "int_parsing")
		}
		if value < 1 {
			return Paging{}, problem.InvalidField("limit", "greater_than_equal")
		}
		if value > max {
			return Paging{}, problem.InvalidField("limit", "less_than_equal")
		}
		limit = value
	}
	offset := 0
	if raw := query.Get("cursor"); raw != "" {
		value, err := Decode(raw)
		if err != nil {
			return Paging{}, err
		}
		offset = value
	}
	return Paging{Limit: limit, Offset: offset}, nil
}

// SQL gives the LIMIT and OFFSET values that read one row more than the page.
func (p Paging) SQL() (limit, offset int) { return p.Limit + 1, p.Offset }

// Wrap builds the page from rows that hold one row more than the page when
// there is a next page.
func Wrap[T any](rows []T, p Paging) Page[T] {
	if len(rows) <= p.Limit {
		return Page[T]{Items: nonNil(rows)}
	}
	next := Encode(p.Offset + p.Limit)
	return Page[T]{Items: rows[:p.Limit], NextCursor: &next}
}

// Slice builds the page from all rows in memory.
func Slice[T any](all []T, p Paging) Page[T] {
	start := min(p.Offset, len(all))
	end := min(start+p.Limit+1, len(all))
	return Wrap(all[start:end], p)
}

func nonNil[T any](rows []T) []T {
	if rows == nil {
		return []T{}
	}
	return rows
}
