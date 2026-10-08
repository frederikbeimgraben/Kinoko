# Data pipeline

The pipeline makes the forecast maps. It runs in the process of the service
`kinoko`. The code is in `backend/internal/pipeline`. The data sources are in
the module `backend/internal/modules/sources`. The runs are in the module
`backend/internal/modules/runs`.

The pipeline is a port of the earlier Python chain (`modell/`). The Go code
keeps the algorithms and the constants of that chain. The tests compare the
Go results with the Python results. The port also fixes some errors of the
chain. The section "Errors of the Python chain" lists them.

## Data flow

```
DWD HYRAS + soil moisture ──► weekly checkpoints ──► weather cube ─┐
GBIF API + gbif-archive + app finds ──► occurrence table ──────────┤
tree-scales ───────────────────────────────────────────────────────┼─► training ──► model bundle (h0..h4)
                                                                   │
trees-grid + tree-scales + site-grid + model bundle ───────────────┴─► species maps ──► <slug>.json, <slug>_kacheln/
weather cube + grids ──────────────────────────────────────────────────► weekly layers ──► layers.json, layers_kacheln/
occurrence table ──────────────────────────────────────────────────────► season table ──► derived/saison.json
```

There are two kinds of input:

- (A) Public sources. The service fetches them itself and keeps a cache.
- (B) Uploads. An admin uploads them once. The service checks them and derives the files that the pipeline reads.

The pipeline reads only the active version of each upload kind. It reads no
file outside `PILZE_DATA` and writes the maps into `PILZE_MAPS`.

## (A) Automatic sources

| Source ID | Address | Content | When | Cache |
| --- | --- | --- | --- | --- |
| `dwd-hyras` | `opendata.dwd.de/.../daily/hyras_de/` | Daily grids of rain, mean, lowest and highest temperature, humidity (1 km) | Fetch runs | `cache/dwd/hyras/` |
| `dwd-soil-moisture` | `opendata.dwd.de/.../daily/soil_moisture/` | Daily plant available soil water under spruce, beech, oak and pine, 0 to 30 cm | Fetch runs | `cache/dwd/soil_moisture/` |
| `gbif-occurrences` | `api.gbif.org/v1/occurrence/search` | Fungi records in Germany: human observations, present, with a coordinate, without a geospatial issue | Fetch runs | `cache/gbif/` |

The service fetches no taxonomy. The taxonomy of the catalogue comes from
`backend/daten/taxonomie.json` in the seed data.

The service also reads two internal inputs from the database at each run:

- The training finds of the app: accepted, released for training, not deleted, of a species with a forecast. A find write needs a latitude from -90 to 90 and a longitude from -180 to 180. Its day is at most one day after the current UTC date. Else the answer is 422 with the field code `greater_than_equal` or `less_than_equal`.
- The forecast species: the species with `forecast_enabled`, with their row in `species_forecast`.

`species_forecast` holds the chain key, the scientific names (taxa) and the
minimum forest share of each species. The service seeds it at start from the
list in `sources.Chains`. For example, the chain `reizker` counts four
Lactarius species.

### Fetch rules

The table `remote_cache_file` records each cached file with its state.

- Each fetch gets the weekly years. The DWD fetch checks the current year with a conditional GET. In January, it also checks the previous year.
- The GBIF fetch gets the current year again. In January and February, it also gets the previous year, because of late reports.
- Each fetch also gets the missing closed years. An empty cache thus gets a bootstrap: the DWD years from 2014 and the GBIF years from 2000. A stopped bootstrap continues at the next fetch.
- A closed DWD year is present when each HYRAS folder or soil moisture stand has a usable row for it. A usable row has the state `ok` or `pruned`. A failed row does not count.
- A closed GBIF year is present when its year file or the marker `fungi_de_<year>.done` is in the cache. The fetcher writes the marker when the fetch of a year ends without an error. Thus a year split into months or a year without records also counts.
- A closed year does not change after its first fetch.
- A download goes to a temporary file first. Then the service renames it.
- An active `gbif-archive` version holds the GBIF years before its cutoff year. The fetch gets the closed years from the cutoff year on, and the weekly years. An archive without a cutoff year holds each closed year.
- An active `weather-checkpoints` version holds the closed DWD years. The fetch then gets only the weekly years.
- A request waits at most 2 minutes for the response header. A transfer stops when no bytes come for 3 minutes; then the fetcher tries again. A large download has no total time limit. A DWD directory listing has a limit of 120 s.

`POST /api/remote-sources/{source}/refresh` queues a fetch run for one source.
The body can give `fromYear`, `toYear` and `force`. `force` checks each year
of the request again. The run and its request go into the database in one
transaction. The runner starts only after that transaction.

## (B) Upload kinds

Each upload has versions. One version of a kind is active; for
`model-bundle`, one version of each species is active. A new version becomes
active when it is ready, if the upload asks for that. The earlier version
becomes `superseded`. The service keeps the two newest superseded versions and
deletes the older ones.

The service checks each version. Then it derives the files that the pipeline
reads. A raw raster kind installs its derived tables as new versions of the
prepared kinds (origin `derived`).

| Kind | Required | Accepted files | Largest | Checks | Derived files and versions |
| --- | --- | --- | --- | --- | --- |
| `gbif-archive` | no | `.zip`: a GBIF download (DwC-A or SIMPLE_CSV) | 20 GiB | The import is the check. At least 1,000 kept rows | One JSON Lines file per year under `derived/gbif/`, with the observer name as a hash. The cutoff year sets which years come from the archive |
| `tree-species-map` | no | `.tif`, `.tiff`, or `.zip` of GeoTIFF tiles | 12 GiB | One band, Byte. Pixel at most 10.5 m. Coverage at least 0.9 of the grid. Less than 1 % of the sampled points outside the classes of the map | `trees_de_500m.parquet` (new `trees-grid`), `tree_scales.parquet` (new `tree-scales`). With an active `germany-outline`: the fine layers `wald`, `fichte`, `buche`, `eiche`, `birke`, `kiefer`, `nadelholz` |
| `dem` | no | `.tif`, `.tiff`, or `.zip` of GeoTIFF tiles | 4 GiB | One band, Float32 or Int16. Pixel at most 100 m. Coverage at least 0.9. Heights from -500 to 5000 m | `dem90_3035.tif`, slope, aspect, northness and eastness at 90 m. The terrain columns. With an active `soilgrids`: a new `site-grid`. The fine layers `hoehe`, `hangneigung`, `nordexposition` |
| `soilgrids` | no | `.zip` of `<property>_<depth>_mean.tif` | 2 GiB | The names match the pattern. `phh2o_0-5cm`, `sand_0-5cm` and `soc_0-5cm` are present. Int16. Pixel at most 300 m | The soil columns and a new `site-grid`, with the terrain columns of an active `dem`. The fine layers `boden_ph`, `boden_sand`, `boden_kohlenstoff` |
| `germany-outline` | no | `.geojson`, `.json` | 100 MiB | A polygon or multipolygon. Area from 340,000 to 370,000 km² | The file as it is. The fine tree layers use it as the inland mask |
| `trees-grid` | yes | `.parquet` | 2 GiB | The columns of `trees_de_500m.parquet`. 2.0 to 2.6 million rows. Each x and y is the centre of a 500 m cell | The file as it is |
| `tree-scales` | yes | `.parquet` | 2 GiB | The columns of `tree_scales.parquet`, float32. The row count agrees with the active `trees-grid` | The file as it is |
| `site-grid` | yes | `.parquet` | 2 GiB | The column `soil_phh2o_0_5cm` is present. It is the water mask of the map | The file as it is |
| `weather-checkpoints` | no | `.zip` of `weekly/<name>.parquet` | 2 GiB | The twelve checkpoints are present. Their weeks have no gap | The checkpoints. The weather step copies a missing checkpoint from them |
| `model-bundle` | yes, per species | `.zip` with `<slug>/bundle.json` and `<slug>/h<k>.txt` | 500 MiB | LightGBM loads each model. The species is in the catalogue | One version per species. A training run also makes versions (origin `training`) |
| `static-layers` | no | `.zip` with `layers.json` and `layers_kacheln/<name>/<z>/<x>/<y>.png` | 15 GiB | Each entry is static. Each tile is a 256 × 256 gray PNG | The manifest and the tiles, unpacked |

The twelve weather checkpoints are `pr`, `tas`, `tasmin`, `tasmax`, `hurs`,
`paws_spruce`, `paws_beech`, `paws_oak`, `paws_pine`, `days_since_rain`,
`frost_days` and `heat_days`.

A raster in a zip stays in the zip. GDAL reads it in place through `/vsizip/`.

### Upload protocol

The proxy accepts a body of 40 MB at most. Thus an upload goes in parts of 16 MiB.

1. `POST /api/data-sources/{kind}/uploads` makes a session. The service refuses the upload when the free disk is less than two times the size plus 1 GiB.
2. `PATCH /api/data-source-uploads/{id}` adds one part at the offset `Upload-Offset`. The service writes the part to disk and keeps the SHA-256 state in the database. A restart can continue the upload.
3. `POST /api/data-source-uploads/{id}/complete` moves the file to `sources/<kind>/v<N>/` and starts the processing.

A session expires 24 hours after its last part. The processing and the runs
use one lock. Thus a run never reads a version that is in processing.

An activation, a deletion or a new processing of a version is refused with
`run_active` while a run is running. The check and the change are in one
transaction, so a run cannot start between them. A run in the state
`running` while no run holds the lock is stale: the change sets it to
`failed`, as a start of the service does. The runner always ends a run, also
when a report to the database fails.

## Run kinds

A run has a kind and a list of steps. The runner does one run at a time.
Each run records its inputs in `pipeline_run_input`. These are the active
versions that it reads and the cache state of each public source.

| Kind | Steps |
| --- | --- |
| `fetch` | check inputs, fetch weather, fetch occurrences |
| `training` | check inputs, weather checkpoints, occurrences, train models |
| `render` | check inputs, weather checkpoints, occurrences, render maps, render layers, season table |
| `full` | check inputs, weather checkpoints, occurrences, train models, render maps, render layers, season table |

A fetch run for one source has only the fetch step of that source.

The check of inputs refuses a run with the error `inputs_missing` when a
required kind has no active, ready version:

| Kind | Needs |
| --- | --- |
| `fetch` | nothing |
| `training` | `tree-scales` |
| `render` | `trees-grid`, `tree-scales`, `site-grid`, `model-bundle` |
| `full` | `trees-grid`, `tree-scales`, `site-grid` |

### Steps

- **fetch weather**: gets the DWD files into the cache by the fetch rules.
- **fetch occurrences**: gets the GBIF files into the cache by the fetch rules.
- **weather checkpoints**: copies a missing checkpoint from an active `weather-checkpoints` version. A copied checkpoint gets the change time 1970-01-01, so each raw file of the cache counts as newer. Then it extracts the weeks again from the oldest year `rf` whose raw file changed. The result is `interim/weekly/<name>.parquet`.
  - The extraction keeps an old week only when it ends before January 1 of `rf`; it computes each later week from the files of `rf-1` on. Without the file of `rf-1`, it keeps more old weeks: up to 63 days after January 1 of the first file. These days cover the week across the turn of the year and the 60-day counter of `days_since_rain`.
- **occurrences**: builds `interim/occurrences.parquet` from the GBIF cache, the active `gbif-archive` and the app finds. It keeps the class Agaricomycetes and gives each record an ISO week and a 5 km cell. It drops an app find outside latitude 47 to 55.5 and longitude 5.5 to 15.5. It also drops an app find with a day after the day of the run. The run log shows the counts. It drops each record with a latitude outside -90 to 90 or a longitude outside -180 to 180. The activity grid is dense, so one far find would make it too large for the memory.
- **train models**: trains each species of the run. It makes the visit table, trains one LightGBM model for each horizon 0 to 4, and calibrates the scores. It installs the bundle as the new active `model-bundle` version of the species. It writes `funde/<slug>.json` into `PILZE_MAPS`.
- **render maps**: draws the weekly map of each species with its active model.
- **render layers**: publishes the static layers first. Then it draws the fifteen weekly input layers and removes the week folders that no manifest names.
- **season table**: writes `derived/saison.json` into `PILZE_DATA`.

A failed species does not stop the steps "train models" and "render maps".
The run state is then `failed`. A failure of another step stops the run.

The forecast reaches two weeks past the last week with weather. It stops at
the largest horizon that each active model of the run has.

### Schedule

At the time of `PILZE_SCHEDULE` (default `Mon 03:30 Europe/Berlin`) the
runner queues a `fetch` run and a `render` run. It does not queue a kind
that already waits. The time follows the wall clock of the zone, also across
a change to summer time. The schedule does not train.

## Outputs

The pipeline writes these files into `PILZE_MAPS`. The frontend and the
service read them. Keep their form when you change the code.

| File | Content | Readers |
| --- | --- | --- |
| `<slug>.json` | Manifest of a species. `<slug>` is the catalogue slug | Frontend (`core/tiles/manifest.ts`), zone values of the service |
| `<slug>_kacheln/<YYYY>W<ww>/<z>/<x>/<y>.png` | Value tiles of a species, one folder per week. A week folder changes in two renames (old folder to `.old`, new folder into place). A failed rename puts the old folder back | Frontend, zone values of the service |
| `layers.json` | Manifest of the input layers: static entries first, then the weekly entries | Frontend (`core/tiles/layers.ts`), combinations of the service |
| `layers_kacheln/<layer>/...` | Tiles of the input layers. A weekly layer has one folder per week | Frontend |
| `funde/<slug>.json` | Training finds per 5 km cell and week | No reader at this time |

The pipeline writes `derived/saison.json` into `PILZE_DATA`. Its form is the
form of `backend/daten/saison.json`. No module of the service reads the file
at this time.

### Tiles

A tile has 256 × 256 points and one byte per point. Byte 0 is no data. Bytes
1 to 255 are the share 0 to 1 of the scale, linear. A species has the scale
0 to `top`. A layer has the scale `low` to `high` in its unit.

### Manifest of a species

The frontend reads these fields:

- `species`, `top`, `bounds` as `[[south, west], [north, east]]`.
- `tiles.zooms`, `tiles.haveZoom`, `tiles.offlineZoomTo`, `tiles.have`.
- `weeks[]` with `year`, `week`, `forecast`, `tiles`, `mean`, `max`, `histogram`.

The service reads `top`, `weeks[].{year, week, tiles}` and `tiles.have`. It
computes the mean of a zone from the tiles of the finest zoom in `have`.

### Manifest of the layers

The frontend reads `bounds` and the layers. For each layer, it reads these
fields: `tiles`, `zooms`, `weeks`, `histogram`, `histograms`, `have`, `static`,
`low`, `high`, `label`, `unit`, `note`. A week key has the form `YYYYWww`. The frontend compares the keys as text.

A histogram is `{"classes": [41 edges], "shares": [40 shares]}`. A weekly
layer keeps one histogram for each week in `histograms`.

The writer writes the manifest in one rename after the tiles. Thus a reader
never sees a week without its tiles.

### Static layers

These active versions hold static layers: the `static-layers` upload and the
fine layers of `tree-species-map`, `dem` and `soilgrids`. A version without
`layers.json`, for example a tree map without an outline, holds none.

The runner publishes these layers with `render.InstallStaticLayers`:

- It copies each layer to `layers_kacheln/<name>` in `PILZE_MAPS`. Each folder changes in one rename.
- A derived fine layer replaces an uploaded layer with the same name.
- The file `.source` in each folder names the version and its processing time. A folder of the same version is not copied again.
- Then it writes `layers.json` with the static entries first and the weekly entries after them. It writes the file only when the text changes.
- A static entry stays in `layers.json` when its version is no longer active.

The publication occurs at two times:

- At the start of the step "render layers", before it writes `layers.json`.
- After a version of one of these kinds becomes active. The service then waits for the end of a run or of a processing. This occurs only when `PILZE_PIPELINE` is on.

## Errors of the Python chain

The port fixes these errors on purpose. The numbers are the findings of the
port plan; the code comments use them.

| Finding | Error in the Python chain | Behaviour of the Go pipeline |
| --- | --- | --- |
| 1 | The weekly update wrote the manifest and `funde/` under the chain name (`boletus_edulis`). The readers look for the catalogue slug (`boletus-edulis`) | The manifest, the tile folder and `funde/` use the catalogue slug |
| 2 | The GBIF fetch skipped a file that was present. Thus the current year did not change after the first fetch | The weekly fetch gets the current year again and replaces its files |
| 3 | The weekly update did not fetch the soil moisture again. The merge then stopped with "cell-weeks do not match" | Each fetch run gets both DWD sources. The merge keeps the other variables when the keys differ |
| 4 | The distance to a horizon was the difference of `year*53 + week`. After a year with 52 weeks, the distance was one week too large | The distance comes from the calendar |
| 5 | Training built the activity features from the filtered records (ISO year from 2015, coordinate error at most 500 m). The map used all records | Training and map use the same filter (`occ.TrainingSet`) |
| 6 | A training run skipped a species that had a model. A render run skipped a species that had a tile folder | A run always trains and renders each species of the run |
| 7 | The run reported the Brier score of horizon 4 | The run reports the calibrated out-of-fold Brier score of horizon 0 |
| 8 | The mean of a week across two year files was the mean of two part means | The mean is over the days of the week |
| 9 | The rain sum of a week without values was 0 | The sum is NaN |
| 10 | The smoothing filled masked cells (forest, abroad, water) next to valid cells | A masked cell stays empty. The setting `Spill` gives the old result; it is off by default |
| 11 | The render held the full input matrix in memory | The prediction works in chunks. Read "Memory" |
| 12 | The proxy limit of 40 MB stopped large uploads | Uploads go in parts of 16 MiB |
| 13 | A refresh from the year `rf` kept each old week of the ISO year `rf-1`. A week across the turn of the year kept the part of the earlier run. Without the file of `rf-1`, the first weeks of `rf` lost the days of December. Then `days_since_rain` started again at 60 | The refresh splits the weeks by date and keeps the old weeks that the files cannot give again. Read the step "weather checkpoints" |

LightGBM runs each boosting round, as `lightgbm.train`, also after a round
without a split. The next bag or column sample can still grow a tree.

The port also places the values of a week by the cell indices `(gy, gx)`.
The Python chain used the row order of a table and a reshape. The result is
the same only when the rows are in raster order.

## Memory

The service has the limit `memoryMax` (default 6 GB). The API needs little.
Training and rendering need most. These rules keep the use low:

- The prediction of a week works in chunks of 200,000 rows. Only one chunk of the input matrix is in memory.
- The weather extraction computes two checkpoints at a time. Each holds about one year of daily cell means.
- A run reads the trees grid, the site grid and the tree scales once and shares them between the species and the layers. The tree scales hold only the columns of the models of the run.
- The maps read only the weather checkpoints of the model features, for example `pr`, `tas` and `tasmin`. The layers read their own checkpoints; these are all twelve.
- A run keeps one weather cube at a time. It removes the cube of the maps before it reads the cube of the layers. It also removes the tree scales of the training and of the maps when no later step needs them.
- The tree map goes through GDAL in tiles of 50 km.
- A fine layer keeps one float field of one block in memory. Large tile pyramids go to disk, not to memory.
- An upload goes to disk part by part. The service does not keep a part in memory.
- LightGBM uses the default thread count of the library.

If a run stops with an out-of-memory error, increase `memoryMax`.
