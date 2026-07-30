# imp-ui — Logging

imp ships a small built-in logger. The library routes all of its own diagnostics through it, and
your app can import the same logger for its own messages, so everything an imp app writes to the
browser console honors one log level — set per environment, without touching code.

## Using the logger

Import the ready-made `logger`, or create a named one that prefixes every message:

```js
import { createLogger, logger } from 'imp/log'

logger.info('checkout opened')

const log = createLogger('myapp.cart')
log.debug('recalculating totals', { items: 3 })
log.warn('price feed is stale — using cached prices')
```

A logger has four methods — `debug`, `info`, `warn`, and `error` — each accepting any number of
arguments, exactly like the console: strings, objects, errors. A named logger prefixes its first
argument (`myapp.cart: recalculating totals`), so filtering the console by your prefix shows only
your messages; filtering by `imp:` shows only the library's.

Messages go to the browser console: `debug` and `info` through `console.log`, `warn` through
`console.warn`, and `error` through `console.error`, so the console's own severity filters and
stack-trace handling keep working.

## Log levels

Four levels, in order: `debug` < `info` < `warn` < `error`. A message is written only when its level
is at or above the active level. The default level is `info` — imp's warnings and errors show, debug
tracing stays quiet.

Set the level per environment through the `IMP_LOG_LEVEL` value in an environment file (see
_Environments_ in **[Configuration](config.md)**) — debug tracing in dev, warnings and errors in
prod:

```json
{
  "API_URL": "https://api.example.com",
  "IMP_LOG_LEVEL": "debug"
}
```

The level can also be changed at runtime — handy from the browser console while debugging a running
app:

```js
import { logLevel, setLogLevel } from 'imp/log'

setLogLevel('debug')
logLevel() // 'debug'
```

## What imp logs at the debug level

With `IMP_LOG_LEVEL` set to `debug`, imp traces its own activity — the fastest way to see why a
binding updates too often, or not at all:

- **State reads** — every `get()`, with the value returned.
- **State sets** — every applied `set()`, with the new value, plus sets that were skipped because
  the new value was identical or structurally equal to the current one.
- **Subscriptions** — every `watch` attaching and detaching (including the ones `text`, `view`,
  `each`, and state-bound props create), and each notification with its subscriber count.
- **State lifecycle** — states being initialized and resolved, and consumers rebinding after a
  component moves.
- **Computed states** — every recompute, including ones whose result was unchanged.
- **Component lifecycle** — components being defined, mounted, unmounted, and rebinding their
  subscriptions after a move.

Everything at `warn` and `error` — invalid state values, failed subscribers, mount failures, and the
like — shows at the default level.
