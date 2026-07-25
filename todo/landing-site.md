# Landing site — home page and docs from Markdown

Build imp's public home page and turn the existing `docs/` Markdown into a browsable HTML site. This
is imp's own shopfront: the first thing a builder sees, and the place the docs live once published.

## Markdown → HTML engine

An engine that converts the existing `docs/*.md` into HTML pages — the same files maintainers
already edit stay the single source of truth, and the site is generated from them rather than
hand-authored a second time.

- Render each `docs/*.md` to a page: headings, code blocks with syntax highlighting, links, tables,
  and inline formatting. Internal `*.md` links rewrite to the generated page URLs.
- Generate navigation from the doc set (sidebar / index) so new docs appear without hand-editing a
  menu.
- Run **in-process** to honor `adr/in-process-toolchain.md` — no shelling out to an external
  Markdown CLI. Resolve a pure-JS/wasm Markdown renderer, vendored and pinned by checksum the same
  way esbuild-wasm is (`adr/in-process-dependency-bundling.md`, `cli/src/vendor`).
- Dogfood: build the site itself with imp and ship it with `imp build`
  (`adr/production-bundling.md`) so the home page and docs are a static bundle — practicing exactly
  the CDN-hosted SPA story the copy preaches.

## Home page — positioning

The landing page has to land one message: **imp is an all-in-one UI toolkit — the single tool a
builder learns to ship a valuable frontend application.** Not a stack to assemble from a router, a
state library, a bundler, a test runner, and a formatter — one tool that already is those things.
Lead with that, and let the docs prove it.

## Home page — the SPA argument

The page should make the case for the SPA architecture, plainly and confidently:

- The split between frontend and backend is **the best thing that happened to the industry.** A
  frontend that stands on its own, a backend that just serves data.
- The app reaches the user **before the first request ever hits the backend** — the UI is already
  there, loading and interactive, while data streams in behind it.
- Real advantages the split unlocks: **offline capability**, **client-side error handling**,
  **client-side state management**, instant navigation, and resilience when the network is flaky.
  These are not nostalgia — SPAs are still a big deal and still the right default for interactive
  products.
- Frame this **against** the direction other companies are pushing: back to server-side rendering,
  where you rent their servers and pay per request to render pages that a browser could have
  rendered for free. imp takes the opposite stance.
- The imp payoff: **build your SPA, drop it on any CDN of your choice, and focus on the backend.**
  No render servers to run, no per-request bill for HTML, no vendor lock-in on where it's hosted.

Keep the tone confident and builder-facing, not preachy — it should read like the docs, aimed at a
developer deciding what to learn next.

## Home page — AI changes what "best practice" means

The page should make the case that many of today's tools and frameworks are artifacts of their era:

- They were created when **JavaScript wasn't as powerful as it is now** — much of their machinery
  exists to paper over gaps in a language that has since closed them.
- They were designed to **speed up and improve the quality of code written by hand** — optimizing
  for the human author who types every line.
- **AI changes this significantly.** When an agent writes and maintains the code, the constraints
  that made a technique "bad practice" no longer bite the same way. We can **go back to some
  techniques previously considered bad practice** and use them to good effect.
- imp embraces this shift rather than carrying forward conventions built for a world that no longer
  exists.

## Home page — honest constraints

Be upfront about what imp is not, right on the landing page — it earns trust and sets expectations:

- imp does **not** chase the smallest bundle size or the best raw benchmark numbers. It's not tuned
  to win those charts, and it won't pretend to.
- It may **not be the right fit for every app** — some products have constraints imp deliberately
  doesn't optimize for. That's fine. imp aims to be **good enough for ~80% of applications**, not
  perfect for all of them.
- The trade is explicit: **once a builder accepts imp's constraints, development with imp + an AI
  agent is genuinely great.** imp's north star is **developer experience** — letting builders
  deliver value at a pace not seen before.
- Instead of **fighting the tooling** — wiring up a bundler, a router, a state library, a test
  runner, and a formatter and keeping them agreeing with each other — the developer just **focuses
  on building the app.**

Pair this with the all-in-one and SPA messaging above: the constraints are the reason the experience
is so smooth, not a caveat bolted on at the end.

## Docs constraints

Everything on the site follows the `docs/` rules in `CLAUDE.md`: written for an external reader, no
references to `adr/`, `todo/`, or repo internals, no Deno surfaced (imp-branded commands only). The
generator must not leak `adr/` or `todo/` into the published output — only `docs/` and the home page
ship.

## ADR impact

- Record a `landing-site.md` (or `docs-site-generator.md`) ADR once the approach is settled: the
  in-process Markdown engine, generation from `docs/` as the single source, and the site built and
  bundled with imp itself. Update the ADR table in `adr/README.md`.

## Open questions

- **Markdown renderer choice** that satisfies the in-process / vendored-wasm constraint and covers
  code highlighting.
- **Styling/theming** — reuse the app theming system (`adr/themable-by-default-tokens.md`) so the
  site and imp apps share one look, or a standalone site theme?
- **Where the site lives** — a `site/` app in this repo built with imp, versus a separate repo like
  the showcase repos (`todo/example-showcase-repos.md`).
- **Versioned docs** — publish docs per imp version, or always latest to start?
