# The map draws a bundled world: Natural Earth in the library, as SVG, with no tile server

## Context

An app that shows where things are needs a map with markers on it. Every usual answer for that map
sends a request to a tile server on each pan and zoom. The public OpenStreetMap servers run on
donated capacity, and their policy forbids an app that leans on them. A commercial provider adds a
key, a bill and a third-party request to every page that holds a map. imp asks a user to install
nothing and to sign up for nothing, and an imp app makes no request that the app did not write. A
map that phones a tile server on its own breaks both rules.

A map also has to hold any component as a marker. A person must be able to click, focus and operate
a marker, so the marker must be real DOM, not a picture drawn on a canvas.

## Decision

**`map` draws the world from data that ships with the component. It makes no request.**

- **The world is Natural Earth, in three levels of detail that the `detail` prop picks.** `'low'` is
  the 1:110m set: 177 country shapes, the 24 largest lakes and 243 cities, 50 kB. `'medium'` is the
  1:50m set: 242 countries, 412 lakes and 1251 cities, 360 kB. `'high'` is the 1:50m world plus the
  major and secondary highways of the 1:10m roads, 756 kB more. The 1:10m polygons are out, because
  one layer of them is about 1 MB and 538 thousand points, which the platform does not rasterize
  well. The other road types are out, because they double the bytes for local roads and 25 thousand
  segments of an unknown type. Natural Earth is in the public domain, so no notice travels with it.
  `cargo xtask vendor-natural-earth` writes the three modules
  `map-world-110m.js`, `map-world-50m.js` and `map-roads-10m.js` into `lib/src/std/data/`, from a
  pinned release of the upstream repository, and the files are committed. The tool projects every
  point to Web Mercator, quantizes it to a grid of 65535 by 65535, and delta-encodes each ring and
  each line as a string. The modules hold plain literals only. `map` decodes a level on first use
  and caches it.
- **Each level is a lazy chunk, and only `map` loads it.** `map` reaches the data through
  `import()`, so `imp build` writes each data module as its own chunk, and a page fetches the one
  chunk of the level it draws, from the app itself. An app that draws no map ships none of the data,
  and an app that draws a low map never loads the roads. That keeps the guarantee of
  `tree-shakeable-library.md` for a data set that is too big to ship at every level at once. The
  world appears when its chunk has loaded, so the box shows water for that moment. There is no
  per-region split, because a world map is the one job.
- **The roads are a few paths, not a path per road.** The 18 thousand road segments merge into one
  SVG path per kind and rank, about fourteen paths in all. A road has no interaction of its own, so
  nothing needs a node per road, and a zoom change hides or shows a rank with one attribute.
- **The land is one SVG, and everything else is HTML.** The countries and the lakes are paths in one
  `<svg>` with a fixed `viewBox`. A pan is a translate of that element, and a zoom is a change of
  its size. Borders keep their width through `vector-effect: non-scaling-stroke`. The city labels
  and the pins are absolutely positioned HTML in two layers that translate with the world. Each one
  is placed again only when the zoom changes. SVG is the right shape at this scale. The data is ten
  thousand points, so the platform rasterizes it well, it takes theme tokens through CSS, it is
  sharp on any screen, and it needs no redraw when the theme changes.
- **`zoom: 0` fits the world to the box.** The world is never smaller than the box, and the view
  stops at the edge of the world. The scale of `zoom` is relative to the box, not to a tile size, so
  the same `zoom` means the same framing in a narrow card and on a wide page. Cities show by the
  rank that Natural Earth gives them, from eleven world cities at the far view to every capital near
  the closest one.
- **A pin is any node.** `pins` is data, `{ id, lat, lng }`, and a pin carries either a `label` for
  the default marker or a `content` node. A marker is a native button that reports `select`. A
  content node is positioned and left alone, so its own events and focus work. A pointer that goes
  down on a pin never starts a pan.
- **Pan and zoom are JavaScript, on purpose.** The platform has no map. A scrollable box cannot hold
  a world that is 2^6 boxes wide, and no CSS zooms around a pointer. So the drag, the wheel, the
  pinch and the arrow keys are the kind of code that `browser-support-baseline.md` allows: a feature
  that nothing in the platform provides. The map calls the platform for the rest: pointer capture,
  `ResizeObserver`, `touch-action`, `:focus-visible`.
- **Direction does not mirror the geography.** West is on the left in every direction. The zoom
  buttons sit at the inline end, and a pin takes the `dir` of the page, so its content reads
  correctly under `dir="rtl"`.

## Consequences

- A map costs one import, one chunk of 50 kB, 360 kB or 1.1 MB, and no request to another origin
  ever. It works offline, and the chunk arrives from the app itself.
- The detail stops at the highways. There is no street, no town below the 1251 cities, and no detail
  beyond `maxZoom`. An app that needs a street map needs a tile source, and imp does not ship one.
  `docs/` says so.
- The look is the theme, not a cartographer's style. Land is the surface colour, water is a mix of
  the primary colour, and borders are the border colour. So the map fits a dark theme and forced
  colours without a second data set.
- A newer Natural Earth release is one run of the task and one commit of the generated files.
