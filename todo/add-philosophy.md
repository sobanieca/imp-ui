# Philosophy - a statement of what imp is, for the landing page

Write the philosophy of imp down, as copy for the landing page. It must be a short, confident
statement of what imp is, and of what it believes. Distil it from the existing `docs/`, and fold it
into the home page that `todo/landing-site.md` builds. Today the philosophy is implicit only. It is
spread across the documentation of the CLI, the rendering, the dependencies and the testing. The
landing page needs it in one place, in the language of the reader.

## The version in one sentence

imp is an opinionated, complete, buildless toolkit for the frontend. It treats the platform of the
browser, and your git repository, as the only sources of truth. There is no build step while you
work. There is no package registry at runtime. There is no configuration to assemble. imp is built
so that a builder, and their AI agent, can develop, test and ship a web app with one tool.

## The pillars, and each one is already grounded in `docs/`

- **Development is buildless, and the code is native to the platform.** There is no compile step, no
  JSX and no virtual DOM. A component is a plain lowercase function that returns a real DOM node. A
  prop is the HTML attribute name, exactly. `imp start` serves the source that you typed. Production
  is the one place where a build exists, and it emits plain static files, for any CDN.
- **The repository is the whole truth.** imp vendors a dependency, bundles it, and commits it. A
  version is an exact pin. There is no lock file, because the committed bytes _are_ the frozen
  state. A fresh clone is the whole app, and it runs. It is offline, reproducible, and a person can
  review it.
- **imp is opinionated, for most web apps.** imp makes the decisions. There is one config file, one
  test runner, one formatter, and a safe default everywhere. imp aims to be the correct fit for the
  large majority of web applications, and not a perfect fit for all of them. A builder who accepts
  its constraints does not assemble a toolchain, and does not reconcile one. They build. This aligns
  with the section about honest constraints, in `todo/landing-site.md`.
- **One tool brings the value.** The audience is a builder who wants one tool, from the first file
  to the shipped product. One binary holds the dev server, the dependency manager, the builder, the
  test runner, the linter and the formatter. So the energy of the builder goes into the product, and
  not into the plumbing.
- **The batteries are included, and imp is not tiny.** imp is deliberately **not** a minimal micro
  library. It grows toward a large standard library of components. That library covers forms,
  overlays, navigation and the visualization of data, among other things, see
  `todo/stdlib-components.md`. So a builder can realistically stay inside imp, and ship a real app
  with **zero external dependencies**. Vendoring keeps an outside package honest, when you need one.
  But the goal is that you rarely need one.
- **imp is built for the AI era.** Every surface is designed so that an AI agent, and a person, can
  drive it and read it. The console of the browser, the errors, and the network traffic, all stream
  to the terminal. The output of a test is plain text. An e2e spec records itself as a GIF, so that
  a person can review a feature that an agent built.

## Where the philosophy lands

- The philosophy becomes a section of the home page in `todo/landing-site.md`, or the framing spine
  of that page. It complements the sections of that item about the argument for an SPA, and about
  the honest constraints. It does not duplicate them.
- Follow the rules of `docs/`. Write for an external reader. Point at no internal of the repository.
  Do not surface Deno.

## Open questions

- Is the philosophy one page or one section of its own? Or is it the narrative thread through the
  whole landing page?
- Check the tone against the bar in `todo/landing-site.md`, which asks for confident, and not
  preachy.
