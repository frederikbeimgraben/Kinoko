package auth

import (
	"context"
	"crypto/ecdsa"
	"crypto/elliptic"
	"crypto/rsa"
	"crypto/sha256"
	"encoding/base64"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"math/big"
	"net/http"
	"sync"
	"time"
)

const (
	positiveTTL = time.Hour
	negativeTTL = time.Minute
	groupClaim  = "groups"
)

// Issuer reads the discovery document, the signing keys and the user
// information of the OpenID issuer. It keeps each answer for a time.
type Issuer struct {
	client       *http.Client
	discoveryURL string
	fallbackJWKS string
	now          func() time.Time

	mu         sync.Mutex
	discovery  map[string]any
	discovered time.Time
	keys       map[string]any
	loaded     time.Time
	unknown    map[string]time.Time
	groups     map[string]cachedGroups
}

type cachedGroups struct {
	groups  []any
	expires time.Time
}

// NewIssuer makes an issuer client.
func NewIssuer(client *http.Client, discoveryURL, fallbackJWKS string) *Issuer {
	return &Issuer{
		client:       client,
		discoveryURL: discoveryURL,
		fallbackJWKS: fallbackJWKS,
		now:          time.Now,
		unknown:      map[string]time.Time{},
		groups:       map[string]cachedGroups{},
	}
}

// Key gives the public key with the key id, or nil.
func (i *Issuer) Key(ctx context.Context, kid string) (any, error) {
	i.mu.Lock()
	defer i.mu.Unlock()
	at := i.now()
	if until, ok := i.unknown[kid]; ok && at.Before(until) {
		return nil, nil
	}
	fresh := len(i.keys) > 0 && at.Sub(i.loaded) < positiveTTL
	if fresh {
		if key, ok := i.keys[kid]; ok {
			return key, nil
		}
	} else {
		keys, err := i.fetchKeys(ctx)
		if err != nil {
			return nil, err
		}
		i.keys, i.loaded, i.unknown = keys, at, map[string]time.Time{}
	}
	if key, ok := i.keys[kid]; ok {
		return key, nil
	}
	i.unknown[kid] = at.Add(negativeTTL)
	return nil, nil
}

func (i *Issuer) document(ctx context.Context) map[string]any {
	at := i.now()
	if i.discovery != nil && at.Sub(i.discovered) < positiveTTL {
		return i.discovery
	}
	var doc map[string]any
	if err := i.getJSON(ctx, i.discoveryURL, "", &doc); err != nil {
		return map[string]any{}
	}
	i.discovery, i.discovered = doc, at
	return doc
}

func (i *Issuer) fetchKeys(ctx context.Context) (map[string]any, error) {
	url := i.fallbackJWKS
	if found, ok := i.document(ctx)["jwks_uri"].(string); ok {
		url = found
	}
	var set struct {
		Keys []jwk `json:"keys"`
	}
	if err := i.getJSON(ctx, url, "", &set); err != nil {
		return nil, err
	}
	out := map[string]any{}
	for _, entry := range set.Keys {
		if entry.Kid == "" {
			continue
		}
		key, err := entry.public()
		if err != nil {
			continue
		}
		out[entry.Kid] = key
	}
	return out, nil
}

// Groups gives the groups of the token: from the claims, else from userinfo.
func (i *Issuer) Groups(ctx context.Context, token string, claims map[string]any) []any {
	if found, ok := claims[groupClaim].([]any); ok {
		return found
	}
	key := tokenKey(token, claims)
	i.mu.Lock()
	defer i.mu.Unlock()
	at := i.now()
	if cached, ok := i.groups[key]; ok && at.Before(cached.expires) {
		return cached.groups
	}
	url, ok := i.document(ctx)["userinfo_endpoint"].(string)
	if !ok {
		return nil
	}
	var info map[string]any
	if err := i.getJSON(ctx, url, token, &info); err != nil {
		return nil
	}
	groups, ok := info[groupClaim].([]any)
	if !ok {
		return nil
	}
	expires := at.Add(positiveTTL)
	if exp, ok := claims["exp"].(float64); ok {
		expires = time.Unix(int64(exp), 0)
	}
	i.groups[key] = cachedGroups{groups: groups, expires: expires}
	return groups
}

func tokenKey(token string, claims map[string]any) string {
	if jti, ok := claims["jti"].(string); ok && jti != "" {
		return jti
	}
	sum := sha256.Sum256([]byte(token))
	return hex.EncodeToString(sum[:])
}

func (i *Issuer) getJSON(ctx context.Context, url, bearer string, target any) error {
	ctx, cancel := context.WithTimeout(ctx, 5*time.Second)
	defer cancel()
	request, err := http.NewRequestWithContext(ctx, http.MethodGet, url, nil)
	if err != nil {
		return err
	}
	if bearer != "" {
		request.Header.Set("Authorization", "Bearer "+bearer)
	}
	response, err := i.client.Do(request)
	if err != nil {
		return err
	}
	defer response.Body.Close()
	if response.StatusCode < 200 || response.StatusCode > 299 {
		return fmt.Errorf("GET %s: status %d", url, response.StatusCode)
	}
	return json.NewDecoder(response.Body).Decode(target)
}

type jwk struct {
	Kid string `json:"kid"`
	Kty string `json:"kty"`
	N   string `json:"n"`
	E   string `json:"e"`
	Crv string `json:"crv"`
	X   string `json:"x"`
	Y   string `json:"y"`
}

func (k jwk) public() (any, error) {
	switch k.Kty {
	case "RSA":
		n, err := bigOf(k.N)
		if err != nil {
			return nil, err
		}
		e, err := bigOf(k.E)
		if err != nil {
			return nil, err
		}
		return &rsa.PublicKey{N: n, E: int(e.Int64())}, nil
	case "EC":
		if k.Crv != "P-256" {
			return nil, fmt.Errorf("curve %s is not supported", k.Crv)
		}
		x, err := bigOf(k.X)
		if err != nil {
			return nil, err
		}
		y, err := bigOf(k.Y)
		if err != nil {
			return nil, err
		}
		return &ecdsa.PublicKey{Curve: elliptic.P256(), X: x, Y: y}, nil
	default:
		return nil, fmt.Errorf("key type %s is not supported", k.Kty)
	}
}

func bigOf(value string) (*big.Int, error) {
	raw, err := base64.RawURLEncoding.DecodeString(value)
	if err != nil {
		return nil, err
	}
	return new(big.Int).SetBytes(raw), nil
}
