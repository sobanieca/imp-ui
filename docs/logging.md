# imp-ui - Logging

imp has a small built-in logger. The library sends all of its own diagnostics through it, and your
app can import the same logger for its own messages. Everything an imp app writes to the browser
console then obeys one log level. You set that level per environment, with no change to the code.

## How to use the logger

Import the ready-made `logger`, or create a named logger that puts a prefix on every message:

```js
import { createLogger, logger } from 'imp/log'

logger.info('checkout opened')

const log = createLogger('myapp.cart')
log.debug('recalculating totals', { items: 3 })
log.warn('price feed is stale - using cached prices')
```

A logger has four methods: `debug`, `info`, `warn`, and `error`. Each accepts any number of
arguments, exactly like the console. An argument can be a string, an object, or an error. A named
logger puts its name in front of the first argument, as in `myapp.cart: recalculating totals`. A
filter on your prefix then shows only your messages, and a filter on `imp:` shows only the messages
of the library.

The messages go to the browser console. `debug` and `info` go through `console.log`, `warn` goes
through `console.warn`, and `error` goes through `console.error`. The severity filters of the
console, and its handling of a stack trace, keep working as usual.

## Log levels

There are four levels, in this order: `debug` < `info` < `warn` < `error`. imp writes a message only
when its level is at or above the active level. The default level is `info` while you develop and
test, so the warnings and errors of imp show, and debug tracing stays quiet. In a built app the
default level is `warn`, so an info message does not fill the console of every user.

To set the level per environment, use the `IMP_LOG_LEVEL` value in an environment file. See
_Environments_ in **[Configuration](config.md)**. Use debug tracing in development, and warnings and
errors in production:

```json
{
  "API_URL": "https://api.example.com",
  "IMP_LOG_LEVEL": "debug"
}
```

You can also change the level at runtime, from the browser console, while you debug a running app:

```js
import { logLevel, setLogLevel } from 'imp/log'

setLogLevel('debug')
logLevel() // 'debug'
```

## What imp logs at the debug level

With `IMP_LOG_LEVEL` set to `debug`, imp traces its own activity. This is the fastest way to see why
a binding updates too often, or does not update at all:

- **State reads.** Every `get()`, with the value it returned.
- **State sets.** Every applied `set()`, with the new value. imp also logs a set it skipped because
  the new value equals the current one.
- **Subscriptions.** Every `watch` that attaches and detaches, and each notification with its
  subscriber count. This includes the subscriptions that `text`, `view`, `each`, and a state-bound
  prop create.
- **State lifecycle.** The states imp initializes and resolves, and the consumers that bind again
  after a component moves.
- **Computed states.** Every recompute, including the ones whose result did not change.
- **Component lifecycle.** The components imp defines, mounts, and unmounts, and the components that
  bind their subscriptions again after a move.

Everything at `warn` and `error` shows at the default level. That covers an invalid state value, a
failed subscriber, a mount failure, and similar problems.
