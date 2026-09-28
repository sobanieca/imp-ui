# Built-in logger: one console-backed logger, level from the environment

## Context

The diagnostics of the library were raw `console.warn` and `console.error` calls, spread through the
source. There was no way to trace what the state layer does at runtime, unless you used a debugger.
You could not see which set the structural-equality gate applied or skipped, who subscribed, or what
imp read. An app had no shared mechanism either. To turn the diagnostics on in development and off
in production, somebody wrote a wrapper by hand. The environments feature, see `environments.md`,
already gives every app a set of values per target. So a log level can travel on that mechanism, and
imp adds no new configuration.

## Decision

- **The library has one logger module.** `imp/log` exports `logger`, `createLogger`, `setLogLevel`
  and `logLevel`. All logging in the library goes through it. No other library code calls
  `console.*` directly.
- **The console is the only sink.** `debug` and `info` write through `console.log`. `warn` writes
  through `console.warn`. `error` writes through `console.error`. So the severity filter of the
  browser console, and its stack traces, continue to work. There is no transport to configure.
- **There are four ordered levels**, which are `debug`, `info`, `warn` and `error`. The default is
  `info` in development and in tests, and `warn` in a built app. The build folds
  `globalThis.__IMP_DEV__` to `false`, and the logger reads that value, see `development-checks.md`.
  So a warning and an error from the library always show, a built app does not fill the console of
  every user, and you turn debug tracing on yourself. There is deliberately no way to silence an
  error.
- **The level comes from the environment.** It is the `IMP_LOG_LEVEL` value in the selected
  environment file. imp reads it from the injected `env` object on first use, and remembers it. imp
  warns about an unknown value, and falls back to the default. `setLogLevel` overrides the level at
  runtime, and you can call it from the browser console on a running app. imp reads the value
  lazily, not at import. So a bundler can still drop the module, see `tree-shakeable-library.md`.
- **A named logger puts its name in front of a message.** `createLogger(name)` merges `name:` into
  the first string argument. So a message reaches the console as one string that you can filter. An
  app selects its own name. The library does not call `createLogger`. `logger.js` exports a
  ready-made `impLogger` under the `imp` name, and every library module imports that. So logging
  pins no module into a bundle.
- **The debug level traces the activity of the library.** It covers a state read, an applied set, a
  skipped set, a `watch` that attaches and detaches, a notification with its subscriber count, a
  state that imp initializes, resolves and binds again, a computed recompute, and a component that
  imp defines, mounts, unmounts and moves.

## Consequences

- One log level governs the library, and any app code that adopts the logger. One environment value
  moves a whole app between a quiet production run and a traced development run.
- Debug tracing answers the question "why did this binding update, or not update?" from the console
  alone. imp logs a set that the equality gate skipped, explicitly.
- A message keeps the `imp:` prefix as part of its first argument. So a console filter, and an
  existing test that matches a message, both continue to work.
- A debug call per read and per set sits on a hot path. Below the active level, such a call costs
  one comparison of the rank, and one array of arguments. That is acceptable. There is no batching
  of messages, no file sink and no remote transport. An app that needs those wraps the logger, or
  replaces it.
