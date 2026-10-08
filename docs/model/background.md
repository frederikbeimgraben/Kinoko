# Pilze: fruiting forecast for German macrofungi

This file is a research note. It describes the earlier research chain in
Python (`modell/`, with the scripts under `src/pilze/`). The repository does
not hold that code any more; it is in the Git history. The Go pipeline in
`backend/internal/pipeline` ports the recurring steps of the chain. For the
pipeline of the service, read `docs/pipeline.md`.

The model answers one question: in which week, and in which part of Germany,
does a given mushroom species fruit?

The model joins three kinds of data:

1. Occurrence records of fungi with a coordinate and a date.
2. Daily weather and soil moisture on a 1 km grid.
3. Static site properties: elevation, soil and forest composition.

## The central design decision

Citizen-science records do not measure fruiting. They measure reports. The
record count for Germany went from about 10,000 in 2012 to about 152,000 in
2025. That increase comes from more app users, not from more mushrooms.
Records also collect near towns, near paths and on weekends.

The project uses a target-group background for this problem. The model does
not predict "a fungus is present here". It predicts:

    P(target species | somebody reported any fungus in this cell this week)

All fungal records are the background. Observer effort is in the numerator
and in the denominator, so it mostly cancels. This is more important than the
choice of model architecture.

## The data volume sets the limits

GBIF holds 746,827 human observations of fungi with coordinates in Germany.
For each species, the numbers are much smaller:

| Species | Records in Germany |
|---|---|
| Macrolepiota procera | 6,148 |
| Boletus edulis | 4,659 |
| Imleria badia | 4,440 |
| Cantharellus cibarius | 2,174 |
| Leccinum scabrum | 1,553 |
| Craterellus cornucopioides | 658 |

A grid of 1 km cells and weekly steps gives about 280 million cell-weeks in
15 years. About 4,000 of them hold a Boletus edulis record. A sequence model
on that grid learns to predict zero.

This has two results:

- Put species into groups that share a host tree and a habitat.
- Start with gradient boosting on lagged weather features, not with an LSTM. Use a sequence model only after the simple model works.

## Validation

Use blocked cross-validation. Hold out full years, and hold out full regions.
A random split gives a high score that has no meaning. Two persons who report
the same flush make rows that are almost the same.

## Layout of the earlier chain

    src/pilze/gbif_fetch.py     occurrence records from GBIF
    src/pilze/dwd_fetch.py      DWD 1 km daily grids
    src/pilze/static_fetch.py   elevation, soil, OpenStreetMap extract
    src/pilze/taxonomy_fetch.py class, order, family and genus of the catalogue
    correspondence/             data-request emails, drafts
    docs/data-sources.md        each source, with licence and access notes
    data/raw/                   downloads, not in version control

In the Go service, the fetch runs replace `gbif_fetch.py` and `dwd_fetch.py`.
The uploads `dem`, `soilgrids` and `germany-outline` replace
`static_fetch.py`.

## Start of the earlier chain

The fetchers used only the Python standard library. They ran with Python 3.11
or later:

    python src/pilze/gbif_fetch.py --out data/raw/gbif --start 1970 --end 2026
    python src/pilze/taxonomy_fetch.py --profiles ../backend/daten/arten \
        --out ../backend/daten/taxonomie.json --cache data/raw/taxonomie
    python src/pilze/dwd_fetch.py hyras --start 2010 --end 2026
    python src/pilze/dwd_fetch.py soil --start 2010 --end 2026 --depth 0-30
    python src/pilze/static_fetch.py dem
    python src/pilze/static_fetch.py soil
    python src/pilze/static_fetch.py osm

Each fetcher skipped a file that was present. Thus you could stop a fetcher
and start it again.

The analysis steps used the Nix shell of `modell/`. It gave numpy, pandas,
xarray, netCDF4, geopandas, rasterio, LightGBM, GDAL and osmium. On NixOS, do
not install numpy with pip. The wheel cannot find libstdc++, and the import
fails.

## The first app and the find server

This section describes the first prototype of the app. The Angular app in
`frontend/` and the Go service replace it.

The page had four parts, with one navigation: the map, the species catalogue,
the reported finds and an information page. On a phone, the controls were in
a sheet that moved up from the bottom. On a larger screen, they filled a
column on the left. The files were `src/pilze/web/index.html`, `app.css` and
`app.js`. `build_page.py` filled them with the manifests and the catalogue.

The catalogue in `src/pilze/katalog.py` held one profile for each species.
A profile told what to look at, where the species grows and what it can be
confused with. It also gave the law and the season curve from the training
finds. The profiles were written
for this project. Each profile linked to the detail page of 123pilzsuche.de,
when one existed, and to Wikipedia. They are not an identification key.

The page was a progressive web app. A phone installed it from the browser
menu. The service worker kept the page, the Leaflet library and the tiles that
the person saw. Thus the map opened in the forest without a signal. A find
reported without a signal waited in the browser. It went to the server when
the connection came back.

Two functions of the page went past the forecast:

1. **Fund melden.** A visitor with the access code set a marker on the map or used the phone position. The visitor gave the species, the date and a name, and the find went to the server. Reported finds showed as orange markers for each species. Each person with the code could remove one. The finds were exact positions and were visible only with the code.
2. **Kombination.** The input layers and the forecast used one tile grid. Thus the browser could read several of them for the same tile. It combined them point by point with the geometric mean, the minimum or the weighted mean. Each layer had a direction and a weight. This answers a question that the model does not ask. An example: "beech within 1 km, rain of the last four weeks, and the forecast".

The server was `src/pilze/api.py`: standard library only, one SQLite file. It
ran behind Caddy on the homeserver under `/api/`. It made the access code at
the first start and wrote it to the journal:

    journalctl -u pilze-api | grep Zugangscode

For a local test, the script also served the map folder:

    python src/pilze/api.py --static reports/maps --port 8111

## The input layers

The input layers show what the model got, next to what it concluded. In the
earlier chain, `input_layers.py` drew them. In the Go service, the step
"render layers" draws the weekly layers.

Two static layers describe the place. The chain drew them once. Fifteen weekly
layers describe the weather and follow the week slider. Each layer has a unit
and the two ends of its scale. Thus the factor screen can put a value on a
handle. The thirteen layers with a finer source came from `fine_layers.py`.
`input_layers.py` kept them in the manifest.

The weather is on 5 km cells. `coarse_inputs.py` filtered it with a Gaussian
kernel of half a cell and read it at the 500 m cell centres. Thus neither the
layer nor the forecast shows the 5 km cell. A sharp input keeps its own value:
the forest share, the tree shares, the height, the soil and the visit prior
are not in `COARSE_INPUTS`. All the weather comes from the DWD grids: HYRAS
for rain, temperature and humidity, and the DWD soil moisture for each tree
species.

| Layer | Content | Unit |
|---|---|---|
| `regen`, `regen_2w`, `regen_4w`, `regen_8w` | Rain of the week and of the last 2, 4 and 8 weeks | mm |
| `regen_anomalie` | Rain of the last 4 weeks against the normal of that cell and week | mm |
| `regen_tage_seit` | Days since the last day above 5 mm, at most 60 | days |
| `temperatur`, `temperatur_min`, `temperatur_max` | Mean, lowest and highest of the week | °C |
| `temperatur_2w`, `temperatur_4w` | Mean of the last 2 and 4 weeks | °C |
| `frosttage` | Days of the week below 0 °C | days |
| `hitzetage` | Days of the week above 25 °C | days |
| `luftfeuchte` | Relative humidity of the week | % |
| `bodenfeuchte` | Plant available soil water, mean of spruce, beech, oak and pine | % of usable field capacity |

Three of them are questions about days. No weekly reduction can answer them:
the count of frost days, the count of hot days, and the time since the last
rain. The weekly table holds the sum, the mean, the minimum and the maximum of
a week. None of those is a count of days. `tagesmasse.py` answered them on the
daily grid. `extract_grids.py` then reduced the result to weeks, as for each
other variable. Each test uses the cell mean of the day. Thus a frost day of a
5 km cell is a day whose mean minimum was below zero.

The scale of a layer comes from the 1st and the 99th percentile of all
rendered weeks. Thus one colour ramp fits the full year. Three layers get
their scale from their definition: a week has seven days, and the days since
the last rain stop at 60. Without this rule, a run in summer only would show
no frost day and thus no scale.

## The layers with a fine source

`fine_layers.py` drew each layer whose source is finer than the map grid. It
ran once, not each week. In the Go service, the processing of the uploads
`tree-species-map`, `dem` and `soilgrids` draws these layers.

`pyramid.py` held the rule for each layer. The step of the source sets the
finest zoom. Each coarser level is the weighted mean of the four tiles above
it. A point has the area behind it as its weight. Thus the area mean is the
same on each level.

| Layer | Source | Step | Zoom |
|---|---|---|---|
| `wald` | Thünen dominant tree species | 10 m | 5 to 14 |
| `fichte`, `buche`, `eiche`, `birke`, `kiefer`, `nadelholz` | The same map | 10 m | 5 to 14 |
| `hoehe`, `hangneigung`, `nordexposition` | Copernicus DEM GLO-90 | 90 m | 5 to 12 |
| `boden_ph`, `boden_sand`, `boden_kohlenstoff` | SoilGrids | 250 m | 5 to 10 |

A tree species is the share of the class in the forest area of that point.
Ground without forest has no value. The forest share is the share of the
ground, so it is 0 outside the forest. Outside Germany it has no value. The
step cuts the outline of Germany and burns it onto the grid of each block. The
earlier chain took the outline from the OpenStreetMap extract. The Go service
takes it from the upload `germany-outline`.

In the earlier chain, the step ran in the geo shell. It asked the tree
species service block by block and waited between blocks. It wrote a state
file, so a new run continued where the last run stopped:

    nix develop .#geo --command python src/pilze/fine_layers.py

The arguments were:

- `--only`: a list of layers.
- `--bbox west,south,east,north`: a test on a small area.
- `--block-tiles`: the size of a block.
- `--pause`: the wait between blocks.
- `--restart`: discard the state file.
 The tiles went next
to the other layers in `reports/maps/layers_kacheln/<name>`.

The manifest of such a layer has two more levels:

- `haveZoom` is the last level whose tiles the manifest lists one by one. Above it, the app asks for the coarser tile at the same place. A full list of the finest tiles would make the manifest too large.
- `offlineZoomTo` is the finest level that an offline area keeps.

The layers on the map grid get their zoom span from the same function
`finest_zoom`. A step of 500 m gives zoom 5 to 9. The default limit is zoom 13.

## The forecast horizons

A horizon is the distance in weeks between the last week with weather and the
week of the answer. Horizon 0 serves a week in the past. A larger horizon
hides each column that needs unknown data: a weather lag below the horizon,
each rolling window, each anomaly and each temperature drop.

| Horizon | Weather columns |
|---|---|
| 0 | 35 |
| 1 | 18 |
| 2 | 15 |
| 3 | 12 |
| 4 | 9 |

The chain builds the horizons 0 to 4. Above 4, only two lags stay. Thus the
chain stops there. The Go code keeps this rule in `pipeline/core/horizons`.

The map selects the horizon of each week from its distance to the last week
with weather. It takes the smallest horizon that is at least that distance.
Thus the model reads no column that the week does not have. If no such horizon
exists, the run stops and names the missing horizon.

The forecast reaches two weeks past the last week of the weather table. It
stops at the largest horizon that each model of the run has.

A forecast week has no weather. The lags of the past weeks go into it, and the
horizon hides the rest. Thus the weekly input layers have no forecast week.

## Training the horizon models

A bundle holds one model for each horizon. A new horizon needs a new visit
table. The training stops when the activity columns of a horizon are missing.

In the earlier chain, `NEU=1 ./run_all.sh` trained all species. For each
species it ran `visit_model.py --save-prepared` and then `final_model.py`.
These are the times of the earlier chain:

| Step | One species | Eleven species |
|---|---|---|
| `visit_model.py`, necessary for a new horizon | 23 to 29 min | about 5 h |
| `final_model.py`, five horizons | about 30 min | about 4 h |
| Sum | | **about 9 h** |

Two shells in parallel made this about 4.5 h. Each bundle gets about 1.2 MB
larger for each horizon. Thus the eleven models go from 28 MB to about 55 MB.

In the Go service, a `training` or `full` run trains each forecast species.
Read `docs/pipeline.md`.

Memory: `region_map.py` held one float32 matrix of 2.3 million cells for each
horizon that a week used. A run over Germany thus stayed near the value of a
run with two horizons. A list of 90 weeks uses horizon 0 and the two to four
forecast horizons, not all five. The Go render predicts in chunks and does not
hold the full matrix.

## The manifests

Each rendered map writes a manifest next to its tiles: `<slug>.json` for each
species, `layers.json` for the input layers. Next to the tile names, each
entry has a histogram of its values in Germany. The factor screen of the app
shows that distribution with two handles. The browser cannot count 2.3
million cells for each week, and a value tile holds only one byte per point.

    "histogram": {"classes": [41 edges], "shares": [40 shares]}

- There are forty classes on the scale of the entry: `low` to `high` in the unit of the layer, `0` to `top` for a forecast. Thus a handle points to metres, to a pH or to a probability.
- `classes` holds 41 edges, not 40 lower edges. The screen shows the upper edge of the last class. It must not come from a subtraction in the browser.
- The sum of `shares` is 1. Each point covers the same 500 m by 500 m in an equal-area projection. Thus a share is a share of the area. A point without data does not count. A value outside the scale goes into the outer class, as in the value tile.
- A weekly layer keeps its histograms in `histograms`, a map from the week key to the histogram, next to `weeks`. `weeks` stays a list of week keys. The cleanup deletes each tile folder that is not in it.
- A forecast keeps its histogram in the week entry, `weeks[i].histogram`.

The renderer counts while it still holds the field. In the earlier chain,
`week_stats.py` filled the histograms of old manifests. The Go service always
writes the histograms.

## Tests of the earlier chain

    nix develop . --command python -m pytest tests

The Go pipeline has golden tests. They compare its results with results of the
earlier chain in the `testdata` folders.

## Legal and ethical limits

The iNaturalist and Observation.org records have a CC-BY-NC licence. They are
satisfactory for research and for a private tool. They are not satisfactory
for a commercial product.

Boletus edulis and Cantharellus cibarius are "besonders geschützt" under the
Bundesartenschutzverordnung. Collection is legal only in small quantities for
personal use.

Do not publish exact locations of rare or protected species. A public map must
use a coarse grid of 5 km or more. This also shows the true accuracy of the
model.
