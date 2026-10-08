package sources_test

import (
	"net/http"
	"path/filepath"
	"strconv"
	"testing"

	"github.com/frederikbeimgraben/kinoko/backend/internal/core/config"
	"github.com/frederikbeimgraben/kinoko/backend/internal/modules/sources"
	"github.com/frederikbeimgraben/kinoko/backend/internal/testkit"
)

// fixture is a running service with the data root in a temporary folder.
type fixture struct {
	t     *testing.T
	env   *testkit.Env
	m     *sources.Module
	admin *testkit.Person
}

func newFixture(t *testing.T) *fixture {
	t.Helper()
	root := filepath.Join(t.TempDir(), "daten")
	env := testkit.New(t, testkit.WithSettings(func(s *config.Settings) { s.DataRoot = root }))
	var m *sources.Module
	for _, module := range env.Service.Modules {
		if found, ok := module.(*sources.Module); ok {
			m = found
		}
	}
	if m == nil {
		t.Fatal("the service has no sources module")
	}
	m.SetFree(func(string) (uint64, error) { return 1 << 50, nil })
	t.Cleanup(m.Wait)
	return &fixture{t: t, env: env, m: m, admin: testkit.Ptr(testkit.Admin())}
}

func (f *fixture) exec(query string, args ...any) {
	f.t.Helper()
	if _, err := f.env.DB.Exec(query, args...); err != nil {
		f.t.Fatal(err)
	}
}

func scalar[T any](f *fixture, query string, args ...any) T {
	f.t.Helper()
	var value T
	if err := f.env.DB.QueryRow(query, args...).Scan(&value); err != nil {
		f.t.Fatal(err)
	}
	return value
}

// create opens an upload session and gives its JSON.
func (f *fixture) create(kind sources.Kind, body map[string]any, status int) map[string]any {
	f.t.Helper()
	return f.env.Post("/data-sources/"+string(kind)+"/uploads", body, f.admin).Expect(f.t, status).Map(f.t)
}

func (f *fixture) patch(id string, offset int64, part []byte) testkit.Response {
	f.t.Helper()
	return f.env.Do(testkit.Request{
		Method: http.MethodPatch, Path: "/data-source-uploads/" + id, As: f.admin, RawBody: part,
		Type: "application/octet-stream", Header: http.Header{"Upload-Offset": {strconv.FormatInt(offset, 10)}},
	})
}

func (f *fixture) complete(id string, body any) testkit.Response {
	f.t.Helper()
	return f.env.Post("/data-source-uploads/"+id+"/complete", body, f.admin)
}

// upload sends a whole file in parts and completes it. It gives the version
// JSON after the processing in the background.
func (f *fixture) upload(kind sources.Kind, name string, data []byte, extra map[string]any) map[string]any {
	f.t.Helper()
	body := map[string]any{"fileName": name, "sizeBytes": len(data), "sha256": sources.Sum(data)}
	for key, value := range extra {
		body[key] = value
	}
	session := f.create(kind, body, http.StatusCreated)
	id := session["id"].(string)
	for offset := 0; offset < len(data); offset += sources.PartSize {
		end := min(offset+sources.PartSize, len(data))
		f.patch(id, int64(offset), data[offset:end]).Expect(f.t, http.StatusOK)
	}
	version := f.complete(id, nil).Expect(f.t, http.StatusAccepted).Map(f.t)
	f.m.Wait()
	return f.version(kind, version["id"].(string))
}

func (f *fixture) version(kind sources.Kind, id string) map[string]any {
	f.t.Helper()
	return f.env.Get("/data-sources/"+string(kind)+"/versions/"+id, f.admin).Expect(f.t, http.StatusOK).Map(f.t)
}

