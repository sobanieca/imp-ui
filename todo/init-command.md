# `imp init` — scaffold a new project

Add an `imp init` command that scaffolds a minimal, ready-to-run imp project in the current
directory — the `npm init` equivalent for imp. The whole point is a frictionless start: a new user
runs one command and immediately has something they can `imp start`. Keep the output tiny — a basic
hello-world page, an `imp.json`, and a `.gitignore` — not a heavy template with folders they have to
learn before writing any code.

## Usage

```
imp init [dir]
```

- **No `dir`** — scaffold into the current working directory.
- **`dir` given** — create that directory (if needed) and scaffold into it.

Wire it into the `cli/src/main.js` dispatch and the `HELP` usage text, lazily importing a new
`cli/src/init.js`, matching how the other commands are dispatched.

## What it writes

Only the minimum to run. Do not generate more than this:

- **`index.html`** — a hello-world page. A heading and a short line of text is enough; it must
  render as-is under `imp start` with imp's auto-injection (import map + client script) doing its
  part, so the file itself stays plain HTML with no build step. Keep it small enough to read at a
  glance.
- **`imp.json`** — a basic config. Start essentially empty (an empty object, or just a comment-free
  minimal skeleton) so the file exists as the place users edit later, without pre-populating keys
  they do not need yet. Do **not** write a `deno.json` — per the "hide Deno" rule the CLI reads
  `imp.json` in-process; users only ever see `imp.json`.
- **`.gitignore`** — a proper ignore file for an imp project. It should ignore the production bundle
  output directory (`dist/`, the default `imp build` outdir) plus the usual OS/editor noise. Also
  fold in the popular Node.js / general JS ignores (e.g. `node_modules/`, `*.log`, `.env`,
  `.DS_Store` and similar) — even though a pure imp project needs none of them, some users will
  still reach for Node.js or Deno for parts of their workflow, so a familiar batteries-included
  ignore file saves them from re-adding those lines. **Do not** ignore `dependencies/` — vendored
  dependencies are committed to the repo (there is no lock file; the committed bundle _is_ the
  frozen state, see `docs/dependencies.md`), so ignoring them would break the model.

That is the complete file set — no `src/`, no example components, no README. Anything richer belongs
in a separate example/showcase effort (`todo/example-todo-app.md`,
`todo/example-showcase-repos.md`), not in `imp init`.

## After scaffolding — print run instructions

On success, print a short, friendly next-steps block so the user knows exactly how to run what was
just created — the payoff that makes `init` feel complete. Speak in `imp` terms only (never `deno`):

```
Created a new imp project.

Next steps:
  imp start        start the dev server and open the page
```

If a `dir` was given, prefix with the `cd <dir>` step. List what was written (the three files) so
the result is transparent.

## Safety

Do not clobber an existing project. If `imp.json`, `index.html`, or `.gitignore` already exist in
the target, refuse (or skip only the missing files) with a clear message rather than overwriting a
user's work — decide which of the two behaviors is least surprising and document it.

## Docs

Document `imp init` in `docs/cli.md`: the usage form, the exact files it writes, the deliberately
minimal scope, and the printed run instructions. Frame it as the recommended first command for a new
project. Keep to the docs rules — reader-facing prose only, no references to source files or
`todo/`/`adr/`.

## Open questions

- **Existing-files behavior.** Hard refuse if any target file exists, or fill in only the missing
  ones? Pick the least-surprising default and note it in the docs.
- **`imp.json` contents.** Truly empty `{}` versus a minimal skeleton with the keys a beginner is
  most likely to want next — balance "nothing to learn" against "somewhere obvious to start
  editing".
