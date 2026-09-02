# A single non-interactive scaffold, small enough to delete

## Context

A new imp project needs an `imp.json`, a page, a `public/` folder and an entry module, before
anything runs. To assemble that by hand, a person reads the documentation before they write a line
of app code. It also invites the two mistakes that imp most wants to prevent. The first is a
`deno.json` that somebody wrote by hand. The second is a `.gitignore` that either commits a `.env`
file, or ignores the vendored `dependencies/` folder.

imp assumes that an AI agent is a first-class user of every command. A scaffolder that asks a
question cannot run unattended. Such a question could be the flavour of the framework, TypeScript or
not, or which test runner. imp has no such choice to offer in any case. There is one runtime, one
test runner and one formatter.

## Decision

`imp init [dir] [--pwa]` scaffolds a project. It is **non-interactive**. There is no prompt, and
there is no flag other than the target directory and `--pwa`. It produces the same output every
time.

It writes one fixed set of files, and nothing else. That set is `imp.json`, `index.html`,
`src/main.js`, `src/app.js`, `test/app.test.js`, `test/app.spec.js`, `public/favicon.svg` and
`.gitignore`. The app is a click counter. It has one component, one namespaced state, a live text
node, and a button from the standard library. It exists to be deleted, so it stays at one screen of
code.

Three properties fix the shape:

- **Both test levels ship.** `imp test --unit` and `imp test --e2e` each have a passing file from
  the first minute. So imp shows the two-level model, see `two-level-testing.md`, and does not only
  describe it. An agent also has a working example of a selector across a shadow boundary, to copy.
- **The scaffold is a project that passes.** `imp lint`, `imp fmt --check` and both test levels
  succeed against the output before anybody changes it. A CLI test asserts that. So the templates
  cannot fall behind the rules of imp.
- **`imp.json` pins the version that wrote it.** So the project runs on that imp release, until
  somebody runs `imp update`, see `version-pinning-self-delegation.md`.

`--pwa` adds to the same set. It adds a complete `pwa` block, and an `icon.svg` at the project root.
That image is a build input, so it stays out of `public/`, see `public-folder-static-assets.md`.

**A conflict stops the whole run.** When one target file exists, `imp init` writes nothing, names
the conflicts, and exits `1`. It never partly fills a directory that somebody works in. A `public/`
folder that is already present and empty is not a conflict.

**`.gitignore` is the one exception, and imp merges it.** It is ordinary to scaffold into a
repository that already has one. To refuse over that file would push a person to run `init` in a
scratch directory, and to copy the files back. So imp appends only the entries that the existing
file does not cover, and it warns that it changed the file. imp decides coverage by a match of
patterns, and not by a comparison of lines. It turns each existing entry into a glob matcher, and
tests that matcher against the entries of imp. So `node_modules` covers `node_modules/`, `/dist`
covers `dist/`, and `.env*` covers `.env` and `.env.*`. The alternative was to append the block of
imp without a check. That produces the duplicated, drifting ignore files that make this exception
feel unsafe.

## Consequences

- **There is no gallery of templates.** There is one scaffold. A larger starting point is a showcase
  repository that you clone. It is not a flag on `init`. So this command never grows a matrix of
  combinations to maintain.
- **The scaffold is a surface to maintain.** Every template is imp source, held to the lint rules
  and the formatting rules of imp. A change to a rule, to a std component, or to the state API, can
  break it. The CLI test catches that, because it lints, formats and runs the generated project.
- **All or nothing is sometimes inconvenient.** A person with a stray `index.html` must move it
  aside. In exchange, the command can never half write over existing work.
- **The match of patterns for the ignore merge is deliberately shallow.** It normalizes a leading
  and a trailing slash, and reads `*`, `**` and `?` as a glob. It does not model the anchoring of a
  directory, and it does not model a negation such as `!foo`, which it reads as coverage. In the
  worst case it appends an entry that an unusual pattern already covered. That is one extra line,
  and never a lost one.
- **The default mark is the mark of imp.** A scaffolded project ships artwork with the imp brand, as
  a placeholder. That is honest about being a placeholder, and it gives the PWA icon pipeline a real
  source image to render from.
