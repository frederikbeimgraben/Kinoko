# Kinoko frontend

Angular 22: standalone components, zoneless, signals, strict TypeScript. The
user interface follows the mockups in `docs/mockups/`. It also follows the
design system in `artefakte/mockups/design/`, a folder next to the repository.

## Environment

Use Node 24. The Nix shell gives it:

```
nix develop .#frontend
```

The shell also sets `BROWSER_PATH` and `CHROME_PATH` to the Chromium of
nixpkgs. Playwright and Lighthouse use it. Read `e2e/README`.

## Commands

```
npm ci             install the dependencies from package-lock.json
npm start          development server on port 4200, with the proxy
npm run lint       ESLint, the repository checks and Prettier
npm run typecheck  tsc for the app, the unit tests and the e2e tests
npm test           Vitest in watch mode
npm run test:ci    Vitest once, with coverage and a limit of 90 %
npm run build      production bundle, with budgets
npm run e2e        Playwright
```

Two commands make generated files. Run them when their source changes:

```
npm run api:generate  src/app/core/api/contract.d.ts from ../backend/openapi.yaml
npm run texts:sync    src/app/core/i18n/texts.<locale>.json from ../backend/daten/texte.json
```

## Structure

```
src/app/core/     theme, i18n, api, config, tiles, layout, state and other services
src/app/map/      MapLibre behind an adapter, the wert:// protocol, the colour worker
src/app/shell/    navigation and avatar around the tabs
src/app/ui/       the shared building blocks
src/app/features/ the tabs and the admin pages
src/app/dev/      the page /dev/blocks, only in the build of npm run build:e2e
src/styles/       dimensions of the app, base reset and helper classes
```

A building block is in `src/app/ui/` one time only. A page puts blocks
together. A page does not set the height, the radius or the colour of a block.
When two blocks use the same dimension, make it a token in
`src/styles/tokens.scss`.

## Proxy

`proxy.conf.json` sends `/api` to the local service on port 8111. It sends
the tile paths and the manifests to `kinoko.reutlingen.university`. Thus development
does not need a local render run. The path forms are in
`src/app/core/tiles/tile-paths.ts`.

The tests run in isolation (`isolate` in the target `test`). Without
isolation, all test files share one environment. Then the defaults of
`src/test-setup.ts` apply only to the first file. Also, the language of the
user interface changes during the run.

## The map

The base map comes from OpenFreeMap: "liberty" in the light theme, "dark" in
the dark theme. MapLibre is behind `MapAdapter`. The map page does not know
MapLibre, and it runs in the tests without WebGL.

MapLibre does two things in a way that you possibly do not expect:

- It counts zoom levels for tiles of 512 points. The value tiles have 256 points. Thus their level 5 is level 4 here.
- The events `load` and `idle` do not come on this map. Thus the change of week listens for `sourcedata` of the new source. It also has a time limit as a safety stop.

### `wert://`

A raster source has the template `wert://<source>/<folder>/{z}/{x}/{y}`.
Each source registers one time, with its scale, its ramp and the list of
tiles that hold data. The protocol never gets a tile that is not in the list.
It gives an empty tile, without a 404.

A worker does all the other work. It gets the PNG (one byte per point), colours
it with a lookup table and sends back an `ImageBitmap`. The raw bytes stay in
the worker, up to 16 MB. Thus the adjacent weeks are ready before a person
selects them.

There are two scales:

- A species has its maximum `top`. It colours by the absolute value, and the opacity follows the value.
- An input layer has its range `low` to `high` in its unit. The ramp covers that range, and the opacity stays the same. Otherwise a low pH would look like missing data.

### Combination

The combination is the same protocol with more than one source. The worker
gets the tiles of all selected factors. It checks each condition at each
point and gives one tile.

- The intersection mode colours with one colour, half opaque, where each condition is true.
- The graded mode uses the geometric mean of the degrees of fulfilment. Outside the condition, a degree falls linearly to zero over one tenth of the scale. Thus you can see where a condition almost applies.

If a source has no value at a point, the point stays empty.

A forecast species can be a factor. `layerFromSpecies` gives it the form of a
layer. Both have a scale, a tile folder for each week and a histogram. Thus
the app has only one path for both.

### The worker of MapLibre

MapLibre 6 comes as three ESM files: the bundle, a shared part and the worker.
The worker loads at run time through `new URL('./maplibre-gl-worker.mjs',
import.meta.url)`. No bundler includes it. Thus `angular.json` copies
`maplibre-gl-worker.mjs` and `maplibre-gl-shared.mjs` into the root of the
output.

If these files are missing, only the raster layers work. The vector tiles and
each GeoJSON source (markers, zones, finds) stay empty. MapLibre then shows
"Style is not done loading".

### Roles

Two value layers are on top of each other: `vorhersage` below, `ebene` above.
Each role has its own sources, its own opacity and its own change without
flicker.

## Own objects on the map

Markers, zones and finds are separate GeoJSON sources above the value
layers. The zones are areas below, the points are above. The colour is on the
feature, not in the layer. Thus each zone and each marker has the selected
colour of the six colours.

The service rounds a shared find of a protected species to 5 km. The map
shows it as a large, pale circle. Thus the map does not show a point that does
not exist.

Terra Draw draws the area of a zone and lets a person move its corners. It
accepts only coordinates with nine decimals or fewer. Thus
`features/add-entry/zone-drawer.ts` rounds to six decimals, about 11 cm.

## Workshop page

`/dev/blocks` shows each building block, one time light and one time dark.
The route exists only in the build of `npm run build:e2e`. The images in
`docs/` show the state at the acceptance of A1.
