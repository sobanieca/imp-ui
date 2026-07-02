# `imp bundle` command

Pack an app into a prod-ready, self-contained bundle. Must reuse the same resolution as the dev
server (`prepareConfig` → `imp.json` / `imp.lock`) so dev and prod resolve specifiers identically,
and resolve `imp`, `npm:`/`jsr:`, and `imp.json` bare aliases the same way `imp start` does. Emit
minified output plus source maps. Also revisit the dev server's one-copy-per-top-level-package
limitation here — share singletons (e.g. React) via externalization keyed by resolved package
identity.
