package auth_test

import (
	"bytes"
	"context"
	"crypto/rand"
	"crypto/rsa"
	"encoding/base64"
	"encoding/json"
	"errors"
	"io"
	"math/big"
	"net/http"
	"slices"
	"strings"
	"sync"
	"testing"
	"time"

	"github.com/golang-jwt/jwt/v5"

	"github.com/frederikbeimgraben/kinoko/backend/internal/core/auth"
	"github.com/frederikbeimgraben/kinoko/backend/internal/core/db"
	"github.com/frederikbeimgraben/kinoko/backend/internal/core/problem"
	"github.com/frederikbeimgraben/kinoko/backend/internal/fn"
	"github.com/frederikbeimgraben/kinoko/backend/internal/testkit"
)

const (
	issuerURL = "https://issuer.test/application/o/pilze/"
	clientID  = "pilze"
	kid       = "schluessel-1"
)

// fakeIssuer is an issuer that the test controls. It logs each call.
type fakeIssuer struct {
	key             *rsa.PrivateKey
	kid             string
	mu              sync.Mutex
	calls           []string
	groups          []string
	userinfoStatus  int
	discoveryStatus int
}

func newFakeIssuer(t testing.TB) *fakeIssuer {
	t.Helper()
	key, err := rsa.GenerateKey(rand.Reader, 2048)
	if err != nil {
		t.Fatal(err)
	}
	return &fakeIssuer{key: key, kid: kid, groups: []string{}, userinfoStatus: http.StatusOK, discoveryStatus: http.StatusOK}
}

func (f *fakeIssuer) token(t testing.TB, claims jwt.MapClaims) string {
	t.Helper()
	payload := jwt.MapClaims{
		"iss": issuerURL, "aud": clientID, "sub": "person-1",
		"email": "pilz@example.test", "name": "Pilzsammlerin", "exp": 4102444800,
	}
	for name, value := range claims {
		payload[name] = value
	}
	token := jwt.NewWithClaims(jwt.SigningMethodRS256, payload)
	token.Header["kid"] = f.kid
	signed, err := token.SignedString(f.key)
	if err != nil {
		t.Fatal(err)
	}
	return signed
}

func (f *fakeIssuer) callCount(suffix string) int {
	f.mu.Lock()
	defer f.mu.Unlock()
	return len(fn.Filter(f.calls, func(c string) bool { return strings.HasSuffix(c, suffix) }))
}

func (f *fakeIssuer) RoundTrip(r *http.Request) (*http.Response, error) {
	f.mu.Lock()
	url := r.URL.String()
	f.calls = append(f.calls, url)
	f.mu.Unlock()
	status, body := http.StatusOK, any(nil)
	switch {
	case strings.HasSuffix(url, ".well-known/openid-configuration"):
		status = f.discoveryStatus
		body = map[string]any{"issuer": issuerURL, "jwks_uri": issuerURL + "jwks/", "userinfo_endpoint": issuerURL + "userinfo/"}
	case strings.HasSuffix(url, "userinfo/"):
		status = f.userinfoStatus
		body = map[string]any{"groups": f.groups}
	default:
		body = map[string]any{"keys": []any{map[string]any{
			"kid": f.kid, "kty": "RSA", "alg": "RS256", "use": "sig",
			"n": base64.RawURLEncoding.EncodeToString(f.key.N.Bytes()),
			"e": base64.RawURLEncoding.EncodeToString(big.NewInt(int64(f.key.E)).Bytes()),
		}, map[string]any{"kty": "oct"}}}
	}
	encoded, _ := json.Marshal(body)
	return &http.Response{StatusCode: status, Header: http.Header{"Content-Type": {"application/json"}},
		Body: io.NopCloser(bytes.NewReader(encoded)), Request: r}, nil
}

func (f *fakeIssuer) issuer() *auth.Issuer {
	return auth.NewIssuer(&http.Client{Transport: f}, issuerURL+".well-known/openid-configuration", issuerURL+"jwks/")
}

// setup gives a seeded database and an authenticator that uses the fake issuer.
func setup(t testing.TB) (*testkit.Env, *fakeIssuer, *auth.Authenticator) {
	t.Helper()
	env := testkit.New(t)
	fake := newFakeIssuer(t)
	authenticator := auth.New(auth.Config{Issuer: issuerURL, ClientID: clientID, AdminGroup: testkit.AdminGroup}, fake.issuer(), env.DB)
	return env, fake, authenticator
}

func status(err error) int {
	var p *problem.Problem
	if errors.As(err, &p) {
		return p.Status
	}
	return 0
}

func exec(t testing.TB, env *testkit.Env, query string, args ...any) {
	t.Helper()
	if _, err := env.DB.ExecContext(context.Background(), query, args...); err != nil {
		t.Fatal(err)
	}
}

func makeUser(t testing.TB, env *testkit.Env, sub string) db.ID {
	t.Helper()
	id := db.NewID()
	exec(t, env, "INSERT INTO user (id, sub, email, name, created_at) VALUES (?, ?, ?, ?, ?)",
		id, sub, sub+"@example.test", sub, db.Now())
	return id
}

// grantLocalRole gives the person a new role with the permission text.edit.
func grantLocalRole(t testing.TB, env *testkit.Env, user db.ID, slug string) {
	t.Helper()
	role := db.NewID()
	now := db.Now()
	exec(t, env, "INSERT INTO role (id, slug, name, built_in, created_at, updated_at) VALUES (?, ?, ?, 0, ?, ?)",
		role, slug, slug, now, now)
	exec(t, env, "INSERT INTO role_permission (role_id, permission_key) VALUES (?, 'text.edit')", role)
	exec(t, env, "INSERT INTO user_role (user_id, role_id, granted_at) VALUES (?, ?, ?)", user, role, now)
}

func rights(v auth.Viewer) []string { return fn.SortedKeys(v.Rights) }

func TestBearerReadsTheHeader(t *testing.T) {
	cases := map[string]string{"Bearer abc": "abc", "Basic abc": "", "": "", "Bearer  ": ""}
	for header, want := range cases {
		if got := auth.Bearer(header); got != want {
			t.Errorf("%q gives %q", header, got)
		}
	}
}

func TestTokenSignsIn(t *testing.T) {
	_, fake, authenticator := setup(t)
	viewer, err := authenticator.ViewerOf(context.Background(), "Bearer "+fake.token(t, nil))
	if err != nil || viewer.Sub() != "person-1" {
		t.Fatal(viewer, err)
	}
	if fake.callCount("jwks/") == 0 {
		t.Fatal(fake.calls)
	}
	env := testkit.New(t)
	env.Get("/permissions", testkit.Ptr(testkit.Someone("person-1"))).Expect(t, http.StatusForbidden)
}

func TestBrokenTokenIsUnauthorized(t *testing.T) {
	env, _, authenticator := setup(t)
	ctx := context.Background()
	if _, err := authenticator.ViewerOf(ctx, "Bearer kaputt"); status(err) != http.StatusUnauthorized {
		t.Fatal(err)
	}
	other := newFakeIssuer(t)
	if _, err := authenticator.ViewerOf(ctx, "Bearer "+other.token(t, jwt.MapClaims{"sub": "x"})); status(err) != http.StatusUnauthorized {
		t.Fatal(err)
	}
	env.Do(testkit.Request{Method: http.MethodGet, Path: "/permissions", Header: http.Header{"Authorization": {"Bearer kaputt"}}}).
		Expect(t, http.StatusUnauthorized)
}

func TestASmallClockDifferenceIsTolerated(t *testing.T) {
	_, fake, authenticator := setup(t)
	token := fake.token(t, jwt.MapClaims{"exp": time.Now().Unix() - 5})
	if _, err := authenticator.ViewerOf(context.Background(), "Bearer "+token); err != nil {
		t.Fatal(err)
	}
}

func TestALongExpiredTokenIsUnauthorized(t *testing.T) {
	_, fake, authenticator := setup(t)
	token := fake.token(t, jwt.MapClaims{"exp": time.Now().Unix() - 600})
	if _, err := authenticator.ViewerOf(context.Background(), "Bearer "+token); status(err) != http.StatusUnauthorized {
		t.Fatal(err)
	}
}

func TestTokenWithoutKidIsUnauthorized(t *testing.T) {
	_, fake, authenticator := setup(t)
	naked := jwt.NewWithClaims(jwt.SigningMethodRS256, jwt.MapClaims{"sub": "x", "aud": clientID, "iss": issuerURL, "exp": 4102444800})
	signed, err := naked.SignedString(fake.key)
	if err != nil {
		t.Fatal(err)
	}
	if _, err := authenticator.ViewerOf(context.Background(), "Bearer "+signed); status(err) != http.StatusUnauthorized {
		t.Fatal(err)
	}
}

func TestUnknownKidIsRemembered(t *testing.T) {
	fake := newFakeIssuer(t)
	issuer := fake.issuer()
	ctx := context.Background()
	if key, err := issuer.Key(ctx, "gibt-es-nicht"); key != nil || err != nil {
		t.Fatal(key, err)
	}
	before := len(fake.calls)
	if key, _ := issuer.Key(ctx, "gibt-es-nicht"); key != nil {
		t.Fatal(key)
	}
	if len(fake.calls) != before {
		t.Fatal(fake.calls)
	}
	if key, err := issuer.Key(ctx, kid); key == nil || err != nil {
		t.Fatal(key, err)
	}
}

func TestJWKSURLFallsBack(t *testing.T) {
	fake := newFakeIssuer(t)
	fake.discoveryStatus = http.StatusNotFound
	if key, err := fake.issuer().Key(context.Background(), kid); key == nil || err != nil {
		t.Fatal(key, err)
	}
	if !slices.Contains(fake.calls, issuerURL+"jwks/") {
		t.Fatal(fake.calls)
	}
}

func TestGroupsFromClaimsSkipUserinfo(t *testing.T) {
	fake := newFakeIssuer(t)
	groups := fake.issuer().Groups(context.Background(), "token", map[string]any{"groups": []any{testkit.AdminGroup}})
	if !slices.Equal(groups, []any{testkit.AdminGroup}) || len(fake.calls) != 0 {
		t.Fatal(groups, fake.calls)
	}
}

func TestGroupsFromUserinfoGrantAdminRights(t *testing.T) {
	env, fake, authenticator := setup(t)
	fake.groups = []string{testkit.AdminGroup}
	makeUser(t, env, "person-3")
	viewer, err := authenticator.ViewerOf(context.Background(), "Bearer "+fake.token(t, jwt.MapClaims{"sub": "person-3"}))
	if err != nil || !viewer.May("role.manage") {
		t.Fatal(viewer, err)
	}
	if fake.callCount("userinfo/") == 0 {
		t.Fatal(fake.calls)
	}
}

func TestGroupsCachePreventsASecondUserinfoCall(t *testing.T) {
	env, fake, authenticator := setup(t)
	fake.groups = []string{testkit.AdminGroup}
	makeUser(t, env, "person-4")
	token := "Bearer " + fake.token(t, jwt.MapClaims{"sub": "person-4", "jti": "tok-1"})
	first, err := authenticator.ViewerOf(context.Background(), token)
	if err != nil {
		t.Fatal(err)
	}
	before := fake.callCount("userinfo/")
	second, err := authenticator.ViewerOf(context.Background(), token)
	if err != nil {
		t.Fatal(err)
	}
	if !slices.Equal(rights(first), rights(second)) || fake.callCount("userinfo/") != before {
		t.Fatal(rights(first), rights(second), fake.calls)
	}
}

func TestUserinfoFailureGrantsOnlyTheBaseRoleRights(t *testing.T) {
	env, fake, authenticator := setup(t)
	fake.groups = []string{testkit.AdminGroup}
	fake.userinfoStatus = http.StatusInternalServerError
	makeUser(t, env, "person-5")
	viewer, err := authenticator.ViewerOf(context.Background(), "Bearer "+fake.token(t, jwt.MapClaims{"sub": "person-5"}))
	if err != nil || !slices.Equal(rights(viewer), []string{"image.submit"}) {
		t.Fatal(rights(viewer), err)
	}
}

func TestAdminGroupGrantsEveryRight(t *testing.T) {
	env, fake, authenticator := setup(t)
	makeUser(t, env, "admin-1")
	token := fake.token(t, jwt.MapClaims{"sub": "admin-1", "groups": []string{testkit.AdminGroup}})
	viewer, err := authenticator.ViewerOf(context.Background(), "Bearer "+token)
	if err != nil || !viewer.May("role.manage") || !viewer.May("species.edit") {
		t.Fatal(rights(viewer), err)
	}
}

func TestMyPermissionsEndpointGrantsEveryRightToTheAdminGroup(t *testing.T) {
	env := testkit.New(t)
	answer := env.Get("/me/permissions", testkit.Ptr(testkit.Admin())).Expect(t, http.StatusOK)
	expected := `{"permissions":["data.manage","find.review","group.manage","image.review","image.submit","role.assign",` +
		`"role.manage","run.manage","species.edit","text.edit"]}`
	if string(answer.Body) != expected {
		t.Fatalf("%s", answer.Body)
	}
}

func TestMyPermissionsEndpointKeepsOnlyRoleRightsWithoutTheGroup(t *testing.T) {
	env := testkit.New(t)
	grantLocalRole(t, env, makeUser(t, env, "person-6"), "lokal-2")
	answer := env.Get("/me/permissions", testkit.Ptr(testkit.Someone("person-6"))).Expect(t, http.StatusOK)
	if string(answer.Body) != `{"permissions":["image.submit","text.edit"]}` {
		t.Fatalf("%s", answer.Body)
	}
}

func TestRightsComeFromTheRoles(t *testing.T) {
	env, fake, authenticator := setup(t)
	grantLocalRole(t, env, makeUser(t, env, "person-2"), "lokal")
	viewer, err := authenticator.ViewerOf(context.Background(), "Bearer "+fake.token(t, jwt.MapClaims{"sub": "person-2", "groups": []string{}}))
	if err != nil || !slices.Equal(rights(viewer), []string{"image.submit", "text.edit"}) {
		t.Fatal(rights(viewer), err)
	}
}

func TestEverySignedInAccountHoldsTheBaseRoleRights(t *testing.T) {
	env, fake, authenticator := setup(t)
	makeUser(t, env, "person-7")
	viewer, err := authenticator.ViewerOf(context.Background(), "Bearer "+fake.token(t, jwt.MapClaims{"sub": "person-7", "groups": []string{}}))
	if err != nil || !slices.Equal(rights(viewer), []string{"image.submit"}) {
		t.Fatal(rights(viewer), err)
	}
}

func TestViewerKnowsItsRights(t *testing.T) {
	empty := auth.Viewer{}
	if empty.SignedIn() || empty.May("text.edit") || empty.Owns(db.NewID()) {
		t.Fatal(empty)
	}
}

func TestEnsurePersonCreatesAndUpdates(t *testing.T) {
	env := testkit.New(t)
	ctx := context.Background()
	viewer := func(email, name string) auth.Viewer {
		return auth.Viewer{Claims: map[string]any{"sub": "neu", "email": email, "name": name}}
	}
	first, err := auth.EnsurePerson(ctx, env.DB, viewer("a@b.test", "A"))
	if err != nil {
		t.Fatal(err)
	}
	again, err := auth.EnsurePerson(ctx, env.DB, viewer("c@d.test", "C"))
	if err != nil || again.ID != first.ID || *again.Email != "c@d.test" {
		t.Fatal(again, err)
	}
	same, err := auth.EnsurePerson(ctx, env.DB, viewer("c@d.test", "C"))
	if err != nil || same.ID != first.ID {
		t.Fatal(same, err)
	}
	stored, found, err := auth.PersonOf(ctx, env.DB, "neu")
	if err != nil || !found || *stored.Name != "C" {
		t.Fatal(stored, err)
	}
}

func TestViewerDoesNotWrite(t *testing.T) {
	env, fake, authenticator := setup(t)
	ctx := context.Background()
	if _, found, err := auth.PersonOf(ctx, env.DB, "gibt-es-nicht"); found || err != nil {
		t.Fatal(found, err)
	}
	viewer, err := authenticator.ViewerOf(ctx, "Bearer "+fake.token(t, jwt.MapClaims{"sub": "gibt-es-nicht", "groups": []string{}}))
	if err != nil || viewer.SignedIn() || len(viewer.Rights) != 0 {
		t.Fatal(viewer, err)
	}
	if _, found, _ := auth.PersonOf(ctx, env.DB, "gibt-es-nicht"); found {
		t.Fatal("the viewer wrote a person row")
	}
}
