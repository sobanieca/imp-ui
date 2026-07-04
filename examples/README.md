# examples

Live, buildless examples — no bundler, no install step. The SPA examples import the library from the
bare `imp` specifier, which `imp start` resolves for you. Two groups sit side by side:

- `spa/` — client-rendered single-page apps. The browser builds all DOM; there is no server beyond a
  static file host.
- `ssr/` — a server-rendered page with hydrated islands, served by its own Hono app.

## Running the SPA examples

Serve this folder with `imp start` and open the index. From the `examples/` folder:

```sh
imp start index.html
```

Then open <http://localhost:4507/>. `imp start` serves the `examples/` folder, injects the import
map that points `imp` at the library, and gives you live reload plus console/network telemetry in
the terminal.

The `ssr/` example runs its own server instead — see `ssr/README.md`.

## Contents

- `spa/basics/` — annotated demos of every dispatch rule: type-based arguments, array flattening,
  skipped conditionals, the `class`/`style`/`events` prop forms, and property-first behavior.
- `spa/admin/` — a small admin backoffice app showing how components compose. Sidebar routing, stat
  cards, a user data table with row actions, an invite form reading values off real node references,
  and a toast feed. Re-renders by calling `mount('#app', ...)` again on each state change.
- `ssr/` — server-rendered islands. A Hono server renders an e-commerce product page as HTML, then
  the client hydrates three mount points (cart widget, add-to-cart, product reviews) with `mount`.
  Has its own server and run instructions — see `ssr/README.md`.
