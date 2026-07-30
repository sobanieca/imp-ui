# A single non-interactive scaffold, small enough to delete

## Context

A new imp project needs an `imp.json`, a page, a `public/` folder and an entry module before
anything runs. Assembling that by hand means reading documentation before writing a line of app
code, and it invites the two mistakes imp most wants to prevent: a hand-written `deno.json` and a
`.gitignore` that either commits `.env` files or ignores the vendored `dependencies/` folder.

imp assumes an AI agent is a first-class user of every command. A scaffolder that asks questions —
framework flavour, TypeScript or not, which test runner — cannot be run unattended, and imp has no
such choices to offer anyway: there is one runtime, one test runner, one formatter.

## Decision

`imp init [dir] [--pwa]` scaffolds a project. It is **non-interactive**: no prompts, no flags beyond
the target directory and `--pwa`, the same output every time.

It writes one fixed file set — `imp.json`, `index.html`, `src/main.js`, `src/app.js`,
`test/app.test.js`, `test/app.spec.js`, `public/favicon.svg`, `.gitignore` — and nothing else. The
app is a click counter: one component, one namespaced state, a live text node, a standard-library
button. It exists to be deleted, so it stays at one screen of code.

Three properties fix the shape:

- **Both test levels ship.** `imp test --unit` and `imp test --e2e` have a passing file from minute
  one, so the two-level model (`two-level-testing.md`) is demonstrated rather than described, and an
  agent has a working example of shadow-boundary selectors to copy.
- **The scaffold is a passing project.** `imp lint`, `imp fmt --check` and both test levels succeed
  against the untouched output; a CLI test asserts it, so the templates cannot drift from imp's own
  rules.
- **`imp.json` pins the version that wrote it**, so the project runs on that imp release until
  someone runs `imp update` (`version-pinning-self-delegation.md`).

`--pwa` augments the same set: a filled-in `pwa` block and an `icon.svg` at the project root — a
build input, so it stays out of `public/` (`public-folder-static-assets.md`).

**A conflict aborts the whole run.** If any target file exists, `imp init` writes nothing, names the
conflicts and exits `1`. It never partially fills a directory someone is working in; an existing
empty `public/` folder is not a conflict.

**`.gitignore` is the single exception, and it merges.** Scaffolding into a repository that already
has one is ordinary, and refusing over it would push people to run `init` in a scratch directory and
copy files back. So imp appends only the entries the existing file does not already cover and warns
that it changed it. Coverage is decided by matching patterns, not comparing lines — each existing
entry becomes a glob matcher tested against imp's entries — so `node_modules` subsumes
`node_modules/`, `/dist` subsumes `dist/`, and `.env*` subsumes both `.env` and `.env.*`. The
alternative, appending imp's block verbatim, produces the duplicated, drifting ignore files that
make this exception feel unsafe in the first place.

## Consequences

- **No template gallery.** There is one scaffold. A larger starting point is a showcase repository
  to clone, not a flag on `init`, so this command never grows a matrix of combinations to maintain.
- **The scaffold is a maintenance surface.** Every template is imp source held to imp's own lint and
  formatting rules, and a change to a rule, a std component or the state API can break it — which
  the CLI test catches, because it lints, formats and runs the generated project.
- **All-or-nothing is occasionally inconvenient** — someone with a stray `index.html` must move it
  aside — in exchange for a command that can never half-write over existing work.
- **Pattern matching for the ignore merge is deliberately shallow.** It normalizes leading and
  trailing slashes and reads `*`, `**` and `?` as globs; it does not model directory anchoring or
  negations (`!foo`), which are ignored as coverage. Worst case it appends an entry that was already
  covered by an exotic pattern — an extra line, never a lost one.
- **The default mark is imp's own.** A scaffolded project ships imp-branded artwork as a
  placeholder, which is honest about being a placeholder and gives the PWA icon pipeline a real
  source image to render from.
