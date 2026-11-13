# One tool. The whole frontend.

imp is a complete UI toolkit in one binary. It is the dev server, the component library, the state,
the router, the test runner, the linter, the formatter and the bundler. You install one file, and
you build the app. You assemble nothing, and you connect nothing.

<!-- notice -->

<!-- install -->

[Browse the components](/components) [Read the docs](/docs)

<!-- tour -->

<!-- workflow -->

<!-- positions -->

## Examples

The [imp-examples](https://examples.imp-ui.com/) project holds three complete apps
that are built with imp. Two of them run live in the browser:

- [Beacon](https://examples.imp-ui.com/observability/) is an observability SPA with a
  shell, a router, guards, forms, charts and translations. The hosted build has no backend, so
  sign-in fails there. Run it with `imp start` to use its mock API.
- [Brickfall](https://examples.imp-ui.com/brickfall/) is a brick breaker game on a
  canvas. It installs as a PWA and plays offline.

The third app is a shop that a Deno server renders, with imp components as islands. It runs locally
only.

## Why the name imp

The first name was `imperator`, for imperative code. A modern framework is declarative, and in some
cases an imperative line is simpler than the declarative way. <span class="imp-name"><img
class="imp-mark-light" src="/mark-light.svg" alt=""><img class="imp-mark-dark"
src="/mark-dark.svg" alt="">imp</span> is a hybrid. It renders declaratively, and it lets you write
imperative code wherever that is the easier path.

An imp is the friendly familiar from a role-playing game, and that is what this project wants to be.
It goes with you and your agent while you build the frontend.
