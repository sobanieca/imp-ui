# Landing site - home page and docs from Markdown

Build the public home page of imp. Turn the existing Markdown in `docs/` into an HTML site that a
person can browse. This is the shop front of imp. It is the first thing that a builder sees, and it
is where the documentation lives after somebody publishes it.

## The engine that turns Markdown into HTML

Build an engine that converts each existing `docs/*.md` file into an HTML page. The files that a
maintainer already edits stay the one source of truth. imp generates the site from them, and nobody
writes the site a second time, by hand.

- Render each `docs/*.md` file to a page. Cover a heading, a code block with syntax highlighting, a
  link, a table, and inline formatting. Rewrite an internal `*.md` link to the URL of the generated
  page.
- Generate the navigation from the set of documents, as a sidebar or an index. So a new document
  appears with no edit to a menu.
- Run the engine **in process**, to honour `adr/in-process-toolchain.md`. Do not call an external
  Markdown CLI. Use the vendored `marked`, which `imp preview` already uses to render a component's
  skill file into its Skill tab, see `adr/component-preview.md`. It is pinned in
  `tools/prebundle-npm-deps.js` and bundled into `cli/src/vendor/marked.js`. Add the highlighting of
  code on top of it.
- Use imp on imp. Build the site itself with imp, and ship it with `imp build`, see
  `adr/production-bundling.md`. So the home page and the documentation are a static bundle. That
  practises exactly the story about an SPA on a CDN that the copy states.

## The home page: the positioning

The landing page must land one message. **imp is a complete UI toolkit. It is the one tool that a
builder learns, to ship a valuable frontend application.** It is not a stack that somebody assembles
from a router, a state library, a bundler, a test runner and a formatter. It is one tool that
already is all of those. Lead with that message, and let the documentation prove it.

## The home page: the workflow that imp is built around

The page must show the whole arc of building an app with imp, as a numbered walkthrough that a
visitor reads in thirty seconds. That is the concrete proof of the claim above about a complete
toolkit. Every step uses the same tool.

1. **Install the CLI.**
2. **Run `imp init`.** You get a real app, and it runs, and you connect nothing.
3. **Teach the agent about imp.** Install the skill of imp, or point the agent at `imp skill`, and
   let it read the manual for whatever it is about to use.
4. **Model the app against a mock.** Build the whole frontend with a false backend. See it working,
   before one endpoint exists.
   - Use **`imp preview`** to review a component in isolation, while you model.
   - Use **the review widget of the development tool**, in the page, to leave feedback on a specific
     page, see `adr/in-page-review-capture.md`.
5. **Get the design approved. Then remove the mocks**, and implement the backend against a frontend
   that already works.
6. **Write the unit tests and the e2e tests with imp.** There is one runner, and it is already
   there.
7. **Run `imp build`.** You get a static bundle, ready for any CDN.

This is the point to land. The step with the mocked app is not a prototype that somebody throws
away. It is the app. The loop from step 3 to step 5 is also the loop that an AI agent is good at,
and that is why imp has this shape.

## The home page: the argument for an SPA

The page must make the case for the architecture of an SPA, plainly and with confidence:

- The split between a frontend and a backend is **the best thing that happened to the industry.** A
  frontend stands on its own. A backend serves data.
- The app reaches the user **before the first request reaches the backend**. The UI is already
  there. It loads, and a person can use it, while the data arrives behind it.
- The split unlocks real advantages. Those are **work offline**, **handling an error on the
  client**, **management of state on the client**, instant navigation, and resilience when the
  network is unreliable. Those are not nostalgia. An SPA is still important, and it is still the
  correct default for an interactive product.
- Frame this **against** the direction that other companies push. That direction goes back to
  rendering on a server, where you rent their servers, and pay per request, to render a page that a
  browser could render for nothing. imp takes the opposite position.
- The gain from imp is this. **Build your SPA, put it on any CDN that you choose, and focus on the
  backend.** There is no render server to run. There is no bill per request for HTML. There is no
  lock-in to a vendor about where you host it.

Keep the tone confident, and aimed at a builder. Do not preach. It must read like the documentation,
and it must address a developer who decides what to learn next.

## The home page: AI changes what "best practice" means

The page must make the case that many of the tools and frameworks of today are artifacts of their
era:

- Somebody created them when **JavaScript was not as powerful as it is now**. Much of their
  machinery exists to cover a gap in the language, and the language has since closed that gap.
- Somebody designed them to **make code that a person writes by hand faster, and better**. They
  optimize for the human author who types every line.
- **AI changes that significantly.** When an agent writes the code, and maintains it, the
  constraints that made a technique a bad practice no longer apply in the same way. So we can
  **return to a technique that people previously called a bad practice**, and use it well.
- imp accepts that change. It does not carry forward a convention that somebody built for a world
  that no longer exists.

## The home page: honest constraints

Say plainly what imp is not, on the landing page. That earns trust, and it sets an expectation:

- imp does **not** try for the smallest bundle, or for the best raw numbers in a benchmark. Nobody
  tuned it to win those charts, and it does not pretend otherwise.
- imp can **be the wrong fit for an app**. Some products have a constraint that imp deliberately
  does not optimize for. That is acceptable. imp aims to be **good enough for about 80% of
  applications**, and not perfect for all of them.
- The trade is explicit. **After a builder accepts the constraints of imp, development with imp and
  an AI agent is genuinely good.** The north star of imp is the **experience of the developer**. It
  lets a builder deliver value at a pace that people have not seen before.
- The developer does not **fight the tooling**. Nobody connects a bundler, a router, a state
  library, a test runner and a formatter, and nobody keeps them in agreement. The developer **builds
  the app**.

Name one constraint on the page, as a worked example, because it is the one that surprises people.
**The layout library is two components.** `flex` is a row, `stack` is a column, and that is all.
There is no grid, no box, and no wrapper with a prop for padding and for a background, see
`adr/layout-two-flex-primitives.md`. Anybody who wants a specific system for a CSS layout writes the
CSS that they already know, inside their own component. There it is isolated, and anybody can read
it. That example shows the shape of every other constraint of imp, in miniature. imp does not build
again something that the platform does well. It hands that thing back to the developer, and it does
not wrap it.

Pair this section with the messages above, about a complete toolkit and about an SPA. The
constraints are the reason why the experience is so smooth. They are not a warning that somebody
added at the end.

## The gallery of components

The site carries a section where a visitor browses the standard components. The visitor selects one
from a nav, sees it rendered, changes the theme, and reads the code behind it. That page is the page
that `imp preview` already generates. Somebody exports it as static files, and embeds it in an
`iframe`. The work to reach that point is `todo/preview-static-export.md`. The site owns the nav,
and the copy around the gallery. The exporter owns the pages of a specimen.

**`docs/std-components.md` already points at that page.** Somebody reduced that document, from a
reference per component, to the selling points of the library. The reason was that the catalog
belongs in the gallery, and not in prose that falls behind the code. The document now links to
`/components`, which is a **placeholder path**, and which resolves to nothing until somebody embeds
the gallery. `docs/theming.md`, `docs/i18n.md` and `docs/cli.md` link to the same path. Two things
follow:

- **The generator must resolve `/components`** to the place where the embedded gallery really lands.
  Otherwise the published documentation ships four dead links. Decide the path before the first
  publication.
- **The gallery is now documentation that carries weight. It is not a nice extra.** It is the only
  place where a reader finds the props of a component, its variants, and the message keys that it
  reads. So a specimen must carry that information. It must not only render the component. A table
  of the props, and the `imp.` keys that each component looks up, belong on the page of the
  specimen.

**The preview page itself needs a redesign first.** The gallery is the most persuasive page of the
shop front. A visitor judges the whole library by it. The current UI of the preview is a functional
tool for development, and not something to lead with. It owes three things:

- **A fast, visual way to find a component.** A grid of specimens that a person can browse. Each
  component shows as itself, and not as a row of text in a list. So somebody who does not know the
  names can point at the thing that they want. A search, and a filter by group, sit on top of that
  grid. They do not replace it.
- **A modern, deliberate look** that matches the confidence of the copy around it. That means real
  spacing, the tokens of the theme, light and dark, and a frame for a specimen that makes each
  component look considered.
- **It stays one page, and not two.** The same UI serves `imp preview` in development, and the
  exported static gallery, see `todo/preview-static-export.md`. So this work pays twice. The
  redesign is also what the component gallery of every imp user looks like.

## Constraints about the documentation

Everything on the site follows the rules for `docs/` in `CLAUDE.md`. Write for an external reader.
Reference nothing in `adr/`, nothing in `todo/`, and no internal of the repository. Do not surface
Deno, and use imp-branded commands only. The generator must not leak `adr/` or `todo/` into the
published output. Only `docs/`, and the home page, ship.

## ADR impact

- Record an ADR, named `landing-site.md` or `docs-site-generator.md`, when somebody settles the
  approach. It covers the Markdown engine that runs in process, the generation from `docs/` as the
  one source, and the site that imp builds and bundles itself. Update the table of ADRs in
  `adr/README.md`.

## Open questions

- **Which highlighter for code.** `marked` renders no highlighting of its own. The highlighter must
  run in process, as a vendored JavaScript or wasm module.
- **The styling and the theming.** Does the site reuse the theming system of an app, see
  `adr/themable-by-default-tokens.md`, so that the site and an imp app share one look? Or does the
  site have a theme of its own?
- **Where the site lives.** Is it a `site/` app in this repository, which imp builds? Or is it a
  separate repository, like the showcase repositories, see `todo/example-showcase-repos.md`?
- **Versioned documentation.** Does imp publish the documentation per version? Or does it publish
  the latest version only, at the start?
