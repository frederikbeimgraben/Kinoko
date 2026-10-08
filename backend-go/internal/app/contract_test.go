package app_test

import (
	"net/http"
	"slices"
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
	env.Do(testkit.Request{Method: http.MethodGet, Path: "/me", Header: http.Header{"Authorization": {"Bearer broken"}}}).Expect(t, http.StatusUnauthorized)
}
