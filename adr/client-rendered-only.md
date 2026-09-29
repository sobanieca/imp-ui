# Client rendering only - no server rendering, no prerender, no static export

## Context

imp renders real DOM in the browser, see `real-dom-no-virtual-dom.md`. Each component renders into
an open shadow root, see `shadow-dom-isolation.md`. So the HTML page that `imp build` writes is a
shell. The content of the app appears only when its JavaScript runs.

That is a good fit for the apps that imp targets: an internal tool, a dashboard, an admin panel, a
product behind a sign-in, and an installable app. There, the first load comes once, a search engine
has nothing to index, and the state lives on the client. A public content site has other needs. A
blog, a documentation site, a marketing page or a shop catalog must show its text before the
JavaScript runs. A crawler that runs no script must read it, and a link preview must show it.

A framework can meet those needs with server rendering, with a prerender at build time, or with a
static export. Each one needs a second renderer that produces HTML outside the browser. That
renderer must serialize a shadow root with its adopted styles. The client must then attach to the
markup, and not render it again. That is a second rendering model, beside the one that imp has. No
decision recorded the absence of those features. So a team learned the limit only after it adopted
imp.

## Decision

**imp renders on the client only.** imp has no server rendering, no prerender and no static export
of rendered pages.

- **A public content site that needs its HTML before the JavaScript runs is out of scope.** The docs
  say so, in the same way that they record a component that imp does not build.
- **imp writes the metadata that it can write on the client.** The router writes the title of the
  document, and the `<meta name="description">` of the matched node, on each navigation, see
  `application-map.md`. A crawler that runs JavaScript reads both. imp writes no other meta tag.
- **An app that lives inside a server-rendered page is in scope.** A JS entry builds a component
  that any page embeds, see `production-bundling.md`. The server owns the HTML of that page, and the
  imp component is an interactive part of it.
- **The HTML entry can carry static content.** The page that `imp build` copies is the HTML that the
  author wrote. A title, a description and a short text in that file reach every reader.

## Consequences

- imp has one rendering model. No code path renders a component outside a browser, and no hydration
  step must match the markup of a server.
- A built app is a set of static files, with no server runtime. Any static host serves it.
- An open tab runs the build that it loaded, until it loads the page again. So a deploy keeps the
  hashed files of the previous build for open tabs. When a lazy chunk is gone anyway, imp loads the
  page again once, see `production-bundling.md`.
- A page that must rank in a search engine, or that must show its text with JavaScript off, needs
  another tool. A team can build the content pages with a static site generator, and the app with
  imp, on the same domain.
- The first paint of a built app waits for its JavaScript. The PWA precache makes every later load
  fast. The first load of a public visitor stays the cost of this decision.
