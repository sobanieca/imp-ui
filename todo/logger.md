# Built-in logger

All logging must go through a built-in imp.js logger (to be implemented). Route every log through
it, including existing ones (e.g. the `console.warn` in `src/render.js` for multiple props objects).
No direct `console.*` calls in library code.
