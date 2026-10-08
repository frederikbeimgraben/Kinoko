// Package app lists the modules of the service and builds it.
package app

import (
	"context"
	"database/sql"
	"io/fs"
	"log/slog"
	"net/http"
	"os"
	"time"

	backend "github.com/frederikbeimgraben/kinoko/backend"
	"github.com/frederikbeimgraben/kinoko/backend/internal/core/auth"
	"github.com/frederikbeimgraben/kinoko/backend/internal/core/config"
	"github.com/frederikbeimgraben/kinoko/backend/internal/core/contract"
	"github.com/frederikbeimgraben/kinoko/backend/internal/core/db"
	"github.com/frederikbeimgraben/kinoko/backend/internal/modules/access"
	"github.com/frederikbeimgraben/kinoko/backend/internal/modules/catalog"
	"github.com/frederikbeimgraben/kinoko/backend/internal/modules/objects"
	"github.com/frederikbeimgraben/kinoko/backend/internal/modules/photos"
	"github.com/frederikbeimgraben/kinoko/backend/internal/modules/runs"
	"github.com/frederikbeimgraben/kinoko/backend/internal/modules/sources"
	"github.com/frederikbeimgraben/kinoko/backend/internal/modules/system"
	"github.com/frederikbeimgraben/kinoko/backend/internal/modules/texts"
	"github.com/frederikbeimgraben/kinoko/backend/internal/server"
)

// Modules makes each module of the service, in start order.
func Modules(deps server.Deps) []server.Module {
	runModule := runs.New(deps)
	return []server.Module{
		system.New(deps),
		texts.New(deps),
		access.New(deps),
		catalog.New(deps),
		objects.New(deps),
		photos.New(deps),
		runModule,
		sources.New(deps, runModule.Store()),
	}
}

// Service is the built service.
type Service struct {
	Handler http.Handler
	Deps    server.Deps
	Modules []server.Module
}

// Options change how the service is built. Tests use them.
type Options struct {
	HTTPClient *http.Client
	Now        func() time.Time
	Data       fs.FS
}

// Build opens nothing; it builds the service on an open database.
func Build(ctx context.Context, settings config.Settings, handle *sql.DB, options Options) (*Service, error) {
	parsed, err := contract.Load(backend.Contract)
	if err != nil {
		return nil, err
	}
	client := options.HTTPClient
	if client == nil {
		client = &http.Client{Timeout: 10 * time.Second}
	}
	now := options.Now
	if now == nil {
		now = time.Now
	}
	data := options.Data
	if data == nil && settings.DataDir != "" {
		data = os.DirFS(settings.DataDir)
	}
	if data == nil {
		data, err = fs.Sub(backend.Data, "daten")
		if err != nil {
			return nil, err
		}
	}
	issuer := auth.NewIssuer(client, settings.DiscoveryURL(), settings.JWKSURL())
	authenticator := auth.New(auth.Config{
		Issuer:     settings.OIDCIssuer,
		ClientID:   settings.OIDCClientID,
		AdminGroup: settings.AdminGroup,
	}, issuer, handle)
	deps := server.Deps{
		DB:       handle,
		Settings: settings,
		Auth:     authenticator,
		Data:     data,
		Now:      now,
		Log:      slog.Default(),
	}
	modules := Modules(deps)
	if err := db.Migrate(ctx, handle); err != nil {
		return nil, err
	}
	if err := server.Start(ctx, modules); err != nil {
		return nil, err
	}
	return &Service{
		Handler: server.Build(settings, parsed, authenticator, modules),
		Deps:    deps,
		Modules: modules,
	}, nil
}
