# PMTiles archive for the offline map

`deutschland.pmtiles` is at
`https://kinoko.reutlingen.university/karte/deutschland.pmtiles`. For each area, the
app gets the tiles from it with HTTP range requests. It keeps them in
IndexedDB (F2b). Caddy serves range requests with `file_server`. Read
`docs/operations.md`.

```
./bauen.sh        # builds arbeit/deutschland.pmtiles, takes about 20 min
./hochladen.sh    # rsync to /var/www/pilze/karte, then a range test and a show test
```

The two scripts get their tools with `nix run`: `jdk21` for Planetiler and
`pmtiles` for the tests. Planetiler is not in nixpkgs. Thus `bauen.sh`
downloads the jar of a fixed version and checks its SHA-256 sum.

## Source

The tiles come from the Geofabrik extract of Germany.
[Planetiler](https://github.com/onthegomap/planetiler) builds them with the
profile OpenMapTiles. The arguments in `bauen.sh` are those of OpenFreeMap
(`tilegen/tilegen_lib/planetiler.py`), but with `--area=germany`. Thus the
tiles have the same schema and the same fields as the online map. The styles
"liberty" and "dark" draw the same map offline and online.

Two arguments are different, to keep the archive below 3 GB. Neither changes
the image:

| Arguments | Reason | Size |
| --- | --- | --- |
| As OpenFreeMap | 84 languages, feature IDs | 3.25 GB |
| `--languages=de,en` | The styles read only `name:latin` and `name:nonlatin` for the labels. The app uses de and en | 3.12 GB |
| And `--exclude-ids` | Only a map that sets `feature-state` needs feature IDs. The base map only draws | 2.86 GB |

With these arguments, Germany up to zoom 14 has 256,641 tiles. The largest
tile is 373 kB.

We did not use two other methods:

- **Download from OpenFreeMap.** OpenFreeMap gives only the full planet, as a Btrfs image or as MBTiles. That needs 300 GB. It gives no PMTiles and no extract of one country. But `pmtiles extract` needs a PMTiles archive at the source.
- **Protomaps.** The daily planet builds allow `pmtiles extract --bbox`. That is the shortest method. But Protomaps has its own schema and its own style. Then the app would show a different map offline, or the frontend would have to change the style.

## Licence and attribution

| Part | Licence |
| --- | --- |
| Map data (OSM extract, water areas, lake lines) | ODbL 1.0 |
| Natural Earth (borders and places at small zoom levels) | Public Domain |
| Schema OpenMapTiles | BSD-3-Clause |
| Planetiler | Apache-2.0 |
| Styles "liberty" and "dark", sprites, fonts | OpenFreeMap, MIT |

The ODbL requires a reference to the source. The map shows the same line
online and offline:

```
Stil: OpenFreeMap · © OpenMapTiles · Daten © OpenStreetMap-Mitwirkende
```

Offline, only the tiles come from this archive. The style, the sprites and
the fonts come from OpenFreeMap. The service worker keeps them.

## Renewal

The base map changes slowly. A new forest path or a new building does not
change a forecast. Two runs each year are sufficient: before the season in
spring and in late summer.

A new run needs a new OSM extract. `bauen.sh` keeps the sources, so a second
attempt does not download the 5 GB again. For a new version, delete the
extract first:

```
rm tools/pmtiles/arbeit/data/sources/germany.osm.pbf
./bauen.sh && ./hochladen.sh
```

`hochladen.sh` copies without `--delete` and renames at the target. Thus a
client that loads at that time sees the old archive or the new archive. An
area that is already in IndexedDB stays valid until the user updates it under
Konto, Offline.
