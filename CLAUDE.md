# CLAUDE.md

## imp is unreleased — do not preserve backward compatibility

Until imp ships a `1.` version or higher, **treat it as never having been released**: there are no
existing users, no installed apps, and nothing in the wild to break. So when a better design shows
up, take it outright — rename or remove an export, change a config key, change what a command
prints, change the shape of anything.

- **Never add a compatibility shim, a deprecated alias, a fallback path, or a migration note.** Fix
  every call site in this repo, update the docs and skills to describe only the new design, and
  delete the old one.
- **Never let the old design survive in prose.** Docs, skills and ADRs describe what imp does now;
  they are not a changelog, and they must not mention what a key or an export used to be called.
- Reconsider this only when the version reaches `1.0.0` — from then on, a breaking change is a real
  cost to weigh.

## Hide Deno from the user

imp uses Deno as its underlying runtime and toolchain, but **this must stay an implementation
detail** — users should not need to know Deno is involved to use imp. Keep every user-facing surface
imp-branded:

- **Config** lives in `imp.json`, never a user-authored `deno.json`. The CLI reads `imp.json`
  in-process and applies its settings directly — there is no derived `deno.json` written to disk;
  users only ever edit `imp.json`.
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

Docs are for a person. The agent-facing text for the same subject lives in `skills/` — see below.

## Agent skills (`skills/` and `*.skill.md`)

`skills/` is the corpus `imp skill <subject>` prints for an AI agent (`adr/agent-skills.md`). It is
the **only** documentation compiled into the binary; `docs/` is the public site's source and is
never read at runtime. One page per subject, registered in `cli/src/skill.js` with its summary,
group and aliases; a test asserts the folder and the registry match exactly.

The two corpora are **independent**. They serve different readers through different channels, so
neither dictates the other's structure: a subject may be one skills page and part of a docs page, or
the reverse, and an agent-only page with no docs counterpart is fine. Page names happen to line up
today; nothing enforces that.

A skill page is the same subject as its docs page, written for a different reader: an agent that
needs to write correct code now and pays for every token it reads. So it is short and mechanical —
the imports, the call shapes, API/prop/option tables, **the rules an agent gets wrong**, one worked
example — and it drops the narrative, the rationale, and the reassurance a person reads a guide for.
It is read as plain text in a terminal, so keep it self-contained; a link to a sibling page
(`[state](state.md)`) is rewritten into `state (imp skill state)` when it prints, and every target
is listed again on a `Related:` line at the foot of the page. Since the rewrite adds parentheses of
its own, never wrap a link in yours: write `see [state](state.md)`, not `([state](state.md))`, which
prints as the doubled `(state (imp skill state))`.

Every component also ships an agent-facing manual next to it — `button.js` → `button.skill.md` — and
standard components register theirs in `cli/src/skill.js`, which a test enforces against the
`imp/std` barrels. Its first line is its summary, so start it with the component name. The same file
is what `imp build` folds into a JS-entry bundle as `impSkill`, so it is the only place a
component's skill is written.

**Changing a feature means updating both audiences in the same change**: its `docs/` page for the
reader, and its `skills/` page (and any component's `*.skill.md`) for the agent. No test can check
this — a page can be present and stale — so it is on whoever makes the change.

## Running the tests

**Always go through the `deno task` scripts — never invoke the compiled `./imp` binary directly to
run the library tests.** `deno task test:lib` and `test:lib:e2e` run the CLI from source
(`cli/src/main.js`), which resolves the library straight out of `lib/src`, so they can never test
stale code. Running `../../imp test` from `lib/test` uses the **compiled** binary with the library
baked in, so every edit to `lib/src` is invisible until `deno task compile` runs again — a green run
there proves nothing about the code you just wrote. `deno task test:cli` compiles first on purpose,
because the compiled binary is what it tests.

## After making changes

After completing a batch of code changes, always run `deno lint` and `deno fmt` and address any
issues they report before considering the work done. These operate on imp's own repo source, so it
is fine to invoke Deno directly here — this is internal maintainer tooling, not a user-facing
surface.

**Keep whatever `deno fmt` touches — even out-of-scope files.** `deno fmt` runs repo-wide and may
reformat files unrelated to your change (e.g. pre-existing formatting drift in other `todo/` or
`adr/` files). Do **not** revert those reformats to keep a diff "focused" — the repo's canonical
state is the formatted one, so leave every change `deno fmt` makes in place and include it in the
commit.

**`deno lint` must pass clean.** If it reports an error — whether in code you just wrote or anywhere
else it surfaces — fix it before considering the work done; do not ignore, suppress, or leave lint
errors behind.

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

## Accessibility

**imp supports accessibility out of the box.** An app built from standard components clears the
common WCAG bar without the app author wiring ARIA, focus, or keyboard handling by hand —
accessibility is a property of the components imp ships, not something each app re-implements. Treat
it as a shipping requirement of every component, never a follow-up pass. The full contract and its
open questions live in `todo/accessibility.md`.

When building or changing a standard component:

- **Render the native element wherever one exists** (`button`, `a[href]`, `input`, `<dialog>`) so
  roles, states and keyboard behaviour come from the platform. Add ARIA roles only where no native
  element fits. ARIA changes what is _announced_, never what an element _does_ — a `role` on a `div`
  buys nothing until the focus and key handling are written by hand as well.
- **Keep ARIA id references inside a single component.** `aria-labelledby`, `aria-describedby`,
  `aria-controls`, `aria-activedescendant`, `aria-errormessage` and `label[for]` resolve by id and
  **cannot cross a shadow root** (`adr/shadow-dom-isolation.md`). Two elements that need a reference
  between them must be rendered by the same component, so this decides where the component boundary
  falls — settle it while designing the props, not after, because it is the one accessibility
  decision that cannot be retrofitted without breaking the public API. Prefer a data-driven prop
  (`tabs({ items })`) over a compositional one wherever an internal reference exists; `aria-label`
  is a plain string and crosses boundaries freely, so it is how a control is named from outside.
- **Every pointer interaction has a keyboard equivalent** — Tab order, Enter/Space activation, arrow
  keys for composite widgets, Escape to dismiss overlays.
- **Bind ARIA state to the same state that drives the visuals**, so `aria-expanded`,
  `aria-selected`, `aria-checked` and `aria-busy` can never drift from what is shown. A state
  attribute written once at mount and never updated is worse than none — it actively lies.
- **Every interactive element needs an accessible name.** Icon-only controls take an explicit label
  prop, and user-facing strings route through `t()` (`adr/translatable-by-default.md`).
- **Styling:** a `:focus-visible` ring from the shared `focusRing`, contrast-carrying widths from
  `--imp-border-width` / `--imp-focus-ring-width` rather than hardcoded values, the shared
  `forcedColors` block wherever colour alone distinguishes two things, and `prefers-reduced-motion`
  respected by anything that animates.
- **Interactive components ship with a test** asserting role, accessible name and keyboard
  operability. The baseline is a test-backed guarantee, not a best-effort convention.
