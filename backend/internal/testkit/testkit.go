// Package testkit builds the whole service for a test: a new database, a
// fake OpenID issuer that signs tokens, and helpers for requests.
package testkit

import (
	"bytes"
	"context"
	"crypto/rand"
	"crypto/rsa"
	"database/sql"
	"encoding/base64"
	"encoding/json"
	"io"
	"io/fs"
	"math/big"
	"mime/multipart"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"sync"
	"testing"
	"time"

	"github.com/golang-jwt/jwt/v5"

	"github.com/frederikbeimgraben/kinoko/backend/internal/app"
	"github.com/frederikbeimgraben/kinoko/backend/internal/core/config"
	"github.com/frederikbeimgraben/kinoko/backend/internal/core/db"
)

const (
	issuerURL = "https://issuer.test/application/o/pilze/"
	clientID  = "pilze"
	keyID     = "test-key"
	// AdminGroup is the group that makes a person an administrator.
	AdminGroup = "pilze-admins"
)

// Env is a running service for one test.
type Env struct {
	T        testing.TB
	DB       *sql.DB
	Service  *app.Service
	Settings config.Settings
	key      *rsa.PrivateKey
	Now      time.Time
}

// Option changes the environment before the service starts.
type Option func(*options)

type options struct {
	data     fs.FS
	settings func(*config.Settings)
}

// WithData uses another seed data folder.
func WithData(data fs.FS) Option { return func(o *options) { o.data = data } }

// WithSettings changes the settings.
func WithSettings(change func(*config.Settings)) Option {
	return func(o *options) { o.settings = change }
}

// New builds the service on a new database in a temporary folder.
func New(t testing.TB, opts ...Option) *Env {
	t.Helper()
	chosen := options{}
	for _, opt := range opts {
		opt(&chosen)
	}
	dir := t.TempDir()
	settings := config.Defaults()
	settings.DB = filepath.Join(dir, "pilze.sqlite")
	settings.Photos = filepath.Join(dir, "fotos")
	settings.Maps = filepath.Join(dir, "maps")
	settings.RunLogs = filepath.Join(dir, "runs")
	settings.OIDCIssuer = issuerURL
	settings.OIDCClientID = clientID
	settings.AdminGroup = AdminGroup
	settings.PipelineEnable = false
	if chosen.settings != nil {
		chosen.settings(&settings)
	}
	if chosen.data == nil && chosen.settings == nil {
		if err := copyTemplate(settings.DB); err != nil {
			t.Fatal(err)
		}
	}
	handle, err := db.Open(settings.DB)
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { _ = handle.Close() })
	key, err := rsa.GenerateKey(rand.Reader, 2048)
	if err != nil {
		t.Fatal(err)
	}
	env := &Env{T: t, DB: handle, Settings: settings, key: key, Now: time.Now()}
	service, err := app.Build(context.Background(), settings, handle, app.Options{
		HTTPClient: &http.Client{Transport: env.issuerTransport()},
		Data:       chosen.data,
	})
	if err != nil {
		t.Fatal(err)
	}
	env.Service = service
	return env
}

var (
	templateOnce sync.Once
	templatePath string
	templateErr  error
)

// copyTemplate copies a database that is migrated and seeded once per test
// process. The catalogue import takes seconds, and most tests need it.
func copyTemplate(target string) error {
	templateOnce.Do(func() {
		dir, err := os.MkdirTemp("", "kinoko-template-")
		if err != nil {
			templateErr = err
			return
		}
		templatePath = filepath.Join(dir, "template.sqlite")
		templateErr = buildTemplate(templatePath)
	})
	if templateErr != nil {
		return templateErr
	}
	data, err := os.ReadFile(templatePath)
	if err != nil {
		return err
	}
	return os.WriteFile(target, data, 0o600)
}

func buildTemplate(path string) error {
	settings := config.Defaults()
	settings.DB = path
	settings.PipelineEnable = false
	settings.OIDCIssuer = issuerURL
	handle, err := db.Open(path)
	if err != nil {
		return err
	}
	defer func() { _ = handle.Close() }()
	if _, err := app.Build(context.Background(), settings, handle, app.Options{}); err != nil {
		return err
	}
	_, err = handle.Exec("PRAGMA wal_checkpoint(TRUNCATE)")
	return err
}

// Person describes the token of a test person.
type Person struct {
	Sub    string
	Email  string
	Name   string
	Groups []string
}

// Admin is a person in the admin group.
func Admin() Person {
	return Person{Sub: "admin-sub", Email: "admin@example.org", Name: "Admin", Groups: []string{AdminGroup}}
}

// Someone is a person without a special group.
func Someone(sub string) Person {
	return Person{Sub: sub, Email: sub + "@example.org", Name: sub, Groups: []string{}}
}

// Token signs an access token for the person.
func (e *Env) Token(p Person) string {
	e.T.Helper()
	claims := jwt.MapClaims{
		"sub":    p.Sub,
		"iss":    issuerURL,
		"aud":    clientID,
		"exp":    time.Now().Add(time.Hour).Unix(),
		"iat":    time.Now().Unix(),
		"groups": p.Groups,
	}
	if p.Email != "" {
		claims["email"] = p.Email
	}
	if p.Name != "" {
		claims["name"] = p.Name
	}
	token := jwt.NewWithClaims(jwt.SigningMethodRS256, claims)
	token.Header["kid"] = keyID
	signed, err := token.SignedString(e.key)
	if err != nil {
		e.T.Fatal(err)
	}
	return signed
}

func (e *Env) issuerTransport() http.RoundTripper {
	jwks := map[string]any{"keys": []any{map[string]any{
		"kid": keyID,
		"kty": "RSA",
		"alg": "RS256",
		"n":   base64.RawURLEncoding.EncodeToString(e.key.N.Bytes()),
		"e":   base64.RawURLEncoding.EncodeToString(big.NewInt(int64(e.key.E)).Bytes()),
	}}}
	discovery := map[string]any{
		"jwks_uri":          issuerURL + "jwks/",
		"userinfo_endpoint": issuerURL + "userinfo/",
	}
	return roundTrip(func(r *http.Request) (*http.Response, error) {
		var body any = map[string]any{}
		switch r.URL.String() {
		case issuerURL + ".well-known/openid-configuration":
			body = discovery
		case issuerURL + "jwks/":
			body = jwks
		}
		encoded, _ := json.Marshal(body)
		return &http.Response{
			StatusCode: http.StatusOK,
			Header:     http.Header{"Content-Type": {"application/json"}},
			Body:       io.NopCloser(bytes.NewReader(encoded)),
			Request:    r,
		}, nil
	})
}

type roundTrip func(*http.Request) (*http.Response, error)

func (f roundTrip) RoundTrip(r *http.Request) (*http.Response, error) { return f(r) }

// Request describes one request.
type Request struct {
	Method  string
	Path    string
	Body    any
	As      *Person
	Header  http.Header
	Remote  string
	RawBody []byte
	Type    string
}

// Response is the answer of a request.
type Response struct {
	Status int
	Header http.Header
	Body   []byte
}

// JSON decodes the body into a value of type T.
func JSON[T any](t testing.TB, r Response) T {
	t.Helper()
	var value T
	if err := json.Unmarshal(r.Body, &value); err != nil {
		t.Fatalf("decode %s: %v", string(r.Body), err)
	}
	return value
}

// Map decodes the body as a JSON object.
func (r Response) Map(t testing.TB) map[string]any { return JSON[map[string]any](t, r) }

// Do sends the request to the service. Path is relative to /api.
func (e *Env) Do(req Request) Response {
	e.T.Helper()
	var body io.Reader
	contentType := req.Type
	switch {
	case req.RawBody != nil:
		body = bytes.NewReader(req.RawBody)
	case req.Body != nil:
		encoded, err := json.Marshal(req.Body)
		if err != nil {
			e.T.Fatal(err)
		}
		body = bytes.NewReader(encoded)
		if contentType == "" {
			contentType = "application/json"
		}
	}
	request := httptest.NewRequest(req.Method, "/api"+req.Path, body)
	request.RemoteAddr = "192.0.2.1:1234"
	if req.Remote != "" {
		request.RemoteAddr = req.Remote
	}
	if contentType != "" {
		request.Header.Set("Content-Type", contentType)
	}
	for name, values := range req.Header {
		for _, value := range values {
			request.Header.Add(name, value)
		}
	}
	if req.As != nil {
		request.Header.Set("Authorization", "Bearer "+e.Token(*req.As))
	}
	recorder := httptest.NewRecorder()
	e.Service.Handler.ServeHTTP(recorder, request)
	return Response{Status: recorder.Code, Header: recorder.Header(), Body: recorder.Body.Bytes()}
}

// Get is Do with GET.
func (e *Env) Get(path string, as *Person) Response {
	return e.Do(Request{Method: http.MethodGet, Path: path, As: as})
}

// Post is Do with POST and a JSON body.
func (e *Env) Post(path string, body any, as *Person) Response {
	return e.Do(Request{Method: http.MethodPost, Path: path, Body: body, As: as})
}

// Put is Do with PUT and a JSON body.
func (e *Env) Put(path string, body any, as *Person) Response {
	return e.Do(Request{Method: http.MethodPut, Path: path, Body: body, As: as})
}

// Patch is Do with PATCH and a JSON body.
func (e *Env) Patch(path string, body any, as *Person) Response {
	return e.Do(Request{Method: http.MethodPatch, Path: path, Body: body, As: as})
}

// Delete is Do with DELETE.
func (e *Env) Delete(path string, as *Person) Response {
	return e.Do(Request{Method: http.MethodDelete, Path: path, As: as})
}

// Multipart builds a multipart body with fields and one file.
func Multipart(t testing.TB, fields map[string]string, fileField, fileName string, file []byte) ([]byte, string) {
	t.Helper()
	var buffer bytes.Buffer
	writer := multipart.NewWriter(&buffer)
	for name, value := range fields {
		if err := writer.WriteField(name, value); err != nil {
			t.Fatal(err)
		}
	}
	if fileField != "" {
		part, err := writer.CreateFormFile(fileField, fileName)
		if err != nil {
			t.Fatal(err)
		}
		if _, err := part.Write(file); err != nil {
			t.Fatal(err)
		}
	}
	if err := writer.Close(); err != nil {
		t.Fatal(err)
	}
	return buffer.Bytes(), writer.FormDataContentType()
}

// Expect fails the test when the status is not the expected one.
func (r Response) Expect(t testing.TB, status int) Response {
	t.Helper()
	if r.Status != status {
		t.Fatalf("status %d, expected %d: %s", r.Status, status, string(r.Body))
	}
	return r
}

// Ptr gives a pointer to the person. It makes call sites short.
func Ptr(p Person) *Person { return &p }
