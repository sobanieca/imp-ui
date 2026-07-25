# `imp init` — scaffold a new project

Add an `imp init` command that scaffolds a minimal, ready-to-run imp project in the current
directory — the `npm init` equivalent for imp. The whole point is a frictionless start: a new user
runs one command and immediately has something they can `imp start`. Keep the output tiny — a basic
hello-world page, an `imp.json`, and a `.gitignore` — not a heavy template with folders they have to
learn before writing any code.

## Usage

```
imp init [dir] [--pwa]
```

- **No `dir`** — scaffold into the current working directory.
- **`dir` given** — create that directory (if needed) and scaffold into it.
- **`--pwa`** — also scaffold the project as a Progressive Web App (see **PWA scaffolding** below).

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
  output directory (`dist/`, the default `imp build` outdir) plus the usual OS/editor noise. It must
  ignore **all `.env` files** — `.env` and every `.env.*` variant — because imp environments can be
  authored as `.env` files (`{ "prod": "env/prod.env" }`) that hold `$env.` secrets or per-developer
  values and must never be committed. It must ignore **`.imp/`** — imp's per-project working
  directory, where `imp start` writes its rolling dev log (`.imp/dev.log`) and `imp test` writes
  failure screenshots and recorded videos; none of it belongs in the repo. Also fold in the popular
  Node.js / general JS ignores (e.g. `node_modules/`, `*.log`, `.DS_Store` and similar) — even
  though a pure imp project needs none of them, some users will still reach for Node.js or Deno for
  parts of their workflow, so a familiar batteries-included ignore file saves them from re-adding
  those lines. **Do not** ignore `dependencies/` — vendored dependencies are committed to the repo
  (there is no lock file; the committed bundle _is_ the frozen state, see `docs/dependencies.md`),
  so ignoring them would break the model.

That is the complete file set — no `src/`, no example components, no README. Anything richer belongs
in a separate example/showcase effort (`todo/example-showcase-repos.md`), not in `imp init`.

## PWA scaffolding — `imp init --pwa`

With `--pwa`, `init` scaffolds the project so it is installable from the first `imp start` and ready
for `imp build --pwa` — no hand-editing to wire up the PWA. It does not change any of the base files
above; it augments them. On top of the standard set it:

- **Adds a `pwa` block to the generated `imp.json`**, pre-populated with the fields a user tunes
  next so the block doubles as documentation of what is available (see `adr/pwa-toolkit.md` and
  `cli/src/config.js` for the validated shape). Write the two required fields plus the common
  optional ones:

  ```json
  {
    "pwa": {
      "name": "My imp app",
      "shortName": "imp app",
      "themeColor": "#0b0b0b",
      "backgroundColor": "#ffffff",
      "display": "standalone",
      "icon": "icon.svg"
    }
  }
  ```

  Derive `name`/`shortName` from the target directory name where sensible. Keep the values as
  ready-to-edit placeholders — the point is a valid, complete block the user only has to rename, not
  a blank one they must look up the keys for.
- **Writes a placeholder source icon** (the file `pwa.icon` points at, e.g. `icon.svg`). `pwa.icon`
  is required and must resolve to a real file, so a `--pwa` scaffold that omitted it would fail
  validation on the first `imp build --pwa`. A tiny self-contained SVG (a filled square or the imp
  glyph) is enough — imp scales the whole icon set from this one source, so no other icon files are
  written.

When `--pwa` is **not** passed, `imp.json` gets no `pwa` block and no icon is written — the base
scaffold stays as minimal as described above.

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
project. Document the `--pwa` flag too — that it adds a ready-to-edit `pwa` block and a placeholder
icon so the project is installable and `imp build --pwa`-ready out of the box — and link it to the
existing **Progressive Web App** section. Keep to the docs rules — reader-facing prose only, no
references to source files or `todo/`/`adr/`.

## Open questions

- **Existing-files behavior.** Hard refuse if any target file exists, or fill in only the missing
  ones? Pick the least-surprising default and note it in the docs.
- **`imp.json` contents.** Truly empty `{}` versus a minimal skeleton with the keys a beginner is
  most likely to want next — balance "nothing to learn" against "somewhere obvious to start
  editing".
- **`--pwa` placeholder icon.** Ship a generic built-in placeholder SVG, or generate a trivial one
  on the fly? Either is fine as long as `pwa.icon` resolves to a real file; pick the simpler and
  note that users are expected to replace it with their own artwork.
