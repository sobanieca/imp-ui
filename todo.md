# TODO

- `imp lint` rule: flag passing more than one props object to a single element factory call (e.g.
  `div(propsA, propsB, ...)`). Only one props object per call is supported; the runtime warns, but
  lint should catch it statically.
- All logging must go through a built-in imp.js logger (to be implemented). Route every log through
  it, including existing ones (e.g. the `console.warn` in `src/render.js` for multiple props
  objects). No direct `console.*` calls in library code.
- `imp bundle` command: pack an app into a prod-ready, self-contained bundle. Must reuse the same
  resolution as the dev server (`prepareConfig` → `imp.json` / `imp.lock`) so dev and prod resolve
  specifiers identically, and resolve `imp`, `npm:`/`jsr:`, and `imp.json` bare aliases the same way
  `imp start` does. Emit minified output plus source maps. Also revisit the dev server's one-copy-
  per-top-level-package limitation here — share singletons (e.g. React) via externalization keyed by
  resolved package identity.
