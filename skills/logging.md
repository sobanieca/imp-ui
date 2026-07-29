# logging — the built-in logger and the per-environment level

imp routes its own diagnostics through one logger, and your app imports the same one from `imp/log`,
so everything an imp app writes honors a single level set per environment.

```js
import { createLogger, logger, logLevel, setLogLevel } from 'imp/log'

logger.info('checkout opened')

const log = createLogger('myapp.cart') // prefixes every message: 'myapp.cart: …'
log.debug('recalculating totals', { items: 3 })
log.warn('price feed is stale')
```

| Member               | Notes                                                        |
| -------------------- | ------------------------------------------------------------ |
| `logger`             | the ready-made logger                                        |
| `createLogger(name)` | a logger prefixing its first argument with `name:`           |
| `setLogLevel(level)` | change the level at runtime (handy from the browser console) |
| `logLevel()`         | the active level                                             |

Every logger has `debug`, `info`, `warn`, `error`, each taking any number of arguments like the
console. `debug`/`info` go to `console.log`, `warn` to `console.warn`, `error` to `console.error`.

## Levels

`debug` < `info` < `warn` < `error`. A message is written only at or above the active level, which
defaults to **`info`**. Set it per environment with `IMP_LOG_LEVEL` in an environment file (see
[config](config.md)):

```json
{
  "API_URL": "https://api.example.com",
  "IMP_LOG_LEVEL": "debug"
}
```

Filtering the browser console by `imp:` shows only the library's messages; by your prefix, only
yours. In development every console message is also written to `.imp/dev.log` by `imp start`, one
entry per line — grep that file instead of watching the terminal.

## What `debug` traces

Turning the level to `debug` is the fastest way to see why a binding updates too often or not at
all. imp then logs:

- **state reads** — every `get()` with its value;
- **state sets** — every applied `set()`, plus the ones skipped as structurally equal;
- **subscriptions** — every `watch` attaching and detaching (including those `text`, `view`, `each`
  and bound props create) and each notification with its subscriber count;
- **state lifecycle** — states initialized, resolved, and rebound after a component moves;
- **computed states** — every recompute, including unchanged results;
- **component lifecycle** — defined, mounted, unmounted, rebound after a move.

Everything at `warn` and `error` — invalid state values, failed subscribers, mount failures — shows
at the default level, so a silent console means imp found nothing wrong.
