# Vendor packages that keep external imports in `imp install`

`imp bundle --external` produces component bundles whose bare `imp` (or dependency-alias) imports
are left for the host to resolve (`adr/production-bundling.md`). The consumer side of that contract
is missing: when `imp install` vendors a published package whose code contains a bare `imp` import,
the resolver treats it like any registry package — it would resolve `imp` against npm (an unrelated
package of that name) or fail, instead of leaving the import bare.

Work:

- Teach `bundleDependency` (`src/cli/deps.js`) to treat `imp` — and possibly the installing app's
  declared aliases — as external while vendoring, so the vendored bundle keeps bare imports. The
  rest already works: the dev server's import map resolves them in the page, and the consuming app's
  `imp bundle` resolves them at build time.
- Decide how the imp version skew surfaces to the consumer: an externalized component runs against
  the host's imp version, not the one it was authored against. At minimum note the external imports
  in `imp install`'s printed resolution; consider warning when a vendored package expects imp.
- Decide whether externals apply to every install or need an opt-in (a flag, or detection of a bare
  `imp` import in the package).
