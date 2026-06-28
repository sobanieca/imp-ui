# TODO

- `imp lint` rule: flag passing more than one props object to a single element factory call (e.g.
  `div(propsA, propsB, ...)`). Only one props object per call is supported; the runtime warns, but
  lint should catch it statically.
- All logging must go through a built-in imp.js logger (to be implemented). Route every log through
  it, including existing ones (e.g. the `console.warn` in `src/render.js` for multiple props
  objects). No direct `console.*` calls in library code.
