`imp build` never ships `mocks/`. The mock endpoint lives only in the dev server (`imp start`,
`imp preview`), and an interceptor cannot answer a request by itself. So a demo that needs a backend
cannot run on a static host.

An example: the observability demo of imp-examples on GitHub Pages
(<https://sobanieca.github.io/imp-examples/observability/>). `/api/session` returns 404 there, so
the demo stops at the sign-in page.

## The feature

- An opt-in flag or environment setting, for example `imp build --mocks`, that bundles `mocks/` into
  the build and answers the matching requests in the page, without a server.
- Candidate places for the answer: the service worker, or a fetch seam in the page.
- An ordinary build stays as it is: no mock code and no mock data.
- The build output says clearly that the app runs on mocks.

## Open questions

- Is the service worker the right place, given the app's own PWA worker and its scope?
- Which mock features work offline: the delay, the status, the dynamic handlers?
- How does a person keep a mocked build from a real deployment by mistake?
