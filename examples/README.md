# examples

Live, buildless examples for `src/render.js`. They import the library directly from `src/imp.js`
(via a relative path) — no bundler, no install step. Two groups sit side by side:

- `spa/` — client-rendered single-page apps. The browser builds all DOM; there is no server beyond a
  static file host.
- `ssr/` — a server-rendered page with hydrated islands, served by its own Hono app.

## Running the SPA examples

ES modules need to be served over HTTP (file:// imports are blocked by the browser). The SPA
examples import the library with a relative path that climbs to `src/`, so the server must be rooted
at the **repo root** — not the `examples/` folder — otherwise `src/` is out of reach and the page
loads blank. From the repo root:

```sh
deno run --allow-net --allow-read jsr:@std/http/file-server .
# or any static server, e.g.
python3 -m http.server 8000
```

Then open <http://localhost:8000/examples/>.

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
