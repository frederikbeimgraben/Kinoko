# commonsfotos

The tool finds freely licensed lead photos for the species on Wikimedia
Commons and writes the seed file `daten/fotos.json`. Run it from `backend/`.

1. Query Commons for each species file and write the candidates:

   ```
   go run ./tools/commonsfotos find -arten daten/arten -out candidates.json
   ```

2. Add the English common names of GBIF to the candidates:

   ```
   go run ./tools/commonsfotos names -arten daten/arten -candidates candidates.json
   ```

3. Pick one candidate for each species and write the seed file. A picks file
   can name the file for a species (`{"steinpilz": "File:…jpg"}`) or leave a
   species out (`{"steinpilz": ""}`). Without an entry, the candidate with the
   highest score wins:

   ```
   go run ./tools/commonsfotos pick -arten daten/arten -candidates candidates.json \
       -picks picks.json -out daten/fotos.json
   ```

The tool sends the User-Agent of the project, waits between requests and
waits longer after the answer 429. Check each chosen photo by eye: the search
also finds microscopy, drawings, plates and exhibition tables.
