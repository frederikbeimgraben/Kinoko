# Operations

This document is the contract between the code and the host. If you change a
line here, change the other side too.

The service is one Go binary, `kinoko`. It serves the API and runs the data
pipeline in the same process. The NixOS module is `nixosModules.default` of
the flake (`deploy/module.nix`). Its options are under `services.kinoko`.

## Hosts

| Host | Function |
| --- | --- |
| Server | Ends TLS for `kinoko.reutlingen.university`. Sends the traffic through WireGuard to the homeserver. No body limit |
| Homeserver | Caddy virtual host on port 8110, on `wg0` only. Serves the Angular build and the maps from `/var/www/pilze`. Sends `/api/*` to the service. Runs the service `kinoko` with the weekly pipeline |
| Authentik | `https://sso.projekte.reutlingen.university/`, client `kinoko`. Read `sso-authentik.md` |

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

## Database migration

At each start, and with `kinoko migrate`, the service applies each migration
in `backend/migrations` that the database does not have. The table
`schema_migrations` records the applied migrations.

## Seed data at start

At each start the service does these steps:

- If the table `species` is empty, it imports the catalogue from the seed data.
- If the table `species` is not empty, it examines the description fields (`beschreibung`, `beschreibungEn`, `entwurf`) of each species file `arten/*.toml`. The table `seed_digest` keeps a SHA-256 digest of these fields from the last sync. When the fields of a file changed, the service writes them into the species with the same slug, but only if the species still has the fields of the last sync. A description that an admin changed stays. Without a stored digest (the first start after an upgrade), the service writes only into a species without a description.
- In the same way, it sets the forecast flag (`karte`) and the ring shape (`ringform`) of a species to the values of its file. Without a stored value, it only fills an empty field: it turns a forecast on, or sets a ring shape that is not set. A value that an admin set stays. Other fields of a species never change.
- It imports the reactions of `reaktionen.json` into a new catalogue. It imports them again only when the file changed since the last import (the table `seed_digest` keeps a SHA-256 digest of the file). Thus a restart keeps the reagent terms that an admin deleted or merged.
- It makes the table `text` agree with `texte.json`. A text that a person changed stays.
- It adds the glossary terms of `glossar.json` that it did not add before. A term that a person changed or deleted stays.
- It adds a row to `species_forecast` for each forecast species of the catalogue.

`kinoko import-catalog` replaces the catalogue with the seed data. Use it
only when you want to discard the catalogue changes in the database.

## Export the catalogue

The admins correct the catalogue in the admin UI (Verwaltung). The changes
go into the database, not into the seed files. Export the catalogue to keep
the changes in the repository:

1. Examine and correct the data in the admin UI.
2. Get a copy of the database, or use the database of the service.
3. From the repository root, run the export:

   ```sh
   PILZE_DB=/path/to/pilze.sqlite kinoko export-catalog --out backend/daten
   ```

4. Examine the difference: `git diff backend/daten`.
5. Commit the new seed files.

The default of `--out` is `backend/daten`. The command writes these files:

- `arten/<stem>.toml`: one profile for each species. It removes the profiles of deleted species.
- `reaktionen.json`: the reagent reactions and their sources.
- `glossar.json`: the glossary, with the German and the English definitions.

The command does not write personal data: no users, finds, markers, zones or
photos. It does not write `taxonomie.json`, `saison.json` or `texte.json`.
The admin UI does not change the taxonomy and the season table.
`texte.json` is the source of the UI texts: change it in the repository.

The command keeps the format of the seed files. An export of an unchanged
import gives the same files, byte for byte. Some keys of the profiles are not
in the database, for example `wertigkeit`, `sammelbar`, `marktfaehigSchweiz`,
`warnung` and `masse.*.seltenBis`. The export keeps their values from the
files in `--out`. If `--out` has no folder `arten`, it uses the seed data in
the binary. Two keys of the profiles hold data that only the admin UI sets:
`beschreibung` (the description) and the table `teilnotizen` (a note and a
comment for each body part). The import reads both keys.

The seed format cannot hold all data of the database. The command writes a
warning for each value that it cannot write, for example:

- a cap or stem feature for only one phase (young or old),
- a colour change with a trigger other than a cut or one reagent,
- a smell, taste or tree term that an admin added and that has no word in the importer vocabulary,
- a source with a check date that is not the date of the profile source.

Read the warnings before you commit. The command refuses an empty database,
because that export would remove each profile.

## Seed photos

`backend/daten/fotos.json` gives one freely licensed lead photo for each
species that has one on Wikimedia Commons. The app does not load an image
from another host, so the photos must be in the photo folder. The command
`kinoko seed-photos` puts them there:

```sh
cd /var/lib/pilze-app
sudo -u pilzeapp env PILZE_DB=/var/lib/pilze-app/pilze.sqlite \
  PILZE_FOTOS=/var/lib/pilze-app/fotos kinoko seed-photos
```

For each entry the command does these steps:

1. It finds the species with the key of the entry as slug (the latin name as a slug, for example `boletus-edulis`).
2. If a photo with the same source page (`quelle`) is in the database, it does nothing. Thus you can run the command again, for example after a failure.
3. It downloads the file (`bild`, a copy with a width of 1920 pixels, else `url`) with the User-Agent `KinokoBot/0.1`. It waits 2 seconds between two downloads (`--pause`). After the answer 429 it waits as long as `Retry-After` asks, at least 10 seconds.
4. It makes the sizes of an upload (`PILZE_MAX_PHOTO_BYTES` applies) and writes the photo row: approved, without owner, with the author (`urheber`), the licence (`lizenz`), the source page and the German and English captions.
5. If the species has no lead photo, the photo becomes the lead photo.

At the end the command writes the counts. If an entry failed, it names the
species and stops with an error. Run it again to try the failed entries.
`--file <path>` reads another seed file. Without it, the command reads
`fotos.json` of `PILZE_DATEN`, else the copy in the binary.

The photo credit of the app shows the author and links the licence code to
the licence text and the author to the source page.

### Make the seed file

`backend/tools/commonsfotos` makes `fotos.json` from the Commons API and
the GBIF species API. It sends the User-Agent of the project and waits between the
requests. A full search of all species takes some hours.

```sh
cd backend
go run ./tools/commonsfotos find -arten daten/arten -out /tmp/candidates.json
go run ./tools/commonsfotos names -arten daten/arten -candidates /tmp/candidates.json
go run ./tools/commonsfotos pick -arten daten/arten -candidates /tmp/candidates.json \
  -picks /tmp/picks.json -out daten/fotos.json
```

`names` adds the English common name of each species for the English
caption. It takes only the names of the UK Species Inventory (the
recommended English names of the British Mycological Society) and of the
IUCN Red List. Without such a name the English caption is the latin name.

`find` keeps the 8 best files of each species and the reasons of their
scores. Examine the candidates. To choose another file, or no file, for a
species, write it into the picks file: `{"steinpilz": "File:…jpg"}` or
`{"steinpilz": ""}`. The tool accepts only CC0, public domain and the
unported licences CC BY and CC BY-SA 2.0 to 4.0.

## First deploy checklist

Do these steps in this order. The host is `https://kinoko.reutlingen.university`.

1. Deploy `main`: the service as in "Deploy" below, then the app with `deploy/frontend.sh`.
2. Set `oidc.name` (`PILZE_OIDC_NAME`), for example `services.kinoko.oidc.name = "Hochschul-Login";`. Without it, the sign-in button shows the host of the issuer. Restart the service.
3. Check the config: `curl -s https://kinoko.reutlingen.university/api/config | jq`. `oidcIssuer` and `oidcName` are not empty. `version` has the date-tag form, for example `v2026-10-08-01`. `dev` means a plain `go build`.
4. Add the lead photos: run `kinoko seed-photos`, as "Seed photos" tells. Then the species pages show a photo with its credit.
5. Sign in as an admin. Upload the data sources, as "First deploy of the pipeline" tells.
6. Open Verwaltung → Läufe (`/verwaltung/laeufe`). Push "Lauf anstoßen", select "Vollständig" and push "Anstoßen". The dialog names the inputs that are missing. Then it does not start the run.
7. Watch the run on its page. The first full run fetches the data from 2014 and can take hours. A failed run shows its error. The full log is in `<stateDir>/runs/<run id>.log`.
8. Run `deploy/smoke.sh https://kinoko.reutlingen.university`. All checks must pass. Before the first full run ends, the manifest checks fail, and the map shows "Noch keine Vorhersage".

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
- `weather-checkpoints`: prepared weekly weather checkpoints.
- `trees-grid`, `tree-scales`, `site-grid`: prepared tables, in place of the raw rasters.
- `model-bundle`: trained models, as bundles with `bundle.json` and `h<k>.txt`.
- `static-layers`: prepared static layers.

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
- Rewrite only a navigation path that is not a file to `/index.html`, for example `/karte` or `/arten/boletus-edulis`.
- Do not rewrite a data path. When the file is missing, send 404. The data paths are `*.json`, `*.png`, `*.pmtiles` and the tile folders `/<slug>_kacheln/`, `/layers_kacheln/`, `/funde/` and `/karte/`.
- Cache `*.png` for one week, immutable. Cache `*-<hash>.js` and `*-<hash>.css` (8 characters, for example `main-LZMCBVKM.js`) for one year, immutable.
- Send `no-cache` for `index.html`, `*.json`, `ngsw.json` and `ngsw-worker.js`.
- Accept a request body up to 40 MB. An upload part is 16 MiB, so the bulk uploads pass.
- Serve range requests with `file_server`. PMTiles needs them.

A rewrite of a data path sends the app page with status 200 in place of a
404. The app then reads HTML as a manifest. The app shows such a reply as
"no data", but a 404 is clear in the browser tools, in the logs and for
`deploy/smoke.sh`.

```caddyfile
:8110 {
	root * /var/www/pilze
	encode zstd gzip

	request_body {
		max_size 40MB
	}

	handle /api/* {
		reverse_proxy 127.0.0.1:8111
	}

	# Data paths: the file, or 404. No rewrite to the app page.
	@data path_regexp data (\.(json|png|pmtiles)$)|(^/([a-z0-9_-]+_kacheln|funde|karte)/)
	handle @data {
		file_server
	}

	# Navigation paths: the file, else the app page. `/` gives the app page as the folder index.
	# `route` keeps the order, so the header rule sees the path after the rewrite.
	@shell path / /index.html
	handle {
		route {
			try_files {path} /index.html
			header @shell Cache-Control "no-cache"
			file_server
		}
	}

	@immutablePng path *.png
	header @immutablePng Cache-Control "public, max-age=604800, immutable"
	@hashed path_regexp hashed -[A-Za-z0-9_-]{8}\.(js|css)$
	header @hashed Cache-Control "public, max-age=31536000, immutable"
	@fresh path *.json /ngsw-worker.js
	header @fresh Cache-Control "no-cache"

	# A missing file must not stay in a cache.
	handle_errors 404 {
		header Cache-Control "no-store"
		respond 404
	}
}
```

The folder part of `@data` does not match the navigation path `/karte`,
because it needs the slash after the folder name. Thus the map page still
gets the app page.

Do a check after a change of the rules:

```
curl -s -o /dev/null -w '%{http_code}\n' https://<host>/nicht-da.json   # 404
curl -s -o /dev/null -w '%{http_code}\n' https://<host>/karte           # 200
```

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

The host needs these two units:

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

### Version

The version of a build comes from Git, for example `v2026-10-08-01-3-g65dd41a`
(`git describe --tags --match` on the release tag form, so other tags do not count). The app and the service remove the commit
hash and show `v2026-10-08-01-3`. A release tag has the form `vYYYY-MM-DD-NN`.

- The app: `frontend/tools/stamp-version.mjs` writes it before each build. The about page shows it.
- The service: `backend/build.sh` gives it to the linker (`-ldflags -X …/config.build=…`). `GET /api/config` and `kinoko version` return it. A plain `go build` gives `dev`.
- Nix: the flake has no Git tags. It uses the date and the commit of the flake, for example `v2026-10-09+65dd41a`, for the app and the service. Thus the build stays reproducible.
- `KINOKO_VERSION` replaces the Git value for both sides. A release tag without the `v`, for example `2026-10-08-01`, gets the `v`.

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
- App: `cd frontend && npm ci && npm start`. `proxy.conf.json` sends `/api` to `127.0.0.1:8111` and the tile paths to `https://kinoko.reutlingen.university/`.
- SSO: use your Authentik instance with the redirect `http://localhost:4200/anmeldung`. Set `PILZE_OIDC_ISSUER` for it.
- SSO without Authentik: `cd backend && go run ./tools/devsso -admin`. It signs in a test person at once. Start the service with `PILZE_OIDC_ISSUER=http://127.0.0.1:9000/`. Use it only on localhost.
