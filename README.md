# imp-ui
Imp UI — AI-ready frontend framework.

A buildless, vanilla-JS framework with the whole toolkit in one place: rendering, signals,
routing, runtime/CLI (`imp dev` / `lint` / `fmt` / `test` / `build` / `showcase`), theming + i18n,
and a standard component library — so you don't assemble a stack before building a product.
Designed to be simple enough that an AI agent can write apps in it without hand-written boilerplate.

SPA-first, but coexists with server-rendered HTML: a backend can return ordinary MVC-style HTML
with embedded imp mount points (or imp components exposed as web components via `wc()`), and imp
renders into those islands on the client — no SSR of imp components, no hydration.

The full design and implementation plan live in **[notes.md](notes.md)**. Ideas still under
evaluation are in **[to-consider.md](to-consider.md)**.
