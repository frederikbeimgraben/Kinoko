# Kinoko

[![CI](https://github.com/frederikbeimgraben/Kinoko/actions/workflows/ci.yml/badge.svg)](https://github.com/frederikbeimgraben/Kinoko/actions/workflows/ci.yml)

Kinoko is a web app that forecasts mushrooms in Germany. The map shows, for
each calendar week, where an edible species probably fruits. The app also
shows input layers, a factor finder and a species catalogue. With an account,
a person can keep finds, markers and zones.

Live: https://pilze.beimgraben.net/

## Layout

| Folder | Content |
| --- | --- |
| `backend/` | Go service `kinoko`: the API, SQLite, OIDC with Authentik, and the data pipeline in the same process |
| `backend/internal/pipeline/` | Data pipeline: DWD weather and GBIF records, LightGBM training (cgo), tile rendering (GDAL) |
| `backend/openapi.yaml` | The API contract. People write it; the frontend client comes from it |
| `backend/daten/` | Seed data: species profiles, texts, reactions, season table |
| `frontend/` | Angular 22 app: MapLibre GL, Terra Draw, PWA |
| `deploy/` | NixOS module (`module.nix`) and the deploy script of the frontend |
| `docs/` | Operations, pipeline, SSO, research notes, style rules, mockups |
| `tools/pmtiles/` | Build and upload of the offline base map |

Read these documents first:

- `docs/operations.md`: hosts, paths, NixOS options, settings, first deploy.
- `docs/pipeline.md`: data sources, run kinds, outputs.
- `docs/style.md`: rules for code, comments and documents.

## Quick start with Nix

The flake gives three development shells:

- `nix develop`: Go, Node 24, the C libraries of the pipeline, Chromium.
- `nix develop .#backend`: Go and the C libraries (LightGBM, netCDF, GDAL, PROJ).
- `nix develop .#frontend`: Node 24 and Chromium.

Start the service. It uses the folder `backend/var/` for the database and the data.

```
nix develop
cd backend
go run ./cmd/kinoko serve
```

The API listens on `http://127.0.0.1:8111/api`. Set `PILZE_PIPELINE=false` to
keep the pipeline off. The service reads a file `.env` in its work directory
for more `PILZE_*` settings. The table of settings is in `docs/operations.md`.

The other commands of the binary are `migrate`, `import-catalog` and `version`.

Start the app in a second shell:

```
nix develop .#frontend
cd frontend
npm ci
npm start
```

The app opens on `http://localhost:4200`. The proxy sends `/api` to the
local service. It sends the tile paths to `https://pilze.beimgraben.net`.
Thus you do not need a local render run.

## Checks

Run each check before a pull request. CI runs the same commands
(`.github/workflows/ci.yml`).

Backend, in `nix develop .#backend`:

```
cd backend
gofmt -l .                  # must print nothing
go vet ./...
golangci-lint run ./...
go run ./tools/lintrules .  # file size and comment rules of docs/style.md
go test ./...
```

Frontend, in `nix develop .#frontend`:

```
cd frontend
npm ci
npm run lint
npm run typecheck
npm run test:ci
npm run build
npm run e2e
```

The Nix shell sets `BROWSER_PATH` for Playwright. Read `frontend/e2e/README`
for the end-to-end tests.

## Generated files

Some files come from other files. Keep them in sync in the same pull request.

| Source | Command | Result |
| --- | --- | --- |
| `backend/openapi.yaml` | `cd frontend && npm run api:generate` | `frontend/src/app/core/api/contract.d.ts` |
| `backend/daten/texte.json` | `cd frontend && npm run texts:sync` | `frontend/src/app/core/i18n/texts.<locale>.json` |

`backend/openapi.yaml` is the contract. Write each change of the API there by
hand, then change the Go handlers. The service loads the file at start. CI
fails when `contract.d.ts` does not agree with the contract.

`backend/daten/texte.json` holds the user interface text in German and English.
The service writes it into the table `text` at start.

## Licence

GPL-3.0-or-later. Read `LICENSE`.
