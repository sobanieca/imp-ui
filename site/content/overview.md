# One tool. The whole frontend.

imp is a complete UI toolkit. It is the one tool that you learn to ship a valuable frontend
application. It is not a stack that you assemble from a router, a state library, a bundler, a test
runner and a formatter. It is one tool that already is all of those.

[Browse the components](/components) [Read the docs](/docs)

## The workflow that imp is built around

Every step uses the same tool. You connect nothing.

1. **Install the CLI.**
2. **Run `imp init`.** You get a real app, and it runs.
3. **Teach the agent about imp.** Point it at `imp skill`. It reads the manual for whatever it is
   about to use.
4. **Model the app against a mock.** Build the whole frontend with a false backend, and see it
   working before one endpoint exists. Review a component in isolation with `imp preview`. Leave
   feedback on a page with the review widget of the dev server.
5. **Get the design approved. Then remove the mocks** and implement the backend against a frontend
   that already works.
6. **Write the unit tests and the e2e tests with imp.** There is one runner, and it is already
   there.
7. **Run `imp build`.** You get a static bundle for any CDN.

The app with the mocked backend is not a prototype that you throw away. It is the app. The loop from
step 3 to step 5 is also the loop that an AI agent is good at, and that is why imp has this shape.

## Build your SPA, put it on any CDN, and focus on the backend

The split between a frontend and a backend is the best thing that happened to the industry. A
frontend stands on its own. A backend serves data. The app reaches the user before the first request
reaches the backend. The UI is already there, and a person can use it while the data arrives behind
it.

The split unlocks real advantages:

- The app works offline.
- An error is handled on the client, where the person sees it.
- The state lives on the client, so navigation is instant.
- An unreliable network slows the data, not the app.

Other companies push the industry back to a render server. You rent their servers and pay per
request to render a page that a browser renders for nothing. imp takes the opposite position. There
is no render server to run, no bill per request for HTML, and no vendor that decides where you host.

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

imp does not try for the smallest bundle, or for the best raw numbers in a benchmark. Nobody tuned
it to win those charts.

imp can be the wrong fit for an app. Some products have a constraint that imp deliberately does not
optimize for. imp aims to be good enough for about 80% of applications, and not perfect for all of
them.

After you accept the constraints of imp, development with imp and an AI agent is genuinely good. The
north star of imp is the experience of the developer. You do not fight the tooling, and you do not
keep a bundler, a router, a state library, a test runner and a formatter in agreement. You build the
app.

**One constraint as an example.** The layout library is two components. `flex` is a row, `stack` is
a column, and that is all. There is no grid, no box, and no wrapper with a prop for padding. A
layout that needs more is the CSS that you already know, inside your own component, where anybody
can read it.

```js
import { component } from 'imp'
import { div } from 'imp/html'
import { flex } from 'imp/std/layout'

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
