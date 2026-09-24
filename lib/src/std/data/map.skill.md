# map - a world map with pan, zoom and markers, drawn from bundled data with no request

```js
import { map } from 'imp/std/data'

map({
  label: 'Offices',
  center: [52.23, 21.01],
  zoom: 2,
  pins: [
    { id: 'warsaw', lat: 52.23, lng: 21.01, label: 'Warsaw office' },
    { id: 'lisbon', lat: 38.72, lng: -9.14, content: userCard({ name: 'Ana' }), anchor: 'bottom' },
  ],
  events: { select: (event) => open(event.detail.id) },
})
```

The call shape is `map(props)`. It takes **no children**. imp warns about a child and drops it.

| Prop      | Values                                           | Default  | Notes                                               |
| --------- | ------------------------------------------------ | -------- | --------------------------------------------------- |
| `label`   | string, or a state - **live**                    | -        | Necessary. The accessible name of the map           |
| `center`  | `[latitude, longitude]`, or a state - **live**   | `[0, 0]` | The point in the middle of the map                  |
| `zoom`    | number from `0`, or a state - **live**           | `0`      | `0` fits the world to the box. Each `+1` doubles it |
| `maxZoom` | number                                           | `6`      | The zoom that a person cannot pass                  |
| `detail`  | `'low'`, `'medium'`, `'high'`                    | `'low'`  | How much of the world ships. See below              |
| `pins`    | array of pins, or a state holding one - **live** | `[]`     | See below                                           |
| `events`  | `{ move, select }`                               | -        | `move`: `{ center, zoom }`. `select`: `{ id, pin }` |

Each pin has these keys:

| Key       | Values                   | Notes                                                                    |
| --------- | ------------------------ | ------------------------------------------------------------------------ |
| `id`      | string or number         | Reported by `select`. Defaults to the index                              |
| `lat`     | number, `-85` to `85`    | Necessary. Latitude in degrees                                           |
| `lng`     | number, `-180` to `180`  | Necessary. Longitude in degrees                                          |
| `label`   | string                   | The accessible name of the default marker                                |
| `content` | a node                   | Any element or component in place of the marker. It keeps its own events |
| `anchor`  | `'center'` or `'bottom'` | The point of the content that sits on the coordinate. `'center'` default |

Rules an agent gets wrong:

- **Import the component from `imp/std/data`**, not from `imp/std`.
- **The map makes no request.** The countries, the lakes and the cities are bundled with the
  component, from Natural Earth. There is no tile server, no key and no street level. Above
  `maxZoom` there is nothing more to show.
- **`detail` picks the data, and the data is a lazy chunk of the app.** `'low'` is the 1:110m world:
  177 countries, 24 lakes, 243 cities, 50 kB. `'medium'` is the 1:50m world: 242 countries, 412
  lakes, 1251 cities, 360 kB. `'high'` adds the 1:10m major and secondary highways to the 1:50m
  world, 1.1 MB in total, 640 kB gzip. The page loads only the chunk of the level it draws, from the
  app itself. The world appears when its chunk has loaded, so the box shows water first. Roads show
  from about `zoom` 1, by their own rank, and every road shows at `zoom` 6.
- **Coordinates are `[latitude, longitude]`**, in that order, in degrees. A pin takes `lat` and
  `lng` as two keys.
- **A pin without `content` is a marker button.** It carries `label` as its name, and a click
  reports `select` with `{ id, pin }`. A pin with `content` reports nothing. Put the handler on the
  content.
- **`content` is a node, not a function.** Pass `button(...)`, `userCard(...)` or any element. The
  map positions it and leaves it alone, so its own click, focus and keys work.
- **The map writes `center` and `zoom` back.** A drag, a wheel, a pinch, a key or a zoom button
  writes both states when they are writable, and reports `move`. A change of the state from the app
  moves the map and reports nothing, so a state bound in both directions cannot loop.
- **`zoom: 0` is the whole world in the box**, not a fixed scale. The map is never smaller than the
  box, so a pan stops at the edge of the world.
- **`Home` returns to the last `center` and `zoom` that the app set.**
- **The geography is not mirrored under `dir="rtl"`.** West stays on the left. The zoom buttons move
  to the inline end, and a pin keeps the direction of the page.
- The box is `24rem` tall by default. Set `block-size` on the host for another size.
- imp warns about a missing `label`, a pin with no numeric `lat` and `lng`, a `content` that is not
  a node, and a `center` that is not a pair of numbers.

The keyboard support is included, on the focused map:

| Key             | Action                              |
| --------------- | ----------------------------------- |
| `Left`, `Right` | Pan west or east by a quarter box   |
| `Up`, `Down`    | Pan north or south by a quarter box |
| `+`, `=`        | Zoom in by one step                 |
| `-`             | Zoom out by one step                |
| `Home`          | Return to the start view            |

A marker and a pin `content` sit in the tab order after the map.

```js
import { initState } from 'imp/state'
import { map } from 'imp/std/data'

const center = initState(self, 'fleet.center', [50, 10])
const zoom = initState(self, 'fleet.zoom', 3)

map({
  label: 'Fleet',
  center,
  zoom,
  pins: vehicles.get().map((vehicle) => ({
    id: vehicle.id,
    lat: vehicle.lat,
    lng: vehicle.lng,
    label: vehicle.name,
  })),
  events: { select: (event) => showVehicle(event.detail.id) },
})
```

Related: imp skill std/chart - a chart of numbers; imp skill state - the live view.
