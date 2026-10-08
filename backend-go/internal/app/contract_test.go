package app_test

import (
	"net/http"
	"slices"
	"strings"
	"testing"

	backend "github.com/frederikbeimgraben/kinoko/backend"
	"github.com/frederikbeimgraben/kinoko/backend/internal/core/contract"
	"github.com/frederikbeimgraben/kinoko/backend/internal/server"
	"github.com/frederikbeimgraben/kinoko/backend/internal/testkit"
)

func TestEachContractOperationHasARoute(t *testing.T) {
	env := testkit.New(t)
	parsed, err := contract.Load(backend.Contract)
	if err != nil {
		t.Fatal(err)
	}
	routes := server.Routes(env.Service.Modules)
	missing := []string{}
	for _, operation := range parsed.Operations() {
		if !slices.Contains(routes, operation) {
			missing = append(missing, operation)
		}
	}
	extra := []string{}
	for _, route := range routes {
		if !slices.Contains(parsed.Operations(), route) {
			extra = append(extra, route)
		}
	}
	if len(missing) > 0 {
		t.Errorf("operations without a route: %v", missing)
	}
	if len(extra) > 0 {
		t.Errorf("routes without an operation: %v", extra)
	}
}

func TestHealthAndProblems(t *testing.T) {
	env := testkit.New(t)
	env.Get("/health", nil).Expect(t, http.StatusOK)
	env.Do(testkit.Request{Method: http.MethodDelete, Path: "/health"}).Expect(t, http.StatusMethodNotAllowed)
	env.Get("/health?x=1", nil).Expect(t, http.StatusUnprocessableEntity)
	missing := env.Get("/nothing-here", nil).Expect(t, http.StatusNotFound)
	if missing.Header.Get("Content-Type") != "application/problem+json" {
		t.Fatal(missing.Header)
	}
}

func TestBodyRulesHoldForEveryMediaType(t *testing.T) {
	env := testkit.New(t)
	admin := testkit.Admin()
	long := strings.Repeat("x", 5000)
	for _, media := range []string{"text/plain", "Application/JSON", ""} {
		response := env.Do(testkit.Request{
			Method: http.MethodPut, Path: "/texts/error.notFound", As: &admin,
			RawBody: []byte(`{"locale":"de","value":"` + long + `"}`), Type: media,
		})
		if response.Status != http.StatusUnprocessableEntity {
			t.Errorf("media %q: status %d", media, response.Status)
		}
	}
}

func TestEncodedSlashDoesNotPassTheGuard(t *testing.T) {
	env := testkit.New(t)
	someone := testkit.Someone("plain")
	response := env.Do(testkit.Request{Method: http.MethodPut, Path: "/texts/a%2Fb", As: &someone,
		Body: map[string]string{"locale": "de", "value": "x"}})
	if response.Status != http.StatusForbidden && response.Status != http.StatusNotFound {
		t.Fatalf("status %d", response.Status)
	}
	if response.Status == http.StatusNotFound && response.Map(t)["code"] != "not_found" {
		t.Fatal(string(response.Body))
	}
}
