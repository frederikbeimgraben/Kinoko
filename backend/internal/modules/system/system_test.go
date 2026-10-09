package system_test

import (
	"net/http"
	"strings"
	"testing"

	"github.com/frederikbeimgraben/kinoko/backend/internal/core/config"
	"github.com/frederikbeimgraben/kinoko/backend/internal/testkit"
)

func TestHealth(t *testing.T) {
	env := testkit.New(t)
	answer := env.Get("/health", nil).Expect(t, http.StatusOK)
	if string(answer.Body) != `{"status":"ok"}` {
		t.Fatal(string(answer.Body))
	}
}

func TestConfig(t *testing.T) {
	env := testkit.New(t)
	answer := env.Get("/config", nil).Expect(t, http.StatusOK).Map(t)
	if answer["oidcClientId"] != "pilze" || answer["version"] != config.Version() ||
		answer["oidcIssuer"] != env.Settings.OIDCIssuer || answer["origin"] != env.Settings.Origin ||
		answer["oidcName"] != env.Settings.ProviderName() || answer["oidcName"] == "" {
		t.Fatal(answer)
	}
}

func TestUnknownPathIsAProblem(t *testing.T) {
	env := testkit.New(t)
	answer := env.Get("/nirgendwo", nil).Expect(t, http.StatusNotFound)
	if !strings.HasPrefix(answer.Header.Get("Content-Type"), "application/problem+json") {
		t.Fatal(answer.Header)
	}
	body := answer.Map(t)
	if body["code"] != "not_found" || body["title"] != "Nicht gefunden" {
		t.Fatal(body)
	}
}

func TestUnknownQueryParameterIsRejected(t *testing.T) {
	env := testkit.New(t)
	answer := env.Get("/texts?gibtEsNicht=1", nil).Expect(t, http.StatusUnprocessableEntity).Map(t)
	if answer["errors"].([]any)[0].(map[string]any)["field"] != "gibtEsNicht" {
		t.Fatal(answer)
	}
}

// The Python test uses /species. The bracket rule is the same for each path.
func TestABracketParameterPasses(t *testing.T) {
	env := testkit.New(t)
	env.Get("/health?colour%5Bcap%5D=%23ffffff", nil).Expect(t, http.StatusOK)
}

func TestAMethodOutsideTheContractIs405(t *testing.T) {
	env := testkit.New(t)
	answer := env.Put("/species/bundle", map[string]any{}, nil).Expect(t, http.StatusMethodNotAllowed)
	if answer.Header.Get("Allow") != "GET, HEAD" || answer.Map(t)["code"] != "method_not_allowed" {
		t.Fatal(answer.Header, string(answer.Body))
	}
}

func TestHeadOnAGetRoute(t *testing.T) {
	env := testkit.New(t)
	env.Do(testkit.Request{Method: http.MethodHead, Path: "/health"}).Expect(t, http.StatusOK)
	env.Do(testkit.Request{Method: http.MethodDelete, Path: "/health"}).Expect(t, http.StatusMethodNotAllowed)
}
