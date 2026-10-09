# Seed data

This folder holds the seed data of the catalogue. The service imports these
files into a new database.

## Warning: the data is not verified

- The data in this folder is not verified. It is not complete.
- Do not use this data to decide if you can eat a mushroom. Only a mushroom
  expert can make that decision. An expert must examine the mushroom.
- The data can contain errors in the edibility, the toxicity, the lookalikes,
  the colours, the reactions and in all other fields.
- The project owner will examine all entries in the admin UI. Until then, use
  the data only to develop and test the app.

## Files

| File | Content |
|---|---|
| `arten/*.toml` | One profile for each species: names, edibility, features, colours, measurements, lookalikes and sources. |
| `reaktionen.json` | The reactions of the species to reagents, with their sources. |
| `glossar.json` | The glossary seed, in German and in English. |
| `taxonomie.json` | The genus, family, order, class and division of each species. |
| `saison.json` | The season table: visits and finds for each calendar week. |
| `texte.json` | The texts of the user interface, in German and in English. |

## Sources and licences

The files give these sources. Where a file or a document of this repository
gives no licence, this list says "not stated". In that case, examine the
terms of the source before you publish or share the data.

| Data | Source | Licence |
|---|---|---|
| Species profiles (`quelle`, 306 profiles) | 123pilzsuche.de, https://www.123pilzsuche.de/ | Not stated |
| Further links of the profiles (`links`) | 123pilzsuche.de and Wikipedia (de.wikipedia.org) | Not stated |
| Protection status (`schutz.quelle`) | Bundesartenschutzverordnung (BArtSchV), Anlage 1 | German federal law |
| Trees from experience (`baeumeAusErfahrung.quelle`) | Own experience of the project owner | Not stated |
| Reactions (`reaktionen.json`) | "Pilz-Reagenzien – Merkzettel" (2026-10-08). Each reaction names its sources in `sources`: for example mushroomexpert.com, Wikipedia, 123pilzsuche.de, mycodb.fr, first-nature.com, mycopedia.ch and mykoweb.com. | Not stated |
| Taxonomy (`taxonomie.json`) | GBIF species match API (https://api.gbif.org/v1/species/match) for the classification, 123pilzsuche.de for the German names | Not stated |
| Season table (`saison.json`) | The pipeline calculates it from GBIF occurrence records. `docs/model/data-sources.md` gives the licences of the GBIF datasets (CC BY 4.0 and CC BY-NC 4.0). | Per dataset |
| Glossary (`glossar.json`) | Kinoko glossary, written for this project | Not stated |
| Texts (`texte.json`) | Written for this project | Licence of the repository |

## Correct the data

Do not edit the seed files by hand while a database holds newer data. Use
this procedure:

1. Correct the data in the app: Verwaltung (admin UI).
2. Export the catalogue: `kinoko export-catalog --out backend/daten`.
3. Examine the difference with `git diff backend/daten`.
4. Commit the new seed files.

`docs/operations.md` ("Export the catalogue") describes the command.
