# Forecast species

The tool `backend/tools/gbifcount` writes this file. Do not change it by hand.
Run the tool again to update it.

## What a species needs

A species gets a forecast when its file in `backend/daten/arten` has `karte`.
The import then sets `forecast_enabled`. Each training run trains one model for each such species.
The training of a species fails in these conditions:

- The visit table has fewer than 100 positive visits (`visits.MinPositives`). A visit is one observer, on one day, in one square kilometre. A visit counts only with at least 2 species (`visits.MinSpecies`).
- The year scheme or the space scheme gives no fold. The test part of a fold needs 100 rows (`train.MinFoldRows`) and 10 positive visits (`train.MinFoldPositives`).

The training reads the records from 2015 (`visits.MinYear`). A record must have a coordinate error of at most 500 m, or no coordinate error (`occ.TrainingSet`).
The five horizons (0 to 4 weeks) use the same visit table. Thus the horizons add no condition.

## Threshold

The threshold is 1000 records.

The count of GBIF records is larger than the count of positive visits:

- A record without an observer gives no visit.
- A visit with only the target species does not pass the gate.
- Two records of one visit give one positive visit.

The threshold assumes that at least one record in five gives a positive visit.
Then a species at the threshold has about 200 positive visits. The minimum is 100.
The margin also helps the folds: each year and each 100 km band needs 10 positive visits to give a fold.

The tool turns the forecast on for a species without `karte` only when all these conditions are true:

- GBIF matches the Latin name to a species of the class Agaricomycetes. The occurrence step keeps only this class.
- The GBIF species name is the Latin name of the catalogue. The chain finds its records by this name.
- The count is at least the threshold.

The new `karte` value is the Latin name in lower case with underscores, for example `boletus_edulis` (`sources.ChainKey`).
A species without a row in `species_forecast` trains with `sources.DefaultChain`: this key and the Latin name as its taxon.
A species that is a taxon of a chain in `sources.Chains` counts the taxa of that chain.
A species with `karte` keeps it, also below the threshold.

An existing database keeps its forecast flags. Run `kinoko import-catalog`, or set the flags in the admin area.

## Count

The tool asks `api.gbif.org/v1/species/match` for the GBIF key of the Latin name.
Then it asks `api.gbif.org/v1/occurrence/search` with `limit=0` for the count, with the filter of the GBIF fetch (`gbif.Filter`):

- `country=DE`, `hasCoordinate=true`, `hasGeospatialIssue=false`, `basisOfRecord=HUMAN_OBSERVATION`, `occurrenceStatus=PRESENT`
- `taxonKey` = the species key of the match. GBIF then also counts the synonyms.
- `year` = 2015 to the year of the query.

The count is all these records minus the records with `coordinateUncertaintyInMeters` above 500 m.
GBIF filters by calendar year and the training by ISO year. Thus a few records at the start of 2015 can differ.

## Run the tool again

```
cd backend
nix develop ..#backend -c go run ./tools/gbifcount -cache /tmp/gbifcount.json
nix develop ..#backend -c go run ./tools/gbifcount -cache /tmp/gbifcount.json -apply
```

The first command writes this file only. The second command also sets `karte` in the species files.
With `-cache`, the second command sends no request. `-min` sets a different threshold.
The tool waits `-pause` (1 s) before each request. After an HTTP 429 it waits at least 30 s.
A run without cache sends about 900 requests.

## Species

Query date: 2026-10-09. Species: 306. With forecast: 36. Of these, 13 have a chain in `sources.Chains`.

The rows follow the order of the file names.

| Species | Latin name | GBIF key | Records | Forecast | Note |
| --- | --- | ---: | ---: | --- | --- |
| Ackerschirmpilz | *Macrolepiota excoriata* | 2536733 | 63 | no | below the threshold |
| Ästiger Stachelbart | *Hericium coralloides* | 5248532 | 861 | no | below the threshold |
| Anhängselröhrling | *Butyriboletus appendiculatus* | 8250249 | 56 | no | below the threshold |
| Aprikosen-Gelbfuß | *Chroogomphus fulmineus* | 2524969 | 0 | no | below the threshold |
| Austernseitling | *Pleurotus ostreatus* | 2526530 | 3028 | yes (`pleurotus_ostreatus`) |  |
| Bauchwehkoralle | *Ramaria mairei* | 5238518 | 26 | no | GBIF species is Ramaria pallida; the records do not carry the catalogue name |
| Becherförmiger Sägeblättling | *Neolentinus cyathiformis* | 8188469 | 6 | no | below the threshold |
| Bergporling | *Bondarzewia mesenterica* | 2552020 | 21 | no | below the threshold |
| Berindeter Seitling | *Pleurotus dryinus* | 2526564 | 109 | no | below the threshold |
| Beutelstäubling | *Lycoperdon excipuliforme* | 5243279 | 852 | no | below the threshold |
| Birken-Rotkappe | *Leccinum versipelle* | 2524490 | 181 | no | below the threshold |
| Birkenpilz | *Leccinum scabrum* | 9141390 | 1160 | yes (`birkenpilz`) |  |
| Birkenspeitäubling | *Russula betularum* | 2551413 | 78 | no | below the threshold |
| Birnenstäubling | *Apioperdon pyriforme* | 10852503 | 3549 | yes (`apioperdon_pyriforme`) |  |
| Blassgelber Täubling | *Russula raoultii* | 2551464 | 4 | no | below the threshold |
| Blaufleckender Purpurröhrling | *Imperator rhodopurpureus* | 8352057 | 1 | no | below the threshold |
| Wechselblauer Edelreizker | *Lactarius quieticolor* | 5248728 | 39 | no | below the threshold |
| Bleicher Schüppling | *Pholiota squarrosoides* | 3343759 | 7 | no | below the threshold |
| Bleiweißer Firnistrichterling | *Clitocybe phyllophila* | 2531103 | 44 | no | below the threshold |
| Bocksdickfuß | *Cortinarius camphoratus* | 2529076 | 36 | no | below the threshold |
| Böhmische Verpel | *Verpa bohemica* | 5259057 | 60 | no | class Pezizomycetes; the occurrence table keeps only Agaricomycetes |
| Brätling | *Lactarius volemus* | 2551150 | 15 | no | GBIF species is Lactifluus volemus; the records do not carry the catalogue name |
| Brauner Stäubling | *Lycoperdon umbrinum* | 5243243 | 50 | no | below the threshold |
| Brauner Afterleistling | *Hygrophoropsis rufa* | 7705991 | 12 | no | below the threshold |
| Brauner Filzröhrling | *Xerocomus ferrugineus* | 7816100 | 54 | no | below the threshold |
| Brauner Haarstielporling | *Jahnoporus hirtus* | 2551714 | 0 | no | below the threshold |
| Braunschuppiger Wiesenchampignon | *Agaricus moellerianus* | 5243441 | 5 | no | below the threshold |
| Breitblättrige Glucke | *Sparassis brevipes* | 2550246 | 82 | no | below the threshold |
| Brennender Rübling | *Gymnopus peronatus* | 12092733 | 463 | no | GBIF species is Collybiopsis peronata; the records do not carry the catalogue name |
| Brennendscharfer Ritterling | *Tricholoma virgatum* | 5241830 | 7 | no | below the threshold |
| Beringter Schleimrübling | *Mucidula mucida* | 2537081 | 2959 | yes (`schleimruebling`) |  |
| Buchenspeitäubling | *Russula nobilis* | 2551208 | 347 | no | below the threshold |
| Büscheliger Egerlingsschirmling | *Leucoagaricus americanus* | 2535839 | 8 | no | below the threshold |
| Büscheliger Hexenröhrling | *Suillellus permagnificus* | 7531985 | 0 | no | below the threshold |
| Brauner Rasling | *Lyophyllum decastes* | 9173236 | 322 | no | below the threshold |
| Butterpilz | *Suillus luteus* | 7777157 | 1156 | yes (`suillus_luteus`) |  |
| Dickfüßige Morchel | *Morchella crassipes* | 2594612 | 0 | no | class Pezizomycetes; the occurrence table keeps only Agaricomycetes |
| Dorniger Stachelbart | *Hericium cirrhatum* | 5248548 | 249 | no | below the threshold |
| Dottergelber Klumpfuß | *Cortinarius meinhardii* | 12117301 | 0 | no | GBIF species is Calonarius meinhardii; the records do not carry the catalogue name |
| Duftender Goldporling | *Auriporia aurulenta* | 2543461 | 5 | no | below the threshold |
| Gemeiner Hallimasch | *Armillaria ostoyae* | 2536899 | 973 | no | below the threshold |
| Edelreizker | *Lactarius deliciosus* | 5248629 | 599 | yes (`reizker`) | below the threshold; the karte value stays |
| Eichenfeuerschwamm | *Fomitiporia robusta* | 2520459 | 157 | no | below the threshold |
| Eichenmilchling | *Lactarius quietus* | 5248616 | 325 | no | below the threshold |
| Eichenrotkappe | *Leccinum quercinum* | 2524513 | 217 | no | GBIF species is Leccinum aurantiacum; the records do not carry the catalogue name |
| Eichenzunge | *Piptoporus quercinus* | 2543301 | 2 | no | GBIF species is Buglossoporus quercinus; the records do not carry the catalogue name |
| Eichhase | *Polyporus umbellatus* | 5246840 | 72 | no | below the threshold |
| Elfenbeinröhrling | *Suillus placidus* | 5239925 | 22 | no | below the threshold |
| Ellipsoidsporige Stoppelpilz | *Hydnum ellipsosporum* | 2554704 | 1 | no | below the threshold |
| Gemeiner Erdritterling | *Tricholoma terreum* | 5241808 | 381 | no | below the threshold |
| Erlengrübling | *Gyrodon lividus* | 8972210 | 41 | no | below the threshold |
| Espen-Rotkappe | *Leccinum aurantiacum* | 2524513 | 217 | no | below the threshold |
| Falscher Anhängselröhrling | *Butyriboletus subappendiculatus* | 7819247 | 16 | no | below the threshold |
| Falscher Pfifferling | *Hygrophoropsis aurantiaca* | 2525710 | 2534 | yes (`hygrophoropsis_aurantiaca`) |  |
| Falscher Rotfußröhrling | *Xerocomellus porosporus* | 2519577 | 108 | no | below the threshold |
| Gelbhütiger Purpurröhrling | *Imperator luteocupreus* | 8074593 | 5 | no | below the threshold |
| Falscher Wiesenegerling | *Agaricus pseudopratensis* | 5243346 | 2 | no | below the threshold |
| Faltentintling | *Coprinopsis atramentaria* | 5242740 | 448 | no | below the threshold |
| Feuchtstellen-Schüppling | *Pholiota conissans* | 2534143 | 6 | no | below the threshold |
| Fichtenreizker | *Lactarius deterrimus* | 7925734 | 793 | yes (`reizker`) | below the threshold; the karte value stays |
| Fichtenrotkappe | *Leccinum piceinum* | 7942472 | 12 | no | below the threshold |
| Filziger Gelbfuß | *Chroogomphus helveticus* | 2524993 | 10 | no | below the threshold |
| Flacher Schillerporling | *Inonotus cuticularis* | 2521101 | 40 | no | below the threshold |
| Flämmiger Saftling | *Hygrocybe turunda* | 2538454 | 0 | no | below the threshold |
| Flammenstieltäubling | *Russula rhodopus* | 7239976 | 1 | no | below the threshold |
| Flaschenstäubling | *Lycoperdon perlatum* | 5243258 | 3131 | yes (`flaschenbovist`) |  |
| Fleischblättriger Egerlingsschirmling | *Leucoagaricus carneifolius* | 2535909 | 0 | no | below the threshold |
| Flockenstieliger Hexenröhrling | *Neoboletus erythropus* | 9723190 | 1753 | yes (`hexen_flock`) |  |
| Flockiger Tintling | *Coprinellus flocculosus* | 2534575 | 5 | no | below the threshold |
| Frauentäubling | *Russula cyanoxantha* | 2551542 | 737 | no | below the threshold |
| Frostrasling | *Lyophyllum decastes var. fumosum* | 9173236 | 322 | no | GBIF species is Lyophyllum decastes; the records do not carry the catalogue name |
| Frühlingschampignon | *Agaricus altipes* | 5243464 | 4 | no | below the threshold |
| Frühlingsrötling | *Entoloma vernum* | 2539539 | 5 | no | below the threshold |
| Fuchsiger Röteltrichterling | *Lepista flaccida* | 7978027 | 711 | no | GBIF species is Paralepista flaccida; the records do not carry the catalogue name |
| Rotbrauner Scheidenstreifling | *Amanita fulva* | 7765582 | 1223 | yes (`amanita_fulva`) |  |
| Fuchsrotkappe | *Leccinum vulpinum* | 2524528 | 5 | no | below the threshold |
| Gemeiner Gallenröhrling | *Tylopilus felleus* | 2524910 | 853 | no | below the threshold |
| Gallenstacheling | *Sarcodon scabrosus* | 9854176 | 4 | no | GBIF species is Hydnellum scabrosum; the records do not carry the catalogue name |
| Geflecktblättriger Flämmling | *Gymnopilus penetrans* | 2533692 | 982 | no | below the threshold |
| Gefleckter Gelbfuß | *Gomphidius maculatus* | 2525039 | 41 | no | below the threshold |
| Gelbe Koralle | *Ramaria flava* | 5238654 | 9 | no | below the threshold |
| Gelber Graustieltäubling | *Russula claroflava* | 2551299 | 284 | no | below the threshold |
| Gelber Hohlfußröhrling | *Suillus cavipes var. aereus* | 5239851 | 279 | no | GBIF species is Suillus cavipes; the records do not carry the catalogue name |
| Gelber Scheidenstreifling | *Amanita contui* | 5240211 | 1 | no | below the threshold |
| Gelbfleckiger Steinpilz | *Boletus fulvomaculatus* | 6016485 | 1 | no | below the threshold |
| Gelbgestiefelter Schleimkopf | *Cortinarius triumphans* | 7895491 | 27 | no | GBIF species is Phlegmacium triumphans; the records do not carry the catalogue name |
| Grüner Kammporling | *Albatrellus cristatus* | 5955077 | 29 | no | GBIF species is Laeticutis cristata; the records do not carry the catalogue name |
| Fleischfarbener Hallimasch | *Armillaria gallica* | 2536847 | 219 | no | below the threshold |
| Gelbstieliger Muschelseitling | *Panellus serotinus* | 11011338 | 848 | no | GBIF species is Sarcomyxa serotina; the records do not carry the catalogue name |
| Starkriechender Trompetenpfifferling | *Craterellus lutescens* | 8871787 | 28 | no | below the threshold |
| Gemeine Morchel | *Morchella vulgaris* | 8071344 | 54 | no | class Pezizomycetes; the occurrence table keeps only Agaricomycetes |
| Genabelter Semmelstoppelpilz | *Hydnum umbilicatum* | 2554706 | 6 | no | below the threshold |
| Gerandetknolliger Garten-Safranschirmling | *Chlorophyllum brunneum* | 5955380 | 73 | no | below the threshold |
| Gezonter Ohrlappenpilz | *Auricularia mesenterica* | 5249297 | 965 | no | below the threshold |
| Gifthäubling | *Galerina marginata* | 8118872 | 453 | no | below the threshold |
| Gilbender Erdritterling | *Tricholoma scalpturatum* | 5241821 | 193 | no | below the threshold |
| Fingerhutverpel | *Verpa conica* | 5499531 | 118 | no | class Pezizomycetes; the occurrence table keeps only Agaricomycetes |
| Glattstieliger Hexenröhrling | *Suillellus queletii* | 7888147 | 55 | no | below the threshold |
| Glattstieliges Stockschwämmchen | *Pholiota lignicola* | 2533974 | 4 | no | below the threshold |
| Goldporiger Röhrling | *Aureoboletus gentilis* | 2524374 | 15 | no | below the threshold |
| Goldröhrling | *Suillus grevillei* | 5239864 | 2333 | yes (`suillus_grevillei`) |  |
| Grasgrüner Täubling | *Russula aeruginea* | 2551173 | 140 | no | below the threshold |
| Graublättriger Trichterling | *Atractosporocybe inornata* | 8094873 | 3 | no | below the threshold |
| Graugrüner Dachpilz | *Pluteus salicinus* | 5241274 | 262 | no | below the threshold |
| Grauer Lärchenröhrling | *Suillus viscidus* | 5239873 | 174 | no | below the threshold |
| Graue Kraterelle | *Cantharellus cinereus* | 9226626 | 35 | no | below the threshold |
| Grauer Wulstling | *Amanita spissa* | 8935018 | 749 | no | GBIF species is Amanita excelsa; the records do not carry the catalogue name |
| Grauhäutiger Scheidenstreifling | *Amanita submembranacea* | 8391120 | 30 | no | below the threshold |
| Großer Kiefernschneckling | *Hygrophorus latitabundus* | 2538733 | 11 | no | below the threshold |
| Großsporiger Blutchampignon | *Agaricus langei* | 8336113 | 32 | no | below the threshold |
| Grossscheidiger Scheidenstreifling | *Amanita magnivolvata* | 5452669 | 1 | no | below the threshold |
| Grünblättriger Schwefelkopf | *Hypholoma fasciculare* | 3293632 | 6438 | yes (`hypholoma_fasciculare`) |  |
| Grünender Risspilz | *Inocybe aeruginascens* | 3331845 | 10 | no | below the threshold |
| Grüner Knollenblätterpilz | *Amanita phalloides* | 5240325 | 1660 | yes (`amanita_phalloides`) |  |
| Grüngefelderter Täubling | *Russula virescens* | 2551423 | 387 | no | below the threshold |
| Grüngelber Nabeling | *Chrysomphalina grossula* | 2538236 | 18 | no | below the threshold |
| Grünsporschirmling | *Chlorophyllum molybdites* | 5243168 | 0 | no | below the threshold |
| Habichtspilz | *Sarcodon imbricatus* | 5238865 | 94 | no | below the threshold |
| Hainbuchenröhrling | *Leccinellum pseudoscabrum* | 9712569 | 224 | no | below the threshold |
| Haselbrauner Schirmling | *Lepiota kuehneri* | 3340325 | 0 | no | below the threshold |
| Hasenstäubling | *Lycoperdon utriforme* | 10828425 | 844 | no | GBIF species is Bovistella utriformis; the records do not carry the catalogue name |
| Herbstrotfußröhrling | *Xerocomellus pruinatus* | 2519584 | 470 | no | below the threshold |
| Hohlfußröhrling | *Suillus cavipes* | 5239851 | 279 | no | below the threshold |
| Honiggelber Hallimasch | *Armillaria mellea* | 2536891 | 566 | no | below the threshold |
| Horngrauer Rötelritterling | *Lepista panaeolus* | 5242063 | 16 | no | below the threshold |
| Hügelschwindling | *Marasmius collinus* | 9137624 | 2 | no | below the threshold |
| Igelstachelbart | *Hericium erinaceus* | 5248508 | 81 | no | below the threshold |
| Igelstäubling | *Lycoperdon echinatum* | 5243255 | 329 | no | below the threshold |
| Isabellfarbiger Wulstling | *Amanita eliae* | 5240246 | 12 | no | below the threshold |
| Glatter Ohrlappenpilz | *Auricularia auricula-judae* | 5249271 | 7316 | yes (`auricularia_auricula-judae`) |  |
| Jungfernschirmling | *Leucoagaricus nympharum* | 2535788 | 4 | no | below the threshold |
| Käppchenmorchel | *Mitrophora semilibera* | 2594649 | 305 | no | class Pezizomycetes; the occurrence table keeps only Agaricomycetes |
| Karbol-Champignon | *Agaricus xanthodermus* | 5243412 | 487 | no | below the threshold |
| Kegelhütiger Knollenblätterpilz | *Amanita virosa* | 5240323 | 79 | no | below the threshold |
| Kerbrandiger Napfbecherling | *Tarzetta cupularis* | 7791739 | 9 | no | class Pezizomycetes; the occurrence table keeps only Agaricomycetes |
| Kiefernspeitäubling | *Russula silvestris* | 2551252 | 67 | no | below the threshold |
| Kiefernsteinpilz | *Boletus pinophilus* | 5954949 | 75 | no | below the threshold |
| Klapperschwamm | *Grifola frondosa* | 2540800 | 451 | no | below the threshold |
| Kleiner Wald-Champignon | *Agaricus sylvaticus* | 8108291 | 141 | no | below the threshold |
| Kleines Judasohr | *Schizophyllum amplum* | 5241139 | 63 | no | below the threshold |
| Königsfliegenpilz | *Amanita regalis* | 5240248 | 214 | no | below the threshold |
| Königsröhrling | *Butyriboletus regius* | 7617313 | 8 | no | below the threshold |
| Körnchenröhrling | *Suillus granulatus* | 8146046 | 276 | no | below the threshold |
| Kohlenleistling | *Faerberia carbonaria* | 2546354 | 8 | no | below the threshold |
| Kompostegerling | *Agaricus cappellianus* | 5243478 | 2 | no | below the threshold |
| Krause Glucke | *Sparassis crispa* | 2550247 | 1992 | yes (`sparassis_crispa`) |  |
| Kreisel-Drüsling | *Exidia recisa* | 2553588 | 202 | no | below the threshold |
| Kuhmaul | *Gomphidius glutinosus* | 2525027 | 396 | no | below the threshold |
| Kuhröhrling | *Suillus bovinus* | 7623986 | 654 | no | below the threshold |
| Kuhroter Milchling | *Lactarius hysginus* | 9030395 | 0 | no | below the threshold |
| Kupferroter Gelbfuß | *Chroogomphus rutilus* | 2524996 | 109 | no | below the threshold |
| Kurznetziger Hexenröhrling | *Suillellus mendax* | 7796432 | 51 | no | below the threshold |
| Lachsreizker | *Lactarius salmonicolor* | 5248788 | 118 | yes (`reizker`) | below the threshold; the karte value stays |
| Lavendelfarbener Rötelritterling | *Lepista glaucocana* | 5242033 | 19 | no | below the threshold |
| Leuchtender Weichporling | *Pycnoporellus fulgens* | 2543387 | 108 | no | below the threshold |
| Lilastieliger Rötelritterling | *Lepista personata* | 5242070 | 88 | no | below the threshold |
| Linden-Kelchbecherling | *Sarcoscypha jurana* | 2594966 | 48 | no | class Pezizomycetes; the occurrence table keeps only Agaricomycetes |
| Löwengelber Porling | *Cerioporus leptocephalus* | 9284704 | 120 | no | below the threshold |
| Lungenseitling | *Pleurotus pulmonarius* | 2526548 | 531 | no | below the threshold |
| Märzschneckling | *Hygrophorus marzuolus* | 7244099 | 15 | no | below the threshold |
| Maggipilz | *Lactarius helvus* | 5248660 | 124 | no | below the threshold |
| Mairitterling | *Calocybe gambosa* | 8936224 | 895 | no | below the threshold |
| Maronenröhrling | *Imleria badia* | 7832732 | 3486 | yes (`imleria_badia`) |  |
| Mausgrauer Erdritterling | *Tricholoma myomyces* | 5241808 | 381 | no | GBIF species is Tricholoma terreum; the records do not carry the catalogue name |
| Mediterraner Röhrling | *Suillus mediterraneensis* | 8017969 | 0 | no | below the threshold |
| Mehlräsling | *Clitopilus prunulus* | 2539197 | 501 | no | below the threshold |
| Mehltrichterling | *Clitocybe ditopa* | 2531217 | 14 | no | below the threshold |
| Mönchskopf | *Infundibulicybe geotropa* | 9186073 | 674 | no | below the threshold |
| Nadelholzschwefelporling | *Laetiporus montanus* | 8210723 | 2 | no | below the threshold |
| Nadelschüppling | *Pholiota spumosa* | 9109424 | 5 | no | below the threshold |
| Nebelkappe | *Clitocybe nebularis* | 2531072 | 3935 | yes (`nebelkappe`) |  |
| Nelkenschwindling | *Marasmius oreades* | 2537250 | 1642 | yes (`marasmius_oreades`) |  |
| Netzstieliger Hexenröhrling | *Suillellus luridus* | 3355021 | 1816 | yes (`hexen_netz`) |  |
| Nördlicher Stachelseitling | *Climacodon septentrionalis* | 2541815 | 1 | no | below the threshold |
| Ochsenröhrling | *Imperator torosus* | 7549601 | 1 | no | below the threshold |
| Leberreischling | *Fistulina hepatica* | 2531012 | 1841 | yes (`fistulina_hepatica`) |  |
| Ockerbrauner Trichterling | *Infundibulicybe gibba* | 2531146 | 287 | no | below the threshold |
| Ockertäubling | *Russula ochroleuca* | 2551419 | 817 | no | below the threshold |
| Ölbaumpilz | *Omphalotus olearius* | 2538088 | 1 | no | below the threshold |
| Österreichischer Prachtbecherling | *Sarcoscypha austriaca* | 8689016 | 283 | no | class Pezizomycetes; the occurrence table keeps only Agaricomycetes |
| Ohrförmiger Seitling | *Pleurocybella porrigens* | 2538000 | 46 | no | below the threshold |
| Olivfarbener Frauentäubling | *Russula cyanoxantha var. peltereaui* | 2551542 | 737 | no | GBIF species is Russula cyanoxantha; the records do not carry the catalogue name |
| Olivgrauer Schneckling | *Hygrophorus mesotephrus* | 2538797 | 8 | no | below the threshold |
| Orangebecherling | *Aleuria aurantia* | 5258678 | 1086 | no | class Pezizomycetes; the occurrence table keeps only Agaricomycetes |
| Orangeroter Graustieltäubling | *Russula decolorans* | 2551479 | 65 | no | below the threshold |
| Orangeroter Mairitterling | *Calocybe graveolens* | 8835060 | 0 | no | below the threshold |
| Pantherpilz | *Amanita pantherina* | 8961574 | 1667 | yes (`amanita_pantherina`) |  |
| Gepanzerter Rasling | *Lyophyllum decastes var. loricatum* | 7995110 | 7 | no | GBIF species is Lyophyllum loricatum; the records do not carry the catalogue name |
| Parasol | *Macrolepiota procera* | 8914748 | 5005 | yes (`parasol`) |  |
| Perlhuhn-Tintling | *Coprinopsis strossmayeri* | 5448853 | 1 | no | below the threshold |
| Perlhuhnegerling | *Agaricus moelleri* | 5243496 | 41 | no | below the threshold |
| Perlpilz | *Amanita rubescens* | 7496350 | 6070 | yes (`amanita_rubescens`) |  |
| Echter Pfifferling | *Cantharellus cibarius* | 5249504 | 1565 | yes (`pfifferling`) |  |
| Purpuroranger Afterleistling | *Aphroditeola olida* | 7442261 | 0 | no | below the threshold |
| Rasiges Stachelspitzchen | *Mucronella calva* | 5244323 | 13 | no | below the threshold |
| Rauchblättriger Schwefelkopf | *Hypholoma capnoides* | 2533439 | 392 | no | below the threshold |
| Weißer Igelstäubling | *Geastrum pedicellatum* | 8078015 | 4 | no | below the threshold |
| Gelbflockiger Wulstling | *Amanita franchetii* | 5240284 | 42 | no | below the threshold |
| Rebhuhnchampignon | *Agaricus phaeolepidotus* | 8240628 | 12 | no | below the threshold |
| Reifpilz | *Cortinarius caperatus* | 2529415 | 86 | no | below the threshold |
| Riesenbovist | *Calvatia gigantea* | 2536058 | 1528 | yes (`calvatia_gigantea`) |  |
| Riesenchampignon | *Agaricus augustus* | 5243429 | 458 | no | below the threshold |
| Riesenkrempentrichterling | *Leucopaxillus giganteus* | 2532720 | 74 | no | GBIF species is Aspropaxillus giganteus; the records do not carry the catalogue name |
| Riesenporling | *Meripilus giganteus* | 2540761 | 5025 | yes (`meripilus_giganteus`) |  |
| Riesenrötling | *Entoloma sinuatum* | 2539308 | 32 | no | below the threshold |
| Riesentrichterling | *Clitocybe maxima* | 2531146 | 287 | no | GBIF species is Infundibulicybe gibba; the records do not carry the catalogue name |
| Rillstieliger Seitling | *Pleurotus cornucopiae* | 7830030 | 91 | no | below the threshold |
| Rillstieliger Weichritterling | *Melanoleuca grammopodia* | 8849982 | 16 | no | below the threshold |
| Ringloser Butterpilz | *Suillus collinitus* | 9104622 | 111 | no | below the threshold |
| Ringloser Hallimasch | *Desarmillaria tabescens* | 9713443 | 4 | no | below the threshold |
| Rinnigbereifter Trichterling | *Clitocybe rivulosa* | 2531052 | 51 | no | below the threshold |
| Rissiger Frauentäubling | *Russula cutefracta* | 2551542 | 737 | no | GBIF species is Russula cyanoxantha; the records do not carry the catalogue name |
| Risspilzähnlicher Erdritterling | *Tricholoma argyraceum* | 5241825 | 48 | no | below the threshold |
| Risspilzartiger Schneckling | *Hygrophorus inocybiformis* | 3344992 | 0 | no | below the threshold |
| Rötender Birkenpilz | *Leccinum oxydabile* | 9141390 | 1160 | no | GBIF species is Leccinum scabrum; the records do not carry the catalogue name |
| Rötender Erdritterling | *Tricholoma orirubens* | 5241733 | 34 | no | below the threshold |
| Rötender Schafporling | *Albatrellus subrubescens* | 3357733 | 1 | no | below the threshold |
| Rosablättriger Egerlingsschirmling | *Leucoagaricus leucothites* | 2535875 | 144 | no | below the threshold |
| Rosenroter Gelbfuß | *Gomphidius roseus* | 7889985 | 206 | no | below the threshold |
| Rosenroter Seitling | *Pleurotus djamor* | 2526599 | 1 | no | below the threshold |
| Rotbrauner Flämmling | *Gymnopilus picreus* | 2533726 | 24 | no | below the threshold |
| Rotbrauner Milchling | *Lactarius rufus* | 5248684 | 254 | no | below the threshold |
| Rotfußröhrling | *Xerocomellus chrysenteron* | 2519413 | 1536 | yes (`xerocomellus_chrysenteron`) |  |
| Rotgelber Stoppelpilz | *Hydnum rufescens* | 2544165 | 131 | no | below the threshold |
| Runzelige Fingerhutverpel | *Verpa cerebriformis* | - | - | no | no GBIF species match |
| Runzeliggezonter Milchling | *Lactifluus rugatus* | 7487285 | 0 | no | below the threshold |
| Keulenstieliger Garten-Safranschirmling | *Chlorophyllum rhacodes* | 5955395 | 460 | no | below the threshold |
| Samtfußrübling | *Flammulina velutipes* | 3341441 | 965 | no | below the threshold |
| Samtiger Filzröhrling | *Xerocomus lanatus* | 2519457 | 482 | no | GBIF species is Xerocomus subtomentosus; the records do not carry the catalogue name |
| Samtpfifferling | *Cantharellus friesii* | 8010163 | 121 | no | below the threshold |
| Samtschuppiger Tannenflämmling | *Gymnopilus sapineus* | 2533669 | 9 | no | below the threshold |
| Sandröhrling | *Suillus variegatus* | 9043861 | 394 | no | below the threshold |
| Satansröhrling | *Rubroboletus satanas* | 7722553 | 146 | no | below the threshold |
| Schärflicher Ritterling | *Tricholoma sciodes* | 5241735 | 57 | no | below the threshold |
| Weißer Anis-Champignon | *Agaricus arvensis* | 5243403 | 132 | no | below the threshold |
| Schafporling | *Albatrellus ovinus* | 2551823 | 32 | no | below the threshold |
| Scharlachroter Kelchbecherling | *Sarcoscypha coccinea* | 8156721 | 284 | no | class Pezizomycetes; the occurrence table keeps only Agaricomycetes |
| Schildrötling | *Entoloma clypeatum* | 3345846 | 44 | no | below the threshold |
| Schlehenrötling | *Entoloma sepium* | 3346903 | 37 | no | below the threshold |
| Schleimigberingter Schneckling | *Hygrophorus gliocyclus* | 3344548 | 5 | no | GBIF species is Hygrophorus ligatus; the records do not carry the catalogue name |
| Schmutziger Rötelritterling | *Lepista sordida* | 5242097 | 39 | no | below the threshold |
| Schönfußröhrling | *Caloboletus calopus* | 8203051 | 369 | no | below the threshold |
| Schopftintling | *Coprinus comatus* | 7987658 | 8560 | yes (`schopftintling`) |  |
| Schuppiger Porling | *Cerioporus squamosus* | 2547092 | 1309 | yes (`cerioporus_squamosus`) |  |
| Schuppiger Sägeblättling | *Neolentinus lepideus* | 9129313 | 233 | no | below the threshold |
| Schwärzender Leistling | *Cantharellus melanoxeros* | 5249532 | 3 | no | below the threshold |
| Schwarzer Kelchpilz | *Urnula craterium* | 7643901 | 43 | no | class Pezizomycetes; the occurrence table keeps only Agaricomycetes |
| Schwarzfaseriger Ritterling | *Tricholoma portentosum* | 5241860 | 49 | no | below the threshold |
| Schwärzlicher Birkenpilz | *Leccinum melaneum* | 2524598 | 18 | no | below the threshold |
| Schwarzhütiger Steinpilz | *Boletus aereus* | 8733688 | 44 | no | below the threshold |
| Schwarzschuppiger Erdritterling | *Tricholoma atrosquamosum* | 7242238 | 18 | no | below the threshold |
| Schwefelporling | *Laetiporus sulphureus* | 9072021 | 10112 | yes (`laetiporus_sulphureus`) |  |
| Schweinsohr | *Gomphus clavatus* | 5238786 | 22 | no | below the threshold |
| Seidiger Dachpilz | *Pluteus petasatus* | 5241275 | 26 | no | below the threshold |
| Seidiger Egerlingsschirmling | *Leucoagaricus holosericeus* | 2535875 | 144 | no | GBIF species is Leucoagaricus leucothites; the records do not carry the catalogue name |
| Seifenritterling | *Tricholoma saponaceum* | 3324249 | 164 | no | below the threshold |
| Semmelporling | *Albatrellus confluens* | 2551821 | 20 | no | GBIF species is Albatrellopsis confluens; the records do not carry the catalogue name |
| Semmelstoppelpilz | *Hydnum repandum* | 2554716 | 566 | no | below the threshold |
| Silberröhrling | *Butyriboletus fechtneri* | 7554180 | 6 | no | below the threshold |
| Sklerotienporling | *Polyporus tuberaster* | 8666066 | 554 | no | below the threshold |
| Sommersteinpilz | *Boletus reticulatus* | 5954691 | 906 | no | below the threshold |
| Spangrüner Kiefernreizker | *Lactarius semisanguifluus* | 5248649 | 84 | no | below the threshold |
| Sparriger Risspilz | *Inocybe hystrix* | 2527867 | 19 | no | below the threshold |
| Sparriger Schüppling | *Pholiota squarrosa* | 2534205 | 1061 | yes (`pholiota_squarrosa`) |  |
| Spechttintling | *Coprinopsis picacea* | 5242777 | 2338 | yes (`coprinopsis_picacea`) |  |
| Speisemorchel | *Morchella esculenta* | 2594602 | 408 | no | class Pezizomycetes; the occurrence table keeps only Agaricomycetes |
| Speisetäubling | *Russula vesca* | 2551415 | 352 | no | below the threshold |
| Spitzgebuckelter Raukopf | *Cortinarius rubellus* | 2528663 | 62 | no | below the threshold |
| Spitzkegeliger Tintling | *Coprinopsis acuminata* | 5242778 | 28 | no | below the threshold |
| Spitzmorchel | *Morchella elata* | 2594626 | 60 | no | class Pezizomycetes; the occurrence table keeps only Agaricomycetes |
| Spitzschuppiger Schirmling | *Echinoderma asperum* | 5243011 | 529 | no | below the threshold |
| Steinpilz | *Boletus edulis* | 5954958 | 3513 | yes (`boletus_edulis`) |  |
| Sternschuppiger Riesenschirmpilz | *Macrolepiota fuliginosa* | 2536747 | 161 | no | below the threshold |
| Stockschwämmchen | *Kuehneromyces mutabilis* | 2533962 | 1919 | yes (`kuehneromyces_mutabilis`) |  |
| Taubentäubling | *Russula grisea* | 2551317 | 15 | no | below the threshold |
| Tigerritterling | *Tricholoma pardinum* | 7242174 | 1 | no | below the threshold |
| Totentrompete | *Craterellus cornucopioides* | 2554662 | 454 | no | below the threshold |
| Trompetenpfifferling | *Craterellus tubaeformis* | 2554536 | 522 | no | below the threshold |
| Tropfender Schillerporling | *Pseudoinonotus dryadeus* | 2520036 | 269 | no | below the threshold |
| Übelriechender Champignon | *Agaricus maleolens* | 5243392 | 8 | no | GBIF species is Agaricus bernardii; the records do not carry the catalogue name |
| Krause Kraterelle | *Pseudocraterellus undulatus* | 11567415 | 96 | no | GBIF species is Craterellus undulatus; the records do not carry the catalogue name |
| Verschiedenfarbener Raufußröhrling | *Leccinum variicolor* | 2524553 | 69 | no | below the threshold |
| Violetter Rötelritterling | *Lepista nuda* | 5242048 | 732 | no | below the threshold |
| Violettstieliger Pfirsichtäubling | *Russula violeipes* | 2551231 | 277 | no | below the threshold |
| Weinbraune Koralle | *Ramaria bataillei* | 7241653 | 4 | no | below the threshold |
| Weinroter Kiefernreizker | *Lactarius sanguifluus* | 5248648 | 22 | no | below the threshold |
| Weißer Dachpilz | *Pluteus pellitus* | 5241314 | 4 | no | below the threshold |
| Weißer Großstäubling | *Calvatia candida* | 6014839 | 0 | no | below the threshold |
| Weißer Knochenporling | *Osteina obducta* | 2542679 | 0 | no | below the threshold |
| Weißer Knollenblätterpilz | *Amanita phalloides var. alba* | 5240325 | 1660 | no | GBIF species is Amanita phalloides; the records do not carry the catalogue name |
| Weißstieliger Rötling | *Entoloma lividoalbum* | 2539864 | 26 | no | below the threshold |
| Weißtannenfingerhut | *Cyphella digitalis* | 2532923 | 5 | no | below the threshold |
| Wiesenchampignon | *Agaricus campestris* | 5243458 | 679 | no | below the threshold |
| Wiesenstaubbecher | *Vascellum pratense* | 5243244 | 385 | no | GBIF species is Lycoperdon pratense; the records do not carry the catalogue name |
| Fleischbräunlicher Anistrichterling | *Clitocybe obsoleta* | 2531090 | 3 | no | below the threshold |
| Wolliger Risspilz | *Inocybe lanuginosa* | 7244052 | 6 | no | below the threshold |
| Wurzelnder Bitterröhrling | *Caloboletus radicans* | 7550396 | 593 | no | below the threshold |
| Wurzelnder Egerlingsschirmling | *Leucoagaricus barssii* | 2535867 | 4 | no | below the threshold |
| Ziegelroter Risspilz | *Inosperma erubescens* | 10776858 | 42 | no | below the threshold |
| Ziegenlippe | *Xerocomus subtomentosus* | 2519457 | 482 | no | below the threshold |
| Zimtfarbener Weichporling | *Hapalopilus rutilans* | 8383534 | 376 | no | below the threshold |
| Zimtroter Gürtelfuß | *Cortinarius laniger* | 2529263 | 4 | no | below the threshold |
| Zipfellorchel | *Discina fastigiata* | 5497524 | 2 | no | class Pezizomycetes; the occurrence table keeps only Agaricomycetes |
| Zitronengelber Raukopf | *Cortinarius limonius* | 12119339 | 10 | no | GBIF species is Aureonarius limonius; the records do not carry the catalogue name |
| Zitronenporling | *Albatrellus citrinus* | 3357741 | 0 | no | below the threshold |
| Zitzen-Riesenschirmling | *Macrolepiota mastoidea* | 2536707 | 338 | no | below the threshold |
