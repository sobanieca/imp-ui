# CLAUDE.md

## `prev/` folder

The `prev/` folder stores previous brainstorming ideas and experiments. **Always ignore it** during
normal work — do not read, search, edit, or reference its contents unless I explicitly ask you to
review specific code there.

## Hide Deno from the user

imp uses Deno as its underlying runtime and toolchain, but **this must stay an implementation
detail** — users should not need to know Deno is involved to use imp. Keep every user-facing surface
imp-branded:

- **Config** lives in `imp.json`, never a user-authored `deno.json`. The CLI derives an internal
  Deno config (`.imp/deno.json`, gitignored) from it on the fly; users only ever edit `imp.json`.
- **Lockfile** is surfaced as `imp.lock`, not `deno.lock`.
- **Commands and docs** speak in terms of `imp` (`imp start`, `imp lint`, …), not `deno` — even
  though they shell out to Deno underneath.

The one exception is imp's _own_ repo manifest (`deno.json` at the project root), which is imp's
internal build file and is baked into the compiled binary — end users never see it. When adding
features, route any new Deno-tooling dependency through this same translation layer rather than
asking users to touch Deno directly.

## ADRs (`adr/`)

ADRs record accepted architectural decisions, one decision per file. Conventions:

- **Presence means accepted.** There is no status field and no numbering — every ADR in `adr/`
  reflects the current, accepted state of that decision.
- **File names are descriptive slugs** (`real-dom-no-virtual-dom.md`), not numbers.
- **Format per record:** Context · Decision · Consequences.
- **When a decision changes**, replace the old ADR with a new one describing the new decision (or
  delete it if the decision is dropped) — do not keep superseded records around and do not add
  status markers.
- **Keep ADRs in sync with the code.** An ADR must not describe features that are not implemented;
  planned work belongs in `todo/`. Keep the table in `adr/README.md` updated when adding, renaming,
  or removing ADRs, and use the file-name slug when referencing an ADR from other ADRs.

## TODOs (`todo/`)

Planned work lives in `todo/`, one item per file. File names are descriptive slugs
(`version-manager.md`), matching the ADR convention. When an item is implemented, delete its file
(and record any architectural decision it introduced as an ADR).

## Docs (`docs/`)

`docs/` is public-facing documentation, written for an external reader: a software developer who
wants to learn imp's features and what it makes possible, and who will never read imp's source code.
The docs will be published on a public site, so:

- Explain everything in terms of what the reader writes and what imp does for them — never point at
  source files, internal function names, or repo paths.
- Do not reference `adr/` or `todo/` from docs. When a design rationale helps the reader, summarize
  it inline in plain language.
- No maintainer notes or TODO markers in docs — planned work belongs in `todo/`.

## After making changes

After completing a batch of code changes, always run `deno lint` and `deno fmt` and address any
issues they report before considering the work done. These operate on imp's own repo source, so it
is fine to invoke Deno directly here — this is internal maintainer tooling, not a user-facing
surface.

## Code style

**Do not add comments to code.** Write self-explanatory code instead — use clear, descriptive names
for functions, variables, and constants so the intent is obvious without comments. Reserve prose
explanations for the docs (`docs/`) and ADRs (`adr/`), not inline in source files.

**Use modern JavaScript syntax (ES2017 / ES7 and newer).** This project targets modern browsers and
Deno only — there is no transpilation or legacy support, so write current idiomatic JS. Prefer
`const`/`let` over `var`; arrow functions and rest/spread params over `function`/`arguments`;
template literals over string concatenation; destructuring, `for...of`, optional chaining (`?.`),
nullish coalescing (`??`), `async`/`await`, and other current language features. This applies to
browser-targeted code too, including scripts emitted as strings (e.g. injected client and service
worker code).
