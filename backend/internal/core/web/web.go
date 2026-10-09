// Package web connects handlers to net/http. A handler returns a response
// value or an error; the adapter writes either one.
package web

import (
	"bytes"
	"encoding/json"
	"errors"
	"io"
	"log/slog"
	"net/http"
	"strings"

	"github.com/frederikbeimgraben/kinoko/backend/internal/core/db"
	"github.com/frederikbeimgraben/kinoko/backend/internal/core/problem"
)

// Response is a value that can write itself to the client.
type Response interface {
	Send(w http.ResponseWriter)
}

// Handler answers one request.
type Handler func(r *http.Request) (Response, error)

// ServeHTTP runs the handler and writes its response or its problem.
func (h Handler) ServeHTTP(w http.ResponseWriter, r *http.Request) {
	response, err := h(r)
	if err != nil {
		problem.Write(w, err)
		return
	}
	if response == nil {
		Empty(http.StatusNoContent).Send(w)
		return
	}
	response.Send(w)
}

type jsonResponse struct {
	status int
	body   any
	header http.Header
}

func (j jsonResponse) Send(w http.ResponseWriter) {
	encoded, err := Encode(j.body)
	if err != nil {
		slog.Error("encode response", "error", err)
		problem.Write(w, problem.Internal())
		return
	}
	copyHeader(w.Header(), j.header)
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(j.status)
	_, _ = w.Write(encoded)
}

// Encode gives the JSON form of v: no HTML escapes and no line end.
func Encode(v any) ([]byte, error) {
	var buffer bytes.Buffer
	encoder := json.NewEncoder(&buffer)
	encoder.SetEscapeHTML(false)
	if err := encoder.Encode(v); err != nil {
		return nil, err
	}
	return bytes.TrimSuffix(buffer.Bytes(), []byte("\n")), nil
}

// JSON is a response with a JSON body.
func JSON(status int, body any) Response { return jsonResponse{status: status, body: body} }

// OK is JSON with status 200.
func OK(body any) Response { return JSON(http.StatusOK, body) }

// Created is JSON with status 201.
func Created(body any) Response { return JSON(http.StatusCreated, body) }

// JSONWithHeader is JSON with more header lines.
func JSONWithHeader(status int, body any, header http.Header) Response {
	return jsonResponse{status: status, body: body, header: header}
}

type emptyResponse struct {
	status int
	header http.Header
}

func (e emptyResponse) Send(w http.ResponseWriter) {
	copyHeader(w.Header(), e.header)
	w.WriteHeader(e.status)
}

// Empty is a response without a body.
func Empty(status int) Response { return emptyResponse{status: status} }

// EmptyWithHeader is a response without a body and with header lines.
func EmptyWithHeader(status int, header http.Header) Response {
	return emptyResponse{status: status, header: header}
}

type bytesResponse struct {
	status      int
	contentType string
	body        []byte
	header      http.Header
}

func (b bytesResponse) Send(w http.ResponseWriter) {
	copyHeader(w.Header(), b.header)
	w.Header().Set("Content-Type", b.contentType)
	w.WriteHeader(b.status)
	_, _ = w.Write(b.body)
}

// Bytes is a response with a raw body.
func Bytes(status int, contentType string, body []byte, header http.Header) Response {
	return bytesResponse{status: status, contentType: contentType, body: body, header: header}
}

type fileResponse struct {
	request *http.Request
	path    string
	header  http.Header
}

func (f fileResponse) Send(w http.ResponseWriter) {
	copyHeader(w.Header(), f.header)
	http.ServeFile(w, f.request, f.path)
}

// File is a response with the content of a file. The request gives the
// range and the conditional headers.
func File(r *http.Request, path string, header http.Header) Response {
	return fileResponse{request: r, path: path, header: header}
}

func copyHeader(target, source http.Header) {
	for name, values := range source {
		for _, value := range values {
			target.Add(name, value)
		}
	}
}

// maxJSONBytes limits a JSON body. Photos use multipart, not JSON.
const maxJSONBytes = 2 << 20

// Decode reads the JSON body into a value of type T.
// The contract middleware has already checked the body against the schema.
func Decode[T any](r *http.Request) (T, error) {
	var value T
	body, err := io.ReadAll(io.LimitReader(r.Body, maxJSONBytes+1))
	if err != nil {
		return value, problem.InvalidField("body", "read")
	}
	if len(body) > maxJSONBytes {
		return value, problem.TooLarge()
	}
	if len(strings.TrimSpace(string(body))) == 0 {
		return value, problem.InvalidField("body", "missing")
	}
	if err := json.Unmarshal(body, &value); err != nil {
		return value, problem.InvalidField(jsonField(err), "json_invalid")
	}
	return value, nil
}

func jsonField(err error) string {
	var typed *json.UnmarshalTypeError
	if errors.As(err, &typed) && typed.Field != "" {
		return typed.Field
	}
	return "body"
}

// PathID reads a path value as a row key.
func PathID(r *http.Request, name string) (db.ID, error) {
	id, err := db.ParseID(r.PathValue(name))
	if err != nil {
		return db.ID{}, problem.InvalidField(name, "uuid_parsing")
	}
	return id, nil
}

// Query gives a query value, or nil when the request does not have it.
func Query(r *http.Request, name string) *string {
	values, ok := r.URL.Query()[name]
	if !ok || len(values) == 0 {
		return nil
	}
	return &values[0]
}
