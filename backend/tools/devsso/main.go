// Command devsso is an OpenID provider for local development only.
// It signs in a fixed test person without a password, so the app can be
// used signed in without Authentik. Do not expose it outside localhost.
//
// Usage: go run ./tools/devsso -listen 127.0.0.1:9000 -client pilze -admin
package main

import (
	"crypto/rand"
	"crypto/rsa"
	"encoding/base64"
	"encoding/json"
	"flag"
	"fmt"
	"log"
	"math/big"
	"net/http"
	"net/url"
	"sync"
	"time"

	"github.com/golang-jwt/jwt/v5"
)

const keyID = "devsso"

type grant struct {
	nonce string
}

type provider struct {
	issuer string
	client string
	person map[string]any
	key    *rsa.PrivateKey
	mu     sync.Mutex
	codes  map[string]grant
}

func main() {
	listen := flag.String("listen", "127.0.0.1:9000", "address of the provider")
	client := flag.String("client", "pilze", "client id, also the token audience")
	name := flag.String("name", "Test Person", "name of the test person")
	email := flag.String("email", "test@example.invalid", "email of the test person")
	sub := flag.String("sub", "devsso-test-person", "subject of the test person")
	admin := flag.Bool("admin", false, "put the test person into the admin group")
	adminGroup := flag.String("admin-group", "pilze-admins", "name of the admin group")
	flag.Parse()

	key, err := rsa.GenerateKey(rand.Reader, 2048)
	if err != nil {
		log.Fatal(err)
	}
	groups := []string{}
	if *admin {
		groups = append(groups, *adminGroup)
	}
	p := &provider{
		issuer: "http://" + *listen + "/",
		client: *client,
		person: map[string]any{"sub": *sub, "name": *name, "email": *email, "groups": groups},
		key:    key,
		codes:  map[string]grant{},
	}
	mux := http.NewServeMux()
	mux.HandleFunc("GET /.well-known/openid-configuration", p.discovery)
	mux.HandleFunc("GET /authorize", p.authorize)
	mux.HandleFunc("POST /token", p.token)
	mux.HandleFunc("GET /jwks", p.jwks)
	mux.HandleFunc("GET /userinfo", p.userinfo)
	log.Printf("devsso issuer %s, client %s, admin %v", p.issuer, p.client, *admin)
	server := &http.Server{Addr: *listen, Handler: cors(mux), ReadHeaderTimeout: 5 * time.Second}
	log.Fatal(server.ListenAndServe())
}

// cors lets the browser app call the token and key endpoints.
func cors(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Access-Control-Allow-Origin", "*")
		w.Header().Set("Access-Control-Allow-Headers", "*")
		if r.Method == http.MethodOptions {
			w.WriteHeader(http.StatusNoContent)
			return
		}
		next.ServeHTTP(w, r)
	})
}

func writeJSON(w http.ResponseWriter, value any) {
	w.Header().Set("Content-Type", "application/json")
	_ = json.NewEncoder(w).Encode(value)
}

func (p *provider) discovery(w http.ResponseWriter, _ *http.Request) {
	writeJSON(w, map[string]any{
		"issuer":                                p.issuer,
		"authorization_endpoint":                p.issuer + "authorize",
		"token_endpoint":                        p.issuer + "token",
		"jwks_uri":                              p.issuer + "jwks",
		"userinfo_endpoint":                     p.issuer + "userinfo",
		"response_types_supported":              []string{"code"},
		"subject_types_supported":               []string{"public"},
		"id_token_signing_alg_values_supported": []string{"RS256"},
		"code_challenge_methods_supported":      []string{"S256"},
	})
}

// authorize signs the test person in at once. A silent request gets the same answer.
func (p *provider) authorize(w http.ResponseWriter, r *http.Request) {
	q := r.URL.Query()
	back, err := url.Parse(q.Get("redirect_uri"))
	if err != nil || back.Hostname() != "localhost" && back.Hostname() != "127.0.0.1" {
		http.Error(w, "redirect_uri must be on localhost", http.StatusBadRequest)
		return
	}
	code := random()
	p.mu.Lock()
	p.codes[code] = grant{nonce: q.Get("nonce")}
	p.mu.Unlock()
	answer := back.Query()
	answer.Set("code", code)
	answer.Set("state", q.Get("state"))
	back.RawQuery = answer.Encode()
	http.Redirect(w, r, back.String(), http.StatusFound)
}

func (p *provider) token(w http.ResponseWriter, r *http.Request) {
	if err := r.ParseForm(); err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}
	nonce := ""
	if r.Form.Get("grant_type") == "authorization_code" {
		p.mu.Lock()
		found, ok := p.codes[r.Form.Get("code")]
		delete(p.codes, r.Form.Get("code"))
		p.mu.Unlock()
		if !ok {
			http.Error(w, `{"error":"invalid_grant"}`, http.StatusBadRequest)
			return
		}
		nonce = found.nonce
	}
	now := time.Now()
	claims := jwt.MapClaims{"iss": p.issuer, "aud": p.client, "iat": now.Unix(), "exp": now.Add(time.Hour).Unix()}
	for k, v := range p.person {
		claims[k] = v
	}
	if nonce != "" {
		claims["nonce"] = nonce
	}
	signed, err := p.sign(claims)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	writeJSON(w, map[string]any{
		"access_token":  signed,
		"id_token":      signed,
		"refresh_token": random(),
		"token_type":    "Bearer",
		"expires_in":    3600,
		"scope":         "openid email profile offline_access",
	})
}

func (p *provider) userinfo(w http.ResponseWriter, _ *http.Request) {
	writeJSON(w, p.person)
}

func (p *provider) jwks(w http.ResponseWriter, _ *http.Request) {
	pub := p.key.PublicKey
	writeJSON(w, map[string]any{"keys": []any{map[string]any{
		"kty": "RSA", "alg": "RS256", "use": "sig", "kid": keyID,
		"n": base64.RawURLEncoding.EncodeToString(pub.N.Bytes()),
		"e": base64.RawURLEncoding.EncodeToString(big.NewInt(int64(pub.E)).Bytes()),
	}}})
}

func (p *provider) sign(claims jwt.MapClaims) (string, error) {
	token := jwt.NewWithClaims(jwt.SigningMethodRS256, claims)
	token.Header["kid"] = keyID
	signed, err := token.SignedString(p.key)
	if err != nil {
		return "", fmt.Errorf("sign: %w", err)
	}
	return signed, nil
}

func random() string {
	b := make([]byte, 24)
	_, _ = rand.Read(b)
	return base64.RawURLEncoding.EncodeToString(b)
}
