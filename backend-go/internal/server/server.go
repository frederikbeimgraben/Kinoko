// Package server builds the HTTP service from the modules.
package server

import (
	"context"
	"database/sql"
	"io/fs"
	"log/slog"
	"net/http"
	"runtime/debug"
	"strings"
	"time"

	"github.com/frederikbeimgraben/kinoko/backend/internal/core/auth"
	"github.com/frederikbeimgraben/kinoko/backend/internal/core/config"
	"github.com/frederikbeimgraben/kinoko/backend/internal/core/contract"
	"github.com/frederikbeimgraben/kinoko/backend/internal/core/problem"
	"github.com/frederikbeimgraben/kinoko/backend/internal/core/web"
)

// Deps are the shared values that each module gets.
type Deps struct {
	DB       *sql.DB
	Settings config.Settings
	Auth     *auth.Authenticator
	Data     fs.FS
	Now      func() time.Time
	Log      *slog.Logger
}

// Module is one part of the API.
type Module interface {
	// Routes adds the endpoints of the module.
	Routes(r *Router)
}

// Starter is a module that has work to do before the service accepts requests.
type Starter interface {
	Start(ctx context.Context) error
}

// Router adds endpoints under the API prefix.
type Router struct {
	mux      *http.ServeMux
	patterns []string
}

// Handle adds an endpoint. The path is relative to the API prefix, for
// example Handle("GET", "/species/{slug}", h).
func (r *Router) Handle(method, path string, h web.Handler) {
	r.mux.Handle(method+" "+contract.Prefix+path, h)
	r.patterns = append(r.patterns, method+" "+path)
}

// Routes gives each "METHOD /path" that the modules add. The contract test uses it.
func Routes(modules []Module) []string {
	router := &Router{mux: http.NewServeMux()}
	for _, m := range modules {
		m.Routes(router)
	}
	return router.patterns
}

// Build makes the handler of the service.
func Build(settings config.Settings, c *contract.Contract, authenticator *auth.Authenticator, modules []Module) http.Handler {
	router := &Router{mux: http.NewServeMux()}
	for _, m := range modules {
		m.Routes(router)
	}
	router.mux.Handle(contract.Prefix+"/", web.Handler(func(*http.Request) (web.Response, error) {
		return nil, problem.NotFound()
	}))
	var handler http.Handler = router.mux
	handler = c.Middleware(handler)
	handler = authenticator.Middleware(handler)
	handler = cors(settings.Origin, handler)
	handler = recoverPanics(handler)
	return handler
}

// Start runs the start work of each module, in order.
func Start(ctx context.Context, modules []Module) error {
	for _, m := range modules {
		if starter, ok := m.(Starter); ok {
			if err := starter.Start(ctx); err != nil {
				return err
			}
		}
	}
	return nil
}

func cors(origin string, next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.Header.Get("Origin") == origin {
			h := w.Header()
			h.Set("Access-Control-Allow-Origin", origin)
			h.Set("Access-Control-Allow-Credentials", "true")
			h.Add("Vary", "Origin")
			if r.Method == http.MethodOptions && r.Header.Get("Access-Control-Request-Method") != "" {
				h.Set("Access-Control-Allow-Methods", "DELETE, GET, HEAD, OPTIONS, PATCH, POST, PUT")
				if requested := r.Header.Get("Access-Control-Request-Headers"); requested != "" {
					h.Set("Access-Control-Allow-Headers", requested)
				}
				h.Set("Access-Control-Max-Age", "600")
				w.WriteHeader(http.StatusOK)
				return
			}
		}
		next.ServeHTTP(w, r)
	})
}

func recoverPanics(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		defer func() {
			if failure := recover(); failure != nil {
				slog.Error("panic", "path", r.URL.Path, "value", failure, "stack", string(debug.Stack()))
				problem.Write(w, problem.Internal())
			}
		}()
		next.ServeHTTP(w, r)
	})
}

// Internal tells if the request comes straight to the port of the host and
// not through the proxy. The training finds hold exact places.
func Internal(r *http.Request) bool {
	if r.Header.Get("X-Forwarded-For") != "" || r.Header.Get("Forwarded") != "" {
		return false
	}
	host := r.RemoteAddr
	if i := strings.LastIndex(host, ":"); i >= 0 {
		host = host[:i]
	}
	host = strings.Trim(host, "[]")
	return host == "127.0.0.1" || host == "::1" || host == "localhost"
}
