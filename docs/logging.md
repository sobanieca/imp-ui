# imp-ui - Logging

imp has a small built-in logger. The library sends all of its own diagnostics through it. Your app
can import the same logger for its own messages. So everything that an imp app writes to the browser
console obeys one log level. You set that level per environment, and you do not change the code.

## How to use the logger

Import the ready-made `logger`, or create a named logger that puts a prefix on every message:

```js
import { createLogger, logger } from 'imp/log'

logger.info('checkout opened')

const log = createLogger('myapp.cart')
log.debug('recalculating totals', { items: 3 })
log.warn('price feed is stale - using cached prices')
```

A logger has four methods: `debug`, `info`, `warn` and `error`. Each one accepts any number of
arguments, exactly like the console. An argument can be a string, an object or an error. A named
logger puts its name in front of the first argument, as in `myapp.cart: recalculating totals`. So a
filter on your prefix shows only your messages, and a filter on `imp:` shows only the messages of
the library.

The messages go to the browser console. `debug` and `info` go through `console.log`, `warn` goes
through `console.warn`, and `error` goes through `console.error`. So the severity filters of the
console, and its handling of a stack trace, continue to work.

## Log levels

There are four levels, in this order: `debug` < `info` < `warn` < `error`. imp writes a message only
when its level is at the active level or above it. The default level is `info`. So the warnings and
the errors of imp show, and the debug tracing stays quiet.

To set the level per environment, use the `IMP_LOG_LEVEL` value in an environment file. See
_Environments_ in **[Configuration](config.md)**. Use debug tracing in development, and warnings and
errors in production:

```json
{
  "API_URL": "https://api.example.com",
  "IMP_LOG_LEVEL": "debug"
}
```

You can also change the level at runtime. This helps from the browser console while you debug a
running app:

```js
import { logLevel, setLogLevel } from 'imp/log'

setLogLevel('debug')
logLevel() // 'debug'
```

## What imp logs at the debug level

With `IMP_LOG_LEVEL` set to `debug`, imp traces its own activity. This is the fastest way to see why
a binding updates too often, or does not update:

- **State reads.** Every `get()`, with the value that it returned.
- **State sets.** Every applied `set()`, with the new value. imp also logs a set that it skipped
  because the new value is identical to the current one, or structurally equal to it.
- **Subscriptions.** Every `watch` that attaches and detaches, and each notification with its
  subscriber count. This includes the subscriptions that `text`, `view`, `each` and a state-bound
  prop create.
- **State lifecycle.** The states that imp initializes and resolves, and the consumers that bind
  again after a component moves.
- **Computed states.** Every recompute, and also the ones whose result did not change.
- **Component lifecycle.** The components that imp defines, mounts and unmounts, and the components
  that bind their subscriptions again after a move.

Everything at `warn` and `error` shows at the default level. That covers an invalid state value, a
failed subscriber, a mount failure and similar problems.
