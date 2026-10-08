package sources_test

import (
	"bytes"
	"crypto/rand"
	"net/http"
	"net/http/httptest"
	"os"
	"strconv"
	"testing"
	"time"

	"github.com/frederikbeimgraben/kinoko/backend/internal/core/db"
	"github.com/frederikbeimgraben/kinoko/backend/internal/modules/sources"
	"github.com/frederikbeimgraben/kinoko/backend/internal/testkit"
)

func randomBytes(t *testing.T, n int) []byte {
	t.Helper()
	data := make([]byte, n)
	if _, err := rand.Read(data); err != nil {
		t.Fatal(err)
	}
	return data
}

func outlineSession(f *fixture, size int) string {
	return f.create(sources.KindGermanyOutline, map[string]any{"fileName": "de.geojson", "sizeBytes": size}, http.StatusCreated)["id"].(string)
}

func TestUploadStateMachine(t *testing.T) {
	f := newFixture(t)
	data := randomBytes(t, 1000)
	cases := []struct {
		name   string
		steps  func(id string) testkit.Response
		status int
		code   string
	}{
		{"complete before all bytes", func(id string) testkit.Response {
			f.patch(id, 0, data[:400]).Expect(t, http.StatusOK)
			return f.complete(id, nil)
		}, http.StatusConflict, "incomplete"},
		{"part past the size", func(id string) testkit.Response {
			return f.patch(id, 0, append(bytes.Clone(data), 1))
		}, http.StatusRequestEntityTooLarge, "too_large"},
		{"part after abort", func(id string) testkit.Response {
			f.env.Delete("/data-source-uploads/"+id, f.admin).Expect(t, http.StatusNoContent)
			return f.patch(id, 0, data)
		}, http.StatusConflict, "upload_closed"},
		{"complete after abort", func(id string) testkit.Response {
			f.env.Delete("/data-source-uploads/"+id, f.admin).Expect(t, http.StatusNoContent)
			return f.complete(id, nil)
		}, http.StatusConflict, "upload_closed"},
		{"wrong checksum", func(id string) testkit.Response {
			f.patch(id, 0, data).Expect(t, http.StatusOK)
			return f.complete(id, map[string]any{"sha256": sources.Sum([]byte("other"))})
		}, http.StatusConflict, "checksum_mismatch"},
		{"wrong media type", func(id string) testkit.Response {
			return f.env.Do(testkit.Request{Method: http.MethodPatch, Path: "/data-source-uploads/" + id, As: f.admin,
				RawBody: data, Type: "text/plain", Header: http.Header{"Upload-Offset": {"0"}}})
		}, http.StatusUnsupportedMediaType, "unsupported_media"},
		{"no offset header", func(id string) testkit.Response {
			return f.env.Do(testkit.Request{Method: http.MethodPatch, Path: "/data-source-uploads/" + id, As: f.admin,
				RawBody: data, Type: "application/octet-stream"})
		}, http.StatusUnprocessableEntity, "validation"},
	}
	for _, c := range cases {
		t.Run(c.name, func(t *testing.T) {
			id := outlineSession(f, len(data))
			answer := c.steps(id).Expect(t, c.status).Map(t)
			if answer["code"] != c.code {
				t.Fatal(answer)
			}
			f.env.Delete("/data-source-uploads/"+id, f.admin)
		})
	}
}

func TestUploadInPartsGivesAVersionInValidation(t *testing.T) {
	f := newFixture(t)
	data := randomBytes(t, sources.PartSize+100)
	session := f.create(sources.KindGermanyOutline, map[string]any{"fileName": "DE.GeoJSON", "sizeBytes": len(data), "activate": false},
		http.StatusCreated)
	if session["partSize"] != float64(sources.PartSize) || session["state"] != "open" || session["receivedBytes"] != 0.0 {
		t.Fatal(session)
	}
	id := session["id"].(string)
	first := f.patch(id, 0, data[:sources.PartSize]).Expect(t, http.StatusOK)
	if first.Header.Get("Upload-Offset") != strconv.Itoa(sources.PartSize) {
		t.Fatal(first.Header)
	}
	f.patch(id, sources.PartSize, data[sources.PartSize:]).Expect(t, http.StatusOK)
	status := f.env.Get("/data-source-uploads/"+id, f.admin).Expect(t, http.StatusOK).Map(t)
	if status["receivedBytes"] != float64(len(data)) {
		t.Fatal(status)
	}
	version := f.complete(id, map[string]any{"sha256": sources.Sum(data)}).Expect(t, http.StatusAccepted).Map(t)
	if version["state"] != "validating" || version["version"] != 1.0 || version["sha256"] != sources.Sum(data) ||
		version["origin"] != "upload" || version["fileName"] != "DE.GeoJSON" {
		t.Fatal(version)
	}
	f.m.Wait()
	done := f.version(sources.KindGermanyOutline, version["id"].(string))
	if done["state"] != "failed" || done["error"].(map[string]any)["code"] != "geojson" {
		t.Fatal(done)
	}
	stored, err := os.ReadFile(f.m.Abs("sources/germany-outline/v1/original.geojson"))
	if err != nil || !bytes.Equal(stored, data) {
		t.Fatal("the original file differs", err)
	}
	if _, err := os.Stat(f.m.Abs("uploads/" + id + ".part")); !os.IsNotExist(err) {
		t.Fatal("the part file stays", err)
	}
	closed := f.env.Get("/data-source-uploads/"+id, f.admin).Expect(t, http.StatusOK).Map(t)
	if closed["state"] != "complete" || closed["versionId"] != version["id"] {
		t.Fatal(closed)
	}
}

func TestOffsetConflictGivesTheCurrentOffset(t *testing.T) {
	f := newFixture(t)
	data := randomBytes(t, 300)
	id := outlineSession(f, len(data))
	f.patch(id, 0, data[:100]).Expect(t, http.StatusOK)
	again := f.patch(id, 0, data[:100]).Expect(t, http.StatusConflict)
	if again.Header.Get("Upload-Offset") != "100" || again.Map(t)["code"] != "offset_mismatch" {
		t.Fatal(again.Header, string(again.Body))
	}
	f.patch(id, 200, data[200:]).Expect(t, http.StatusConflict)
	f.patch(id, 100, data[100:]).Expect(t, http.StatusOK)
	f.complete(id, map[string]any{"sha256": sources.Sum(data)}).Expect(t, http.StatusAccepted)
}

// restarted gives a new module on the same database: it has no memory of
// the earlier module, as after a process restart.
func restarted(f *fixture) *sources.Module {
	m := sources.Restarted(f.m)
	f.t.Cleanup(m.Wait)
	return m
}

func directPatch(t *testing.T, m *sources.Module, id string, offset int64, part []byte) int {
	t.Helper()
	r := httptest.NewRequest(http.MethodPatch, "/api/data-source-uploads/"+id, bytes.NewReader(part))
	r.SetPathValue("id", id)
	r.Header.Set("Content-Type", "application/octet-stream")
	r.Header.Set("Upload-Offset", strconv.FormatInt(offset, 10))
	w := httptest.NewRecorder()
	m.AppendHandler().ServeHTTP(w, r)
	return w.Code
}

func TestUploadResumesAfterRestartWithTheStoredHash(t *testing.T) {
	f := newFixture(t)
	data := randomBytes(t, 5000)
	id := outlineSession(f, len(data))
	f.patch(id, 0, data[:2000]).Expect(t, http.StatusOK)
	stored := scalar[[]byte](f, "SELECT hash_state FROM data_source_upload WHERE id = ?", db.MustID(id))
	if len(stored) == 0 {
		t.Fatal("no hash state")
	}
	// A crash after a partial write leaves bytes that the row does not count.
	part, err := os.OpenFile(f.m.Abs("uploads/"+id+".part"), os.O_APPEND|os.O_WRONLY, 0)
	if err != nil {
		t.Fatal(err)
	}
	if _, err := part.Write([]byte("garbage of an interrupted part")); err != nil {
		t.Fatal(err)
	}
	if err := part.Close(); err != nil {
		t.Fatal(err)
	}
	m := restarted(f)
	if code := directPatch(t, m, id, 2000, data[2000:]); code != http.StatusOK {
		t.Fatal(code)
	}
	r := httptest.NewRequest(http.MethodPost, "/api/data-source-uploads/"+id+"/complete",
		bytes.NewReader([]byte(`{"sha256":"`+sources.Sum(data)+`"}`)))
	r.SetPathValue("id", id)
	w := httptest.NewRecorder()
	m.CompleteHandler().ServeHTTP(w, r)
	if w.Code != http.StatusAccepted {
		t.Fatal(w.Code, w.Body.String())
	}
	m.Wait()
	original, err := os.ReadFile(f.m.Abs("sources/germany-outline/v1/original.geojson"))
	if err != nil || !bytes.Equal(original, data) {
		t.Fatal("the original file differs", err)
	}
}

func TestSizeAndExtensionLimits(t *testing.T) {
	f := newFixture(t)
	spec, _ := sources.SpecOf(sources.KindModelBundle)
	big := f.create(sources.KindModelBundle, map[string]any{"fileName": "m.zip", "sizeBytes": spec.MaxBytes + 1},
		http.StatusRequestEntityTooLarge)
	if big["code"] != "too_large" {
		t.Fatal(big)
	}
	wrong := f.create(sources.KindTreesGrid, map[string]any{"fileName": "grid.csv", "sizeBytes": 10}, http.StatusUnprocessableEntity)
	if wrong["errors"].([]any)[0].(map[string]any)["code"] != "extension" {
		t.Fatal(wrong)
	}
	species := f.create(sources.KindTreesGrid, map[string]any{"fileName": "grid.parquet", "sizeBytes": 10,
		"speciesId": db.NewID().String()}, http.StatusUnprocessableEntity)
	if species["errors"].([]any)[0].(map[string]any)["code"] != "not_allowed" {
		t.Fatal(species)
	}
	unknown := f.create(sources.KindModelBundle, map[string]any{"fileName": "m.zip", "sizeBytes": 10,
		"speciesId": db.NewID().String()}, http.StatusUnprocessableEntity)
	if unknown["errors"].([]any)[0].(map[string]any)["code"] != "unknown" {
		t.Fatal(unknown)
	}
	f.create("no-such-kind", map[string]any{"fileName": "m.zip", "sizeBytes": 10}, http.StatusUnprocessableEntity)
}

func TestPartLargerThanPartSizeIsRefused(t *testing.T) {
	f := newFixture(t)
	data := randomBytes(t, sources.PartSize+1)
	id := outlineSession(f, len(data))
	f.patch(id, 0, data).Expect(t, http.StatusRequestEntityTooLarge)
	if n := scalar[int64](f, "SELECT received_bytes FROM data_source_upload WHERE id = ?", db.MustID(id)); n != 0 {
		t.Fatal(n)
	}
	info, err := os.Stat(f.m.Abs("uploads/" + id + ".part"))
	if err != nil || info.Size() != 0 {
		t.Fatal("the part file keeps the refused bytes", err)
	}
}

func TestDiskGuardRefusesAnUploadWithoutSpace(t *testing.T) {
	f := newFixture(t)
	size := int64(10 << 20)
	f.m.SetFree(func(string) (uint64, error) { return sources.NeedDisk(size) - 1, nil })
	full := f.create(sources.KindTreesGrid, map[string]any{"fileName": "g.parquet", "sizeBytes": size}, http.StatusInsufficientStorage)
	if full["code"] != "disk_full" {
		t.Fatal(full)
	}
	f.m.SetFree(func(string) (uint64, error) { return sources.NeedDisk(size), nil })
	f.create(sources.KindTreesGrid, map[string]any{"fileName": "g.parquet", "sizeBytes": size}, http.StatusCreated)
}

func TestSecondOpenUploadOfAKindIsAConflict(t *testing.T) {
	f := newFixture(t)
	first := outlineSession(f, 10)
	again := f.create(sources.KindGermanyOutline, map[string]any{"fileName": "de.geojson", "sizeBytes": 10}, http.StatusConflict)
	if again["code"] != "upload_open" {
		t.Fatal(again)
	}
	detail := f.env.Get("/data-sources/germany-outline", f.admin).Expect(t, http.StatusOK).Map(t)
	if detail["openUpload"].(map[string]any)["id"] != first {
		t.Fatal(detail)
	}
	f.env.Delete("/data-source-uploads/"+first, f.admin).Expect(t, http.StatusNoContent)
	f.env.Delete("/data-source-uploads/"+first, f.admin).Expect(t, http.StatusNoContent)
	outlineSession(f, 10)
}

func TestSweepEndsExpiredSessions(t *testing.T) {
	f := newFixture(t)
	id := outlineSession(f, 10)
	f.exec("UPDATE data_source_upload SET expires_at = ? WHERE id = ?", db.At(time.Now().Add(-time.Minute)), db.MustID(id))
	shown := f.env.Get("/data-source-uploads/"+id, f.admin).Expect(t, http.StatusOK).Map(t)
	if shown["state"] != "expired" {
		t.Fatal(shown)
	}
	n, err := f.m.Sweep(t.Context())
	if err != nil || n != 1 {
		t.Fatal(n, err)
	}
	if state := scalar[string](f, "SELECT state FROM data_source_upload WHERE id = ?", db.MustID(id)); state != "expired" {
		t.Fatal(state)
	}
	if _, err := os.Stat(f.m.Abs("uploads/" + id + ".part")); !os.IsNotExist(err) {
		t.Fatal("the part file stays", err)
	}
	f.patch(id, 0, []byte("0123456789")).Expect(t, http.StatusConflict)
	outlineSession(f, 10)
}

func TestEndpointsNeedDataManage(t *testing.T) {
	f := newFixture(t)
	someone := testkit.Ptr(testkit.Someone("someone"))
	id := db.NewID().String()
	requests := []testkit.Request{
		{Method: http.MethodGet, Path: "/data-sources"},
		{Method: http.MethodGet, Path: "/data-sources/trees-grid"},
		{Method: http.MethodPost, Path: "/data-sources/trees-grid/uploads", Body: map[string]any{"fileName": "a.parquet", "sizeBytes": 1}},
		{Method: http.MethodGet, Path: "/data-source-uploads/" + id},
		{Method: http.MethodDelete, Path: "/data-source-uploads/" + id},
		{Method: http.MethodPost, Path: "/data-source-uploads/" + id + "/complete"},
		{Method: http.MethodGet, Path: "/data-sources/trees-grid/versions/" + id},
		{Method: http.MethodDelete, Path: "/data-sources/trees-grid/versions/" + id},
		{Method: http.MethodPost, Path: "/data-sources/trees-grid/versions/" + id + "/activate"},
		{Method: http.MethodPost, Path: "/data-sources/trees-grid/versions/" + id + "/reprocess"},
		{Method: http.MethodGet, Path: "/data-sources/trees-grid/versions/" + id + "/log"},
		{Method: http.MethodGet, Path: "/remote-sources"},
		{Method: http.MethodPost, Path: "/remote-sources/dwd-hyras/refresh"},
	}
	for _, r := range requests {
		r.As = someone
		f.env.Do(r).Expect(t, http.StatusForbidden)
		r.As = nil
		f.env.Do(r).Expect(t, http.StatusUnauthorized)
	}
	f.env.Do(testkit.Request{Method: http.MethodPatch, Path: "/data-source-uploads/" + id, As: someone,
		RawBody: []byte("x"), Type: "application/octet-stream", Header: http.Header{"Upload-Offset": {"0"}}}).
		Expect(t, http.StatusForbidden)
	f.env.Get("/data-sources", f.admin).Expect(t, http.StatusOK)
}
