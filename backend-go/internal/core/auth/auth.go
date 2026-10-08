// Package auth finds the person of a request and the permissions of that
// person. A request without a token has a viewer without a person.
package auth

import (
	"context"
	"database/sql"
	"net/http"
	"slices"
	"strings"
	"time"

	"github.com/golang-jwt/jwt/v5"

	"github.com/frederikbeimgraben/kinoko/backend/internal/core/db"
	"github.com/frederikbeimgraben/kinoko/backend/internal/core/problem"
	"github.com/frederikbeimgraben/kinoko/backend/internal/fn"
)

// BaseRole is the role that each signed-in person has.
const BaseRole = "user"

// clockTolerance accepts tokens near the edge of their time. The clocks of
// issuer and server are not equal.
const clockTolerance = 60 * time.Second

// User is a row of the table user.
type User struct {
	ID        db.ID
	Sub       string
	Email     *string
	Name      *string
	CreatedAt db.Time
}

// Viewer is the person of a request, the permissions and the token claims.
type Viewer struct {
	User   *User
	Rights map[string]struct{}
	Claims map[string]any
}

// Sub is the key of the person at the issuer.
func (v Viewer) Sub() string {
	sub, _ := v.Claims["sub"].(string)
	return sub
}

// SignedIn tells if a person row exists for the request.
func (v Viewer) SignedIn() bool { return v.User != nil }

// May tells if the viewer has the permission.
func (v Viewer) May(permission string) bool {
	_, ok := v.Rights[permission]
	return ok
}

// Owns tells if the viewer is the owner.
func (v Viewer) Owns(owner db.ID) bool { return v.User != nil && v.User.ID == owner }

// Claim gives a text claim, or nil.
func (v Viewer) Claim(name string) *string {
	value, ok := v.Claims[name].(string)
	if !ok {
		return nil
	}
	return &value
}

// Config is what the authenticator needs.
type Config struct {
	Issuer     string
	ClientID   string
	AdminGroup string
}

// Authenticator checks tokens and reads persons and permissions.
type Authenticator struct {
	cfg    Config
	keys   *Issuer
	handle *sql.DB
}

// New makes an authenticator.
func New(cfg Config, keys *Issuer, handle *sql.DB) *Authenticator {
	return &Authenticator{cfg: cfg, keys: keys, handle: handle}
}

type viewerKey struct{}

// Middleware puts the viewer of each request into its context.
// A request with a token that is not valid gets 401.
func (a *Authenticator) Middleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		viewer, err := a.ViewerOf(r.Context(), r.Header.Get("Authorization"))
		if err != nil {
			problem.Write(w, err)
			return
		}
		next.ServeHTTP(w, r.WithContext(context.WithValue(r.Context(), viewerKey{}, viewer)))
	})
}

// From gives the viewer of the request.
func From(r *http.Request) Viewer {
	viewer, ok := r.Context().Value(viewerKey{}).(Viewer)
	if !ok {
		return Viewer{Rights: map[string]struct{}{}, Claims: map[string]any{}}
	}
	return viewer
}

// WithViewer gives a context that holds the viewer. Tests use it.
func WithViewer(ctx context.Context, viewer Viewer) context.Context {
	return context.WithValue(ctx, viewerKey{}, viewer)
}

func bearer(header string) string {
	token, ok := strings.CutPrefix(header, "Bearer ")
	if !ok {
		return ""
	}
	return strings.TrimSpace(token)
}

// ViewerOf reads the viewer from the Authorization header.
func (a *Authenticator) ViewerOf(ctx context.Context, header string) (Viewer, error) {
	anonymous := Viewer{Rights: map[string]struct{}{}, Claims: map[string]any{}}
	token := bearer(header)
	if token == "" {
		return anonymous, nil
	}
	claims, err := a.claimsOf(ctx, token)
	if err != nil {
		return anonymous, err
	}
	viewer := Viewer{Claims: claims}
	if viewer.Sub() == "" {
		return anonymous, problem.Unauthorized()
	}
	user, found, err := PersonOf(ctx, a.handle, viewer.Sub())
	if err != nil {
		return anonymous, err
	}
	if found {
		viewer.User = &user
	}
	rights, err := a.rightsOf(ctx, viewer.User, a.keys.Groups(ctx, token, claims))
	if err != nil {
		return anonymous, err
	}
	viewer.Rights = rights
	return viewer, nil
}

func (a *Authenticator) claimsOf(ctx context.Context, token string) (map[string]any, error) {
	parser := jwt.NewParser(
		jwt.WithValidMethods([]string{"RS256", "ES256"}),
		jwt.WithAudience(a.cfg.ClientID),
		jwt.WithIssuer(a.cfg.Issuer),
		jwt.WithLeeway(clockTolerance),
		jwt.WithExpirationRequired(),
	)
	claims := jwt.MapClaims{}
	_, err := parser.ParseWithClaims(token, claims, func(t *jwt.Token) (any, error) {
		kid, ok := t.Header["kid"].(string)
		if !ok {
			return nil, jwt.ErrTokenUnverifiable
		}
		key, err := a.keys.Key(ctx, kid)
		if err != nil || key == nil {
			return nil, jwt.ErrTokenUnverifiable
		}
		return key, nil
	})
	if err != nil {
		return nil, problem.Unauthorized()
	}
	return claims, nil
}

func (a *Authenticator) rightsOf(ctx context.Context, user *User, groups []any) (map[string]struct{}, error) {
	if slices.Contains(groups, any(a.cfg.AdminGroup)) {
		keys, err := db.Column[string](ctx, a.handle, `SELECT "key" FROM permission`)
		return fn.Set(keys), err
	}
	if user == nil {
		return map[string]struct{}{}, nil
	}
	keys, err := db.Column[string](ctx, a.handle, `
		SELECT DISTINCT rp.permission_key
		FROM role_permission rp JOIN role r ON r.id = rp.role_id
		WHERE r.id IN (SELECT role_id FROM user_role WHERE user_id = ?) OR r.slug = ?`,
		user.ID, BaseRole)
	return fn.Set(keys), err
}

// ScanUser reads a user row in the column order id, sub, email, name, created_at.
func ScanUser(s db.Scanner) (User, error) {
	var u User
	err := s.Scan(&u.ID, &u.Sub, &u.Email, &u.Name, &u.CreatedAt)
	return u, err
}

// PersonOf reads the person with the key sub, without creating it.
func PersonOf(ctx context.Context, q db.Querier, sub string) (User, bool, error) {
	return db.Maybe(ctx, q, ScanUser,
		"SELECT id, sub, email, name, created_at FROM user WHERE sub = ?", sub)
}

// EnsurePerson gives the person of the viewer. The first call creates the
// row; a later call updates email and name from the token.
func EnsurePerson(ctx context.Context, handle *sql.DB, viewer Viewer) (User, error) {
	if viewer.Sub() == "" {
		return User{}, problem.Unauthorized()
	}
	email, name := viewer.Claim("email"), viewer.Claim("name")
	return db.InTxValue(ctx, handle, func(tx *sql.Tx) (User, error) {
		found, ok, err := PersonOf(ctx, tx, viewer.Sub())
		if err != nil {
			return User{}, err
		}
		if ok && equal(found.Email, email) && equal(found.Name, name) {
			return found, nil
		}
		if !ok {
			found = User{ID: db.NewID(), Sub: viewer.Sub(), CreatedAt: db.Now()}
			if _, err := tx.ExecContext(ctx,
				"INSERT INTO user (id, sub, email, name, created_at) VALUES (?, ?, ?, ?, ?)",
				found.ID, found.Sub, email, name, found.CreatedAt); err != nil {
				return User{}, err
			}
		} else if _, err := tx.ExecContext(ctx,
			"UPDATE user SET email = ?, name = ? WHERE id = ?", email, name, found.ID); err != nil {
			return User{}, err
		}
		found.Email, found.Name = email, name
		return found, nil
	})
}

func equal(a, b *string) bool {
	if a == nil || b == nil {
		return a == b
	}
	return *a == *b
}

// RequireSignIn gives 401 when the request has no token subject.
func RequireSignIn(viewer Viewer) error {
	if viewer.Sub() == "" {
		return problem.Unauthorized()
	}
	return nil
}

// Require gives 401 without a token and 403 without the permission.
func Require(viewer Viewer, permission string) error {
	if err := RequireSignIn(viewer); err != nil {
		return err
	}
	if !viewer.May(permission) {
		return problem.Forbidden()
	}
	return nil
}
