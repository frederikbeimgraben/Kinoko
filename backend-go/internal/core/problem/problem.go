// Package problem gives errors as problem documents (RFC 9457).
package problem

import (
	"encoding/json"
	"errors"
	"log/slog"
	"net/http"
	"strings"
	"sync/atomic"
)

const (
	// MediaType is the content type of a problem document.
	MediaType  = "application/problem+json"
	typePrefix = "urn:primordium:error:"
)

// FieldError names one field of the input and why it is not valid.
type FieldError struct {
	Field string `json:"field"`
	Code  string `json:"code"`
}

// Problem is an error that the service sends as a problem document.
type Problem struct {
	Code   string
	Status int
	Detail string
	Errors []FieldError
	Header http.Header
}

func (p *Problem) Error() string {
	if p.Detail != "" {
		return p.Code + ": " + p.Detail
	}
	return p.Code
}

// New makes a problem with a code and a status.
func New(code string, status int, detail string) *Problem {
	return &Problem{Code: code, Status: status, Detail: detail}
}

// NotFound tells that the row does not exist or belongs to another person.
func NotFound() *Problem { return New("not_found", http.StatusNotFound, "") }

// Unauthorized tells that the request has no valid token.
func Unauthorized() *Problem { return New("unauthorized", http.StatusUnauthorized, "") }

// Forbidden tells that the token does not have the necessary permission.
func Forbidden() *Problem { return New("forbidden", http.StatusForbidden, "") }

// Conflict tells that the operation is not possible with the current data.
func Conflict(code, detail string) *Problem {
	if code == "" {
		code = "conflict"
	}
	return New(code, http.StatusConflict, detail)
}

// TooLarge tells that the request body is too large.
func TooLarge() *Problem { return New("too_large", http.StatusRequestEntityTooLarge, "") }

// UnsupportedMedia tells that the content type is not accepted.
func UnsupportedMedia() *Problem {
	return New("unsupported_media", http.StatusUnsupportedMediaType, "")
}

// Invalid tells that the input does not agree with the contract.
func Invalid(errs ...FieldError) *Problem {
	return &Problem{Code: "validation", Status: http.StatusUnprocessableEntity, Errors: errs}
}

// InvalidField is Invalid with one field error.
func InvalidField(field, code string) *Problem {
	return Invalid(FieldError{Field: field, Code: code})
}

// MethodNotAllowed tells that the path does not accept the method.
func MethodNotAllowed(allowed []string) *Problem {
	return &Problem{
		Code:   "method_not_allowed",
		Status: http.StatusMethodNotAllowed,
		Header: http.Header{"Allow": {strings.Join(allowed, ", ")}},
	}
}

// Internal is the problem for an error without a cause the client can know.
func Internal() *Problem { return New("internal", http.StatusInternalServerError, "") }

var titles atomic.Pointer[map[string]string]

// SetTitles sets the titles of the codes from the text catalogue.
func SetTitles(values map[string]string) {
	copied := make(map[string]string, len(values))
	for key, value := range values {
		copied[key] = value
	}
	titles.Store(&copied)
}

// TitleKey gives the text key of a code: "not_found" gives "error.notFound".
func TitleKey(code string) string {
	parts := strings.Split(code, "_")
	var b strings.Builder
	b.WriteString("error.")
	b.WriteString(parts[0])
	for _, part := range parts[1:] {
		if part == "" {
			continue
		}
		b.WriteString(strings.ToUpper(part[:1]) + part[1:])
	}
	return b.String()
}

// TitleOf gives the title of a code. Without a catalogue it gives the code.
func TitleOf(code string) string {
	if loaded := titles.Load(); loaded != nil {
		if title, ok := (*loaded)[TitleKey(code)]; ok {
			return title
		}
	}
	return code
}

type document struct {
	Type   string       `json:"type"`
	Title  string       `json:"title"`
	Status int          `json:"status"`
	Code   string       `json:"code"`
	Detail string       `json:"detail,omitempty"`
	Errors []FieldError `json:"errors,omitempty"`
}

// From converts any error to a problem. An unknown error becomes Internal.
func From(err error) *Problem {
	var p *Problem
	if errors.As(err, &p) {
		return p
	}
	return Internal()
}

// Write sends the problem document of err.
func Write(w http.ResponseWriter, err error) {
	p := From(err)
	if p.Status == http.StatusInternalServerError {
		slog.Error("request failed", "error", err)
	}
	for name, values := range p.Header {
		for _, value := range values {
			w.Header().Add(name, value)
		}
	}
	body, _ := json.Marshal(document{
		Type:   typePrefix + p.Code,
		Title:  TitleOf(p.Code),
		Status: p.Status,
		Code:   p.Code,
		Detail: p.Detail,
		Errors: p.Errors,
	})
	w.Header().Set("Content-Type", MediaType)
	w.WriteHeader(p.Status)
	_, _ = w.Write(body)
}
