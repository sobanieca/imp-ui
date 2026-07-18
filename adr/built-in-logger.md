# Built-in logger: one console-backed logger, level from the environment

## Context

Library diagnostics were raw `console.warn`/`console.error` calls scattered through the source, with
no way to trace what the state layer does at runtime — which sets were applied or skipped by the
structural-equality gate, who subscribed, what was read — short of a debugger. Apps had no shared
mechanism either: turning diagnostics on in dev and off in prod meant hand-rolled wrappers. The
environments feature (see `environments.md`) already gives every app a per-target value bag, so a
log level can ride the same mechanism instead of introducing new configuration.

## Decision

- **One logger module in the library** (`imp` exports `logger`, `createLogger`, `setLogLevel`,
  `logLevel`). All library logging goes through it — no direct `console.*` calls anywhere else in
  library code.
- **Console is the only sink.** `debug` and `info` write through `console.log`, `warn` through
  `console.warn`, `error` through `console.error` — the browser console's severity filtering and
  stack traces keep working, and there is no transport abstraction to configure.
- **Five ordered levels** — `debug`, `info`, `warn`, `error`, `silent` — with `info` as default: the
  library's warnings and errors always show unless deliberately silenced, debug tracing is opt-in.
- **The level comes from the environment**: the `IMP_LOG_LEVEL` value in the selected environment
  file, read once at load from the injected `env` object; an unknown value warns and falls back to
  the default. `setLogLevel` overrides at runtime (usable from the browser console on a running
  app).
- **Named loggers prefix messages.** `createLogger(name)` merges `name:` into the first string
  argument, so a message reaches the console as a single filterable string; the library logs under
  the `imp` name, apps pick their own.
- **Debug level traces library activity**: state reads, applied and skipped sets, watch
  attach/detach, notifications with subscriber counts, state init/resolve/rebind, computed
  recomputes, and component define/mount/unmount/move.

## Consequences

- One log level governs the library and any app code that adopts the logger; a single environment
  value flips a whole app between quiet prod and traced dev.
- Debug tracing answers "why did this binding update (or not)" from the console alone — sets skipped
  by the equality gate are logged explicitly.
- Messages keep the `imp:` prefix as part of the first argument, so console filtering and existing
  message-based tests keep working.
- Per-read and per-set debug calls sit on hot paths; below the active level they cost one rank
  comparison and an argument array, which is acceptable. There is no message batching, file sink, or
  remote shipping — apps needing those wrap or replace the logger.
