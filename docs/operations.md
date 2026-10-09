# Operations

This document is the contract between the code and the host. If you change a
line here, change the other side too.

The service is one Go binary, `kinoko`. It serves the API and runs the data
pipeline in the same process. The NixOS module is `nixosModules.default` of
the flake (`deploy/module.nix`). Its options are under `services.kinoko`.

## Hosts

| Host | Function |
| --- | --- |
| Server | Ends TLS for `pilze.beimgraben.net`. Sends the traffic through WireGuard to the homeserver. No body limit |
| Homeserver | Caddy virtual host on port 8110, on `wg0` only. Serves the Angular build and the maps from `/var/www/pilze`. Sends `/api/*` to the service. Runs the service `kinoko` with the weekly pipeline |
| Authentik | `https://sso.beimgraben.net/`, client `pilze`. Read `sso-authentik.md` |

## Paths on the homeserver

| Path | Content | Writer |
| --- | --- | --- |
| `/var/www/pilze` | The Angular build at the root. The maps of the pipeline: `<slug>.json`, `<slug>_kacheln/`, `layers.json`, `layers_kacheln/`, `funde/` | `deploy/frontend.sh`, service `kinoko` |
| `/var/www/pilze/karte` | `deutschland.pmtiles`: vector tiles of Germany up to zoom 14 | `tools/pmtiles/hochladen.sh` |
| `/var/lib/pilze-app/pilze.sqlite` | The database | service `kinoko` |
| `/var/lib/pilze-app/fotos` | Photos. One folder for each find, and `arten/` for the species photos | service `kinoko` |
| `/var/lib/pilze-app/daten` | Data of the pipeline (`PILZE_DATA`): cache, uploads, checkpoints | service `kinoko` |
| `/var/lib/pilze-app/runs` | One log file for each pipeline run (`<run id>.log`) | service `kinoko` |
| `/var/lib/pilze-render/app/backend` | Only without the NixOS module: the binary `kinoko`, `deploy.stamp` and an optional `.env` | `deploy/backend.sh` |

The data folder has this layout:

```
cache/dwd/hyras/...              DWD HYRAS daily grids (netCDF)
cache/dwd/soil_moisture/...      DWD soil moisture daily grids (netCDF)
cache/gbif/...                   GBIF records, one file per year or month (JSON Lines, gzip)
sources/<kind>/v<N>/             an uploaded version: the original file, derived/, process.log
sources/model-bundle/<species>/v<N>/   a model of one species
uploads/<upload id>.part         an upload in progress
interim/weekly/*.parquet         weekly weather checkpoints
interim/occurrences.parquet      the occurrence table
derived/saison.json              the season table
```

`docs/pipeline.md` tells what each file is for.

## NixOS module

Add the flake as an input of the host configuration. Then import the module
and set the options:

```nix
{
  imports = [ inputs.kinoko.nixosModules.default ];

  services.kinoko = {
    enable = true;
    origin = "https://pilze.example.org";
    oidc.issuer = "https://sso.example.org/application/o/pilze/";
    oidc.name = "Example SSO";
  };
}
```

| Option | Default | Function |
| --- | --- | --- |
| `enable` | `false` | Starts the service `kinoko` (API and pipeline) |
| `package` | `packages.<system>.backend` | The package with the binary `kinoko` |
| `frontend` | `packages.<system>.frontend` | The built Angular app. The module does not serve it; a web server must do that |
| `listen` | `127.0.0.1:8111` | Address and port of the API |
| `stateDir` | `/var/lib/pilze-app` | Folder of the database, the photos, the pipeline data and the run logs |
| `mapsDir` | `/var/www/pilze` | Folder of the manifests and the tiles. The web server serves it |
| `origin` | none, required | Public origin of the app, for CORS and links |
| `oidc.issuer` | none, required | OpenID issuer. Discovery and keys come from it |
| `oidc.name` | empty | Name of the SSO on the sign-in button. Empty gives the host of the issuer |
| `oidc.clientId` | `pilze` | Expected audience of the access tokens |
| `oidc.adminGroup` | `pilze-admins` | A person in this group has each permission |
| `pipeline.enable` | `true` | Runs the data pipeline in the service |
| `pipeline.schedule` | `Mon 03:30 Europe/Berlin` | Start of the weekly fetch run and render run |
| `memoryMax` | `6G` | Memory limit of the service. Training and rendering need more than the API |
| `environment` | `{ }` | More `PILZE_*` variables |

The module makes the system user `pilzeapp` and the group `pilzeapp`. It
makes `stateDir` (mode 0750) and `mapsDir` (mode 0755) for this user.

The unit `kinoko.service` has these properties:

| Property | Value |
| --- | --- |
| Start | `kinoko serve` |
| User | `pilzeapp` |
| Work directory | `stateDir`. A file `.env` there gives more settings |
| Restart | `on-failure`, after 5 seconds |
| Limits | `MemoryMax` from `memoryMax`, `ProtectSystem=strict`, `ProtectHome`, `PrivateTmp`, `NoNewPrivileges` |
| Write access | `stateDir` and `mapsDir` only |

The module also sets `PROJ_DATA` and `GDAL_DATA` for the GDAL and PROJ libraries.

## Settings

The service reads its settings from the environment at start. A file `.env` in
the work directory gives a value when the environment has none. The defaults
are for local development; they point to `./var/`.

| Variable | Default | Module value | Function |
| --- | --- | --- | --- |
| `PILZE_DB` | `./var/pilze.sqlite` | `<stateDir>/pilze.sqlite` | Path of the SQLite file. The service also accepts the URL forms `sqlite+aiosqlite:///<path>` and `sqlite:///<path>` |
| `PILZE_FOTOS` | `./var/fotos` | `<stateDir>/fotos` | Folder of the photos |
| `PILZE_MAPS` | `./var/maps` | `mapsDir` | Folder of the manifests and the tiles. The pipeline writes it. The zone values and the combinations read it |
| `PILZE_DATA` | `./var/daten` | `<stateDir>/daten` | Folder of the pipeline data |
| `PILZE_RUN_LOGS` | `./var/runs` | `<stateDir>/runs` | Folder of the run logs |
| `PILZE_LISTEN` | `127.0.0.1:8111` | `listen` | Address and port of the API |
| `PILZE_ORIGIN` | `http://localhost:4200` | `origin` | Public origin, for CORS and for `GET /api/config` |
| `PILZE_OIDC_ISSUER` | empty | `oidc.issuer` | Required for a deploy. OpenID issuer. The service adds a final `/` when it is missing. Without it, the service starts, but nobody can sign in |
| `PILZE_OIDC_NAME` | host of the issuer | `oidc.name` | Optional. Name of the SSO on the sign-in button |
| `PILZE_OIDC_CLIENT_ID` | `pilze` | `oidc.clientId` | Expected `aud` of the access token |
| `PILZE_ADMIN_GROUP` | `pilze-admins` | `oidc.adminGroup` | Group in the token. A person in it is an admin, also without a row in the database |
| `PILZE_PIPELINE` | `true` | `pipeline.enable` | Starts the run queue and the weekly schedule. A boolean |
| `PILZE_SCHEDULE` | `Mon 03:30 Europe/Berlin` | `pipeline.schedule` | Weekly start: `<weekday> HH:MM <IANA zone>`. Without a zone, the time is UTC |
| `PILZE_MAX_PHOTO_BYTES` | `12582912` (12 MiB) | not set | Largest photo upload. A positive integer |
| `PILZE_DATEN` | empty | not set | Folder of the seed data (`texte.json`, `arten/`, `reaktionen.json`). Empty means the copy of `backend/daten` in the binary |

The service does not start when `PILZE_PIPELINE`, `PILZE_MAX_PHOTO_BYTES` or
`PILZE_SCHEDULE` has a value that it cannot read.

## Database migration from the Python service

The Go service takes over the database of the Python service. The migration is
automatic. The default `stateDir` is the folder of the Python service, and the
user is the same (`pilzeapp`).

At each start, and with `kinoko migrate`, the service does these steps:

1. It makes the table `schema_migrations` if it is missing.
2. If the table `alembic_version` exists, it reads the revision.
3. If the revision is `baseline_4`, it records migration 1 (`0001_baseline.sql`) as applied. Then it drops `alembic_version`.
4. It applies each migration in `backend/migrations` that the database does not have.

The schema of `0001_baseline.sql` is the schema of Alembic revision
`baseline_4`. Thus the service does not change the tables of the Python service.

If the revision is not `baseline_4`, the service stops. The error is
`database has alembic revision "<x>", expected "baseline_4"`. Then upgrade the
database with the Python service to `baseline_4` first. That code is in the
Git history.

Do these steps for the change from the Python service:

1. Make a copy of `/var/lib/pilze-app/pilze.sqlite`.
2. Remove the old module `homeserver-pilze-app` from the host configuration.
3. Enable `services.kinoko` as shown above. Keep the default `stateDir`.
4. Switch the host. The service migrates the database at start.
5. Read the log: `journalctl -u kinoko`.

The old value of `PILZE_DB` (`sqlite+aiosqlite:////var/lib/pilze-app/pilze.sqlite`)
also works.

The service does not read `/var/lib/pilze-render`. The models of the Python
chain (`models/*.pkl`) do not work in the Go service. The maps in
`/var/www/pilze` stay; the frontend shows them until the first render run
writes new maps.

## Seed data at start

At each start the service does these steps:

- If the table `species` is empty, it imports the catalogue from the seed data.
- It imports the reactions of `reaktionen.json`.
- It makes the table `text` agree with `texte.json`. A text that a person changed stays.
- It adds a row to `species_forecast` for each forecast species of the catalogue.

`kinoko import-catalog` replaces the catalogue with the seed data. Use it
only when you want to discard the catalogue changes in the database.

## First deploy of the pipeline

The pipeline needs data that it cannot fetch. An admin uploads these data
once. Then the pipeline fetches the weather and the GBIF records, trains the
models and renders the maps. `docs/pipeline.md` describes each data source.

### 1. Upload the data sources

You need the permission `data.manage`. The admin area Verwaltung →
Datenquellen is the place for these uploads. The frontend does not have that
page yet. Until it does, use the API below with an access token.

Upload in this order:

1. `germany-outline`: a GeoJSON of Germany. The fine tree layers need it.
2. `tree-species-map`: the Thünen map of dominant tree species. It gives `trees-grid`, `tree-scales` and the fine tree layers.
3. `dem`: the Copernicus GLO-90 elevation model. It gives the terrain columns and the fine terrain layers.
4. `soilgrids`: the SoilGrids rasters. It gives `site-grid` with the soil and the terrain columns, and the fine soil layers.

The `soilgrids` version joins the terrain columns of the active `dem` version.
Thus upload `dem` before `soilgrids`. If you upload them in the other order,
reprocess the `soilgrids` version.

These uploads are optional:

- `gbif-archive`: a GBIF download for the closed years. It makes the first fetch shorter.
- `weather-checkpoints`: the weekly weather checkpoints of the earlier chain.
- `trees-grid`, `tree-scales`, `site-grid`: the prepared tables of the earlier chain, in place of the raw rasters.
- `model-bundle`: the models of the earlier chain, as bundles with `bundle.json` and `h<k>.txt`.
- `static-layers`: the static layers of the earlier chain.

The upload protocol has three steps:

1. `POST /api/data-sources/{kind}/uploads` with `{"fileName", "sizeBytes", "sha256", "activate"}`. The answer gives the `id` and the `partSize` (16 MiB).
2. `PATCH /api/data-source-uploads/{id}` for each part, in order. Send the header `Upload-Offset` and the body as `application/octet-stream`.
3. `POST /api/data-source-uploads/{id}/complete`. The service then checks and processes the version in the background.

`GET /api/data-sources/{kind}` shows the versions and their state. The log
of a version is at `GET /api/data-sources/{kind}/versions/{versionId}/log`.

### 2. Fetch the public data

Queue a fetch run: `POST /api/pipeline-runs` with `{"kind": "fetch"}`. You need
the permission `run.manage`.

The first fetch run fills an empty cache. It fetches the DWD grids from 2014
and the GBIF records from 2000. This can take hours and needs many gigabytes
of disk. An active `gbif-archive` or `weather-checkpoints` version makes it shorter.

### 3. Train and render

Queue a full run: `POST /api/pipeline-runs` with `{"kind": "full"}`. It trains
a model for each forecast species, then it renders the maps and the layers.

A render run without training needs an active `model-bundle` version for the
species. A full run does not, because it trains the models first.

Read the state of each run in Verwaltung → Läufe, or at
`GET /api/pipeline-runs/{id}`. The full log is in `<stateDir>/runs/<run id>.log`.

## Weekly schedule

At the time of `PILZE_SCHEDULE` the service queues a fetch run and a render
run. It does not queue a run of a kind that already waits in the queue.

- The fetch run checks the DWD grids of the current year again. In January, it also checks the previous year. It gets a file of the previous year that is missing.
- The fetch run gets the GBIF records of the current year. In January and February, it also gets the previous year.
- The render run makes the checkpoints and the occurrence table again. Then it renders the maps, the weekly layers and the season table.

The schedule does not train. Queue a `training` or `full` run by hand when you
want new models.

The service runs one run at a time. A run waits while a data source version
is in processing.

## Caddy

These rules apply to the virtual host on the homeserver:

- Send `/api/*` to `127.0.0.1:8111`.
- Rewrite a path that is not a file to `/index.html`.
- Cache `*.png` for one week, immutable. Cache `*.<hash>.js` and `*.<hash>.css` for one year, immutable.
- Send `no-cache` for `index.html`, `*.json`, `ngsw.json` and `ngsw-worker.js`.
- Accept a request body up to 40 MB. An upload part is 16 MiB, so the bulk uploads pass.
- Serve range requests with `file_server`. PMTiles needs them.

The service reads the training finds directly from the database. No
endpoint for them exists, and no rule for them is necessary.

## Deploy

### Service with the NixOS module

Update the flake input of the host configuration. Then switch the host. The
service restarts and migrates the database.

### Service without the NixOS module

`deploy/backend.sh` builds the binary `kinoko` and copies it with rsync to
`app/backend/` of the target. Then it writes `app/backend/deploy.stamp` in a
second rsync call. A path unit on the host restarts the service when the stamp
changes. The binary contains the seed data. No other file is necessary.

```
deploy/backend.sh                                   # BAU=go: backend/build.sh
BAU=nix NIX_ZIEL=root@homeserver deploy/backend.sh  # nix build .#backend
```

| Variable | Default | Function |
| --- | --- | --- |
| `ZIEL` | `pilzedeploy@10.66.66.6` | rsync target. The work directory is `app/backend` below the root of the target |
| `SCHLUESSEL` | `~/.ssh/pilze_daten` | SSH key of the target |
| `BAU` | `go` | `go`: `backend/build.sh` with cgo. The binary uses the C libraries of the build host. `nix`: `nix build .#backend`. The binary uses the Nix store |
| `NIX_ZIEL` | none | With `BAU=nix` only. A login with Nix on the host. `nix copy` sends the libraries of the binary to its Nix store |

With `BAU=go`, build on a host with the same system as the homeserver, or on
the homeserver. The build host needs Go, a C compiler, `pkg-config` and the
development packages of LightGBM, netCDF, GDAL and PROJ. The homeserver needs
the run-time packages of the same libraries.

The rsync call uses `--delete`. It keeps `.env`, `var/` and `deploy.stamp`.

The host needs these two units. The paths are those of the Python service:

```ini
# kinoko.service
[Unit]
After=network-online.target
ConditionPathExists=/var/lib/pilze-render/app/backend/kinoko

[Service]
User=pilzeapp
WorkingDirectory=/var/lib/pilze-render/app/backend
ExecStart=/var/lib/pilze-render/app/backend/kinoko serve
Restart=on-failure
RestartSec=5
MemoryMax=6G
ProtectSystem=strict
ReadWritePaths=/var/lib/pilze-app /var/www/pilze
Environment=PILZE_DB=/var/lib/pilze-app/pilze.sqlite
Environment=PILZE_FOTOS=/var/lib/pilze-app/fotos
Environment=PILZE_DATA=/var/lib/pilze-app/daten
Environment=PILZE_RUN_LOGS=/var/lib/pilze-app/runs
Environment=PILZE_MAPS=/var/www/pilze
Environment=PILZE_ORIGIN=https://pilze.example.org
Environment=PILZE_OIDC_ISSUER=https://sso.example.org/application/o/pilze/

# kinoko-deploy.path
[Path]
PathChanged=/var/lib/pilze-render/app/backend/deploy.stamp
Unit=kinoko-restart.service

# kinoko-restart.service
[Service]
Type=oneshot
ExecStart=systemctl restart kinoko.service
```

`PILZE_OIDC_ISSUER` is required. `PILZE_OIDC_NAME` is optional. The table in
"Settings" gives all variables. A file `.env` in the work directory can also
give them.

Do these steps for the change from the Python service `pilze-app`:

1. Make a copy of `/var/lib/pilze-app/pilze.sqlite`.
2. Stop and disable `pilze-app` and its path unit `pilze-app-deploy`.
3. Install the two units above. Use the same `PILZE_*` values as `pilze-app`. The old value of `PILZE_DB` (`sqlite+aiosqlite:////var/lib/pilze-app/pilze.sqlite`) also works.
4. Add `PILZE_DATA` and `PILZE_RUN_LOGS`. Make the two folders for the user `pilzeapp`.
5. Run `deploy/backend.sh`. It removes the Python code from `app/backend` and writes the stamp.
6. Enable `kinoko.service` and `kinoko-deploy.path`. Start `kinoko.service` if the stamp was first.
7. Read the log: `journalctl -u kinoko`. The service adopts the database of the Python service at start (see "Database migration from the Python service").
8. Do a test: `curl -s http://127.0.0.1:8111/api/config`. The value `version` must be the version of the build.

### Version

The version of a build comes from Git, for example `v2026-10-08-01-3-g65dd41a`
(`git describe --tags --always`). The app and the service remove the commit
hash and show `v2026-10-08-01-3`. A release tag has the form `vYYYY-MM-DD-NN`.

- The app: `frontend/tools/stamp-version.mjs` writes it before each build. The about page shows it.
- The service: `backend/build.sh` gives it to the linker (`-ldflags -X …/config.build=…`). `GET /api/config` and `kinoko version` return it. A plain `go build` gives `dev`.
- Nix: the flake has no Git tags. It uses the date and the commit of the flake, for example `v2026-10-09+65dd41a`, for the app and the service. Thus the build stays reproducible.
- `KINOKO_VERSION` replaces the Git value for both sides.

CI stops when the app and the service of one build do not show the same
version.

`npm start` stamps the app one time at start. Restart it after a commit. The
service shows the version of its last `backend/build.sh`.

### Frontend

`deploy/frontend.sh` copies the Angular build to `/var/www/pilze` with rsync.
The key has a forced `rrsync -wo` command. The target user has no shell.

```
cd frontend && npm run build
deploy/frontend.sh
```

The script uses `--delete`. The filters `P /*/` and `P /*.json` protect the
tiles, the manifests and the layers of the pipeline. The script reads the key
from `SCHLUESSEL` and the target from `ZIEL`.

When a change touches the API and the app, deploy the service first. Then
deploy the frontend.

### Offline base map

`tools/pmtiles/hochladen.sh` copies the PMTiles archive to
`/var/www/pilze/karte`. Read `tools/pmtiles/README.md`.

## Local development

- Use `nix develop` for both sides. Use `nix develop .#backend` or `nix develop .#frontend` for one side.
- Service: `cd backend && go run ./cmd/kinoko serve`.
- App: `cd frontend && npm ci && npm start`. `proxy.conf.json` sends `/api` to `127.0.0.1:8111` and the tile paths to `https://pilze.beimgraben.net/`.
- SSO: use your Authentik instance with the redirect `http://localhost:4200/anmeldung`. Set `PILZE_OIDC_ISSUER` for it.
- SSO without Authentik: `cd backend && go run ./tools/devsso -admin`. It signs in a test person at once. Start the service with `PILZE_OIDC_ISSUER=http://127.0.0.1:9000/`. Use it only on localhost.
