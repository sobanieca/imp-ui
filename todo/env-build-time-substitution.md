# Build-time substitution of `env` values

`env` is read at runtime from the `__IMP_ENV__` global the dev server and the build inject
(`adr/environments.md`), which is what keeps `imp start` and `imp build` on one mechanism. The cost
is that no bundler can see through it: code an app gates behind an environment flag is inert in
production but still shipped.

The case that made this visible is the HTTP client's mock handlers (`adr/http-client.md`):
`mock: env.MOCK && { … }` never runs in production, yet the handler map is bundled, because
`env.MOCK` is a property read rather than a literal. Today the workaround is the thunk form
(`mock: env.MOCK && (() => import('./mocks.js'))`), which esbuild splits into a chunk that is never
fetched — the fixtures leave the main bundle, but the gate itself stays.

The fix the environments ADR already anticipates: an esbuild `define` layer over `env` in
`imp build`, substituting each selected key as a literal so the branch folds away and dead code is
dropped. Points to settle:

- **Only the build substitutes**; `imp start` keeps reading the global, so a dev reload still picks
  up a changed env file without a rebuild. The two must stay observably identical for everything
  except dead-code elimination.
- **`env` is used as an object** (`import { env } from 'imp'`, then `env.API_URL`), so the define
  has to reach member expressions — either by defining `env.NAME` per key, or by keeping the frozen
  object and additionally defining the keys the bundle reads.
- **A key the selected environment does not define** must keep resolving to `undefined` rather than
  becoming a build error, since that is what the runtime does today.
- Whether the substituted bundle should still carry the injected global at all (it must, for keys
  reached dynamically, e.g. `env[name]`).
