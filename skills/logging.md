# logging - the built-in logger and the per-environment level

imp sends its own diagnostics to one logger. Your app imports the same logger from `imp/log`. So
every message that an imp app writes obeys one level, and you set that level per environment.

```js
import { createLogger, logger, logLevel, setLogLevel } from 'imp/log'

logger.info('checkout opened')

const log = createLogger('myapp.cart') // prefixes every message: 'myapp.cart: ...'
log.debug('recalculating totals', { items: 3 })
log.warn('price feed is stale')
```

| Member               | Notes                                                              |
| -------------------- | ------------------------------------------------------------------ |
| `logger`             | the ready-made logger                                              |
| `createLogger(name)` | a logger that puts `name:` in front of its first argument          |
| `setLogLevel(level)` | changes the level at runtime, for example from the browser console |
| `logLevel()`         | the active level                                                   |

Every logger has `debug`, `info`, `warn` and `error`. Each one takes any number of arguments, like
the console. `debug` and `info` go to `console.log`, `warn` goes to `console.warn`, and `error` goes
to `console.error`.

## Levels

The order is `debug` < `info` < `warn` < `error`. imp writes a message only at the active level or
above it. The default level is **`info`**. To set the level per environment, put `IMP_LOG_LEVEL` in
an environment file, see [config](config.md):

```json
{
  "API_URL": "https://api.example.com",
  "IMP_LOG_LEVEL": "debug"
}
```

To see only the library's messages, filter the browser console by `imp:`. To see only your own
messages, filter by your prefix. In development, `imp start` also keeps every console message in the
log of the session, one entry per line. Run `imp logs` and search it instead of watching the
terminal, see [start](start.md).

## What `debug` traces

Set the level to `debug` to find why a binding updates too often, or does not update. imp then logs:

- **state reads.** Every `get()` with its value.
- **state sets.** Every applied `set()`, and the ones that imp skips because they are structurally
  equal.
- **subscriptions.** Every `watch` that attaches and detaches, and each notification with its
  subscriber count. This includes the subscriptions that `text`, `view`, `each` and bound props
  create.
- **state lifecycle.** The states that imp initializes, resolves and rebinds after a component
  moves.
- **computed states.** Every recompute, and also the ones with an unchanged result.
- **component lifecycle.** The components that imp defines, mounts, unmounts and rebinds after a
  move.

Everything at `warn` and `error` shows at the default level. This covers invalid state values,
failed subscribers and mount failures. So a silent console means that imp found no problem.
