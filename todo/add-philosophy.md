# Philosophy — a statement of what imp is, for the landing page

Write imp's philosophy down as landing-page copy: a short, confident statement of what imp is and
what it believes, distilled from the existing `docs/` and folded into the home page built by
`todo/landing-site.md`. Today the philosophy is only implicit — spread across the CLI, rendering,
dependencies, and testing docs — and the landing page needs it stated in one place, in the reader's
language.

## The one-sentence version

imp is an opinionated, all-in-one, buildless frontend toolkit that treats the browser platform and
your git repository as the only sources of truth — no build step while you work, no package registry
at runtime, no configuration to assemble — built so that builders (and their AI agents) can develop,
test, and ship a web app with a single tool.

## The pillars (each already grounded in `docs/`)

- **Buildless development, platform-native code.** No compile step, no JSX, no virtual DOM —
  components are plain lowercase functions returning real DOM nodes, props are verbatim HTML
  attribute names, and `imp start` serves exactly the source you typed. Production is the one place
  a build exists, and it emits plain static files for any CDN.
- **The repository is the whole truth.** Dependencies are vendored, bundled, and committed; versions
  are exact pins; there is no lock file because the committed bytes _are_ the frozen state. A fresh
  clone is the whole, runnable app — offline, reproducible, reviewable.
- **Opinionated, for most web apps.** imp makes the decisions — one config file, one test runner,
  one formatter, safe defaults everywhere — and aims to be the right fit for the large majority of
  web applications, not a perfect fit for all of them. Builders who accept its constraints get to
  skip assembling and reconciling a toolchain and just build. (Aligns with the "honest constraints"
  section of `todo/landing-site.md`.)
- **A single tool to bring value.** The audience is builders who want one tool that carries them
  from first file to shipped product — dev server, dependency manager, builder, test runner, linter,
  formatter in one binary — so their energy goes into the product, not the plumbing.
- **Batteries included, not tiny.** imp is deliberately **not** a minimal micro-library. It grows
  toward a substantial standard library of components — forms, overlays, navigation, and data
  visualization among them (`todo/stdlib-components.md`) — so a builder can realistically stay
  within imp and ship real apps with **zero external dependencies**. Vendoring keeps outside
  packages honest when needed, but the goal is to rarely need them.
- **Built for the AI era.** Every surface is designed to be driven and read by an AI agent as well
  as a person: browser console, errors, and network traffic stream to the terminal; test output is
  plain text; e2e specs record themselves as GIFs for human review of agent-built features.

## Where it lands

- The philosophy becomes a section (or the framing spine) of the home page in `todo/landing-site.md`
  — it complements, not duplicates, that item's SPA argument and honest constraints sections.
- Follow the `docs/` rules: written for an external reader, no repo internals, no Deno surfaced.

## Open questions

- Whether the philosophy is one dedicated page/section or the narrative thread woven through the
  whole landing page.
- Tone check against the "confident, not preachy" bar set in `todo/landing-site.md`.
