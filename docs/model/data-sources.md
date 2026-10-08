# Data sources

This file is a research note. It lists each source, its licence and the
access to it. "Open" means that you need no account.

The note names scripts of the earlier research chain in Python (`modell/`).
The repository does not hold that code any more. For the sources that the
service uses, read `docs/pipeline.md`.

## Occurrence records

### GBIF: in use

The download covers Germany, kingdom Fungi, human observations, with
coordinates and without a geospatial issue. The total is 746,827 records
(read on 2026-09-06).

These three datasets hold the observations:

| Dataset | Records | Licence |
|---|---|---|
| NABU\|naturgucker | 272,400 | CC-BY 4.0 |
| iNaturalist research-grade | 225,784 | CC-BY-NC 4.0 |
| Observation.org | 202,109 | CC-BY-NC 4.0 |

Access: open, no account. The earlier script `gbif_fetch.py` used the public
search API. The service uses the same API in its fetch runs. That API gives at
most 100,000 records for one query. Thus the fetch divides the request by
year, and a large year by month.

An account gives access to the download API. That route gives a full Darwin
Core archive and a DOI that you can cite. Use it when you publish results. The
service accepts such an archive as the upload `gbif-archive`.

Know two things about the data:

- The kingdom Fungi includes lichens. Lichens do not fruit by season. Remove them from the fruiting model, but keep them in the effort background.
- The fetch replaces the observer name with a SHA-256 hash. The model needs the identity of an observer, but not the name.

Some records are not useful for fruiting: soil metabarcoding samples (about
300,000 records from the Biodiversity Exploratories) and herbarium specimens.
The filter `basisOfRecord=HUMAN_OBSERVATION` removes them.

### pilze-deutschland.de (DGfM): request sent

This source has about 4.5 million records and more than 14,500 species. It is
the best fungal dataset for Germany. It goes back much further than the app
portals, and experts check the identifications.

Access: not open. Do not scrape the site. The draft request is in
`correspondence/01-dgfm-datenanfrage.md`.

Much of the older material uses the MTB-Quadrant grid, about 5.6 km by 6 km.
That grid sets the spatial resolution of each model on this source.

### Flora Incognita: request sent

Since 2025, the app identifies about 3,000 lichen and fungus species, next to
30,000 vascular plants and about 500 mosses.

Access: not open. Flora Incognita is not a GBIF publisher. The FAQ describes
only a personal CSV or GPX export. GBIF has an open request for this data at
https://github.com/gbif/data-mobilization/issues/176, without a reply.

The fungus support is one year old, so the data covers one season. Use this
source later, not for the first model. The draft request is in
`correspondence/02-flora-incognita-datenanfrage.md`.

## Weather and soil moisture

### DWD HYRAS: in use

Daily grids for Germany at 1 km, from 1951. The earlier download covered 2010
to 2026 for six variables: precipitation, mean air temperature, minimum and
maximum air temperature, humidity and global radiation. One NetCDF file holds
one variable for one year, at 35 MB to 115 MB. The service fetches five of
these variables (not the global radiation) from 2014.

Access: open. https://opendata.dwd.de/climate_environment/CDC/grids_germany/daily/hyras_de/

### DWD soil moisture for each tree species: in use

Daily grids at 1 km, from 1991. The DWD models them separately for stands of
spruce, beech, oak and pine. There are several soil layers. The download uses
the layer 0 to 30 cm, which holds most of the mycorrhizal mycelium.

This is the most valuable weather layer for this project. The host tree sets
which mycorrhizal fungi can fruit at a site. A soil moisture field for each
tree species agrees with that better than one general field.

Access: open. Each file covers one species, one year and one layer, at about
140 MB.
https://opendata.dwd.de/climate_environment/CDC/grids_germany/daily/soil_moisture/

### Other DWD grids: available, not in use

Potential evapotranspiration (`evapo_p`) and soil temperature at 5 cm
(`soil_temperature_5cm`) are open. Both come as monthly .tgz archives.
Precipitation minus potential evapotranspiration gives a water balance. A
water balance often predicts fruiting better than rain alone.

### ERA5-Land: needs an account

Hourly reanalysis at about 9 km, from 1950, with four soil moisture layers.
It needs a free Copernicus CDS account and an API key. In Germany, the DWD
grids are better. Thus ERA5-Land is useful only to extend the model past the
German border.

## Static site properties

### Copernicus DEM GLO-90: in use

Elevation at 90 m. The earlier download covered 94 tiles of the German
bounding box, 342 MB. Elevation, slope and aspect all move the local fruiting
date. The service accepts these tiles as the upload `dem`.

Access: open, from the AWS open-data bucket. No account.
https://copernicus-dem-90m.s3.amazonaws.com/

### SoilGrids 250 m (ISRIC): in use

Clay, sand, silt, pH, organic carbon, bulk density, coarse fragments and
nitrogen, for three depth layers. The web coverage service cuts the German
area and gives a GeoTIFF of about 10 MB. The service accepts these files as
the upload `soilgrids`.

Access: open, no account. https://maps.isric.org/

### OpenStreetMap, Germany extract: in use in the earlier chain

OpenStreetMap tags forest polygons with `leaf_type`. This tag separates
broadleaved cover from needleleaved cover. The forest mapping of Germany is
good. This source replaced the Copernicus forest-type layer, which needs an
account. The earlier chain also cut the outline of Germany from this extract.
The service takes the outline from the upload `germany-outline`.

Access: open. https://download.geofabrik.de/europe/germany-latest.osm.pbf
Use `osmium-tool` to cut out the forest polygons.

### BGR BÜK200: available as a map service

The German soil map at 1:200,000. The WMS at
https://services.bgr.de/wms/boden/buek200/ answers without an account. But a
WMS gives pictures, not soil classes. SoilGrids gives real values for the same
need. Use BÜK200 only if you need the German soil-type classes.

### Copernicus HRL forest layers: needs an account

Tree cover density and dominant leaf type at 10 m. This is better than
OpenStreetMap for forest composition, but the download needs a free
Copernicus Land account. Get one if the OpenStreetMap layer is too coarse.

### Thünen dominant tree species: in use

Dominant tree species for Germany 2017/2018 at 10 m, in 11 classes. The grid
covers the German forest area in EPSG:32632, 64076 by 86147 pixels. Value 0
is no data. The class codes are:

| Code | Class |
|---|---|
| 2 | birch |
| 3 | beech |
| 4 | Douglas fir |
| 5 | oak |
| 6 | alder |
| 8 | spruce |
| 9 | pine |
| 10 | larch |
| 14 | fir |
| 16 | other deciduous, high life expectancy |
| 17 | other deciduous, low life expectancy |

The service accepts this map as the upload `tree-species-map`.

Access: open, no account. Web coverage service at
https://atlas.thuenen.de/geoserver/ows, coverage `geonode__Dominant_Species_Class`.

Licence: Creative Commons Attribution 4.0 International (CC BY 4.0),
https://creativecommons.org/licenses/by/4.0/. The licence permits public tiles
and derived products for each purpose. It requires credit, a link to the
licence and a note about our changes. The app shows the credit in the licence
list.

Credit line:

    Blickensdörfer L, Oehmichen K, Pflugmacher D, Kleinschmit B, Hostert P
    (2022) Dominant Tree Species for Germany (2017/2018) [Datensatz].
    Johann Heinrich von Thünen-Institut (ed) Thünen-Atlas OGC Web Services:
    https://atlas.thuenen.de/geoserver/ows

## Citation

The European extract in use from 2026-09-06 has a DOI. Cite it as:

    GBIF.org (6 September 2026) GBIF Occurrence Download
    https://doi.org/10.15468/dl.9sapgr

It holds 5,911,058 human observations of fungi with coordinates from 2014.
The countries are Germany, Austria, Switzerland, the Netherlands, Belgium,
Luxembourg, Denmark, Czechia, Poland and France. The simple CSV is 681 MB.

The earlier pull for Germany only came from the search API. Thus it has no
DOI. Use this download for each publication.
