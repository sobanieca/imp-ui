# One tool. The whole frontend.

imp is a complete UI toolkit in one binary. It is the dev server, the component library, the state,
the router, the test runner, the linter, the formatter and the bundler. You install one file, and
you build the app. You assemble nothing, and you connect nothing.

<!-- notice -->

<!-- install -->

[Browse the components](/components) [Read the docs](/docs)

<!-- tour -->

<!-- workflow -->

## imp is a boring project, on purpose

imp does not chase the best performance for every edge case. It does not chase the smallest bundle,
and nobody tuned it to win a benchmark. imp aims to be the correct fit for most applications, and
good enough where it is not perfect. A boring tool is a tool that you stop thinking about.

The equation is simple: a backend plus a frontend is an app. imp solves the frontend half of that
equation, and it stays out of the other half. Work locally. Iterate quickly with mocks and an agent.
Build a package. Deploy it to any CDN. That is the whole loop, and imp keeps it that short.

## The SPA is the best thing that happened to the industry

A single-page application stands on its own. It reaches the user before the first request reaches
the backend. The UI is already there, and a person can use it while the data arrives behind it.

Some companies push a render server into every app, at every request. That is the wrong direction.
You rent their servers and pay per request to render a page that a browser renders for nothing. imp
takes the opposite position. Keep the state on the client. Keep the backend stateless, so it scales
when you add a machine. Serve the frontend from a CDN, with no render server to run and no vendor
that decides where you host.

The split pays back every day:

- The app works offline.
- An error is handled on the client, where the person sees it.
- The state lives on the client, so navigation is instant.
- An unreliable network slows the data, not the app.

## AI changes what "best practice" means

Many of the tools and frameworks of today are artifacts of their era. Somebody created them when
JavaScript was not as powerful as it is now, and much of their machinery covers a gap that the
language has since closed. Somebody designed them to make code that a person writes by hand faster
and better.

When an agent writes the code and maintains it, the constraints that made a technique a bad practice
no longer apply in the same way. So imp returns to techniques that people once called bad practice,
and uses them well. imp does not carry forward a convention that somebody built for a world that no
longer exists.

## What imp is not

imp can be the wrong fit for an app. Some products have a constraint that imp deliberately does not
optimize for. After you accept the constraints of imp, development with imp and an AI agent is
genuinely good. You do not fight the tooling, and you do not keep a bundler, a router, a state
library, a test runner and a formatter in agreement. You build the app.

**One constraint as an example.** The layout library is two components. `flex` is a row, `stack` is
a column, and that is all. There is no grid, no box, and no wrapper with a prop for padding. A
layout that needs more is the CSS that you already know, inside your own component, where anybody
can read it.

```js
import { component } from 'imp'
import { div } from 'imp/html'
import { flex, stack } from 'imp/std/layout'

export const dashboard = component('app-dashboard', {
  styles: `
    .grid {
      display: grid;
      grid-template-columns: 2fr 1fr;
      gap: var(--imp-space-4);
    }
  `,
  setup: () => div({ class: 'grid' }, stack(chart(), table()), flex(filters())),
})
```

That example shows the shape of every other constraint of imp. imp does not build again something
that the platform does well. It hands that thing back to you, and it does not wrap it.
