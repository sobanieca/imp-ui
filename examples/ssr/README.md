# ssr — server-rendered islands

A small e-commerce product page that demonstrates the **islands** pattern from `docs/rendering.md`
(essence #19): a [Hono](https://hono.dev) server renders the full page as HTML, and the client
hydrates a few mount points with `mount('#id', ...)`.

`src/render.js` is browser-only — it builds real DOM with `document.createElement`. So the server
renders the static shell as plain HTML strings (good for SEO and no-JS), and imp-ui is used **only
on the client** to make individual regions interactive. Nothing is re-rendered wholesale; each
island owns its own host element.

## What's server-rendered vs. hydrated

| Region          | Server (HTML)                  | Island (imp-ui)                                  |
| --------------- | ------------------------------ | ------------------------------------------------ |
| Product summary | fully rendered, static         | —                                                |
| `#cart-widget`  | fallback `Cart · 0 items · $0` | live count + total, subscribes to the store      |
| `#add-to-cart`  | `<noscript>` notice            | quantity stepper + add button → `POST /api/cart` |
| `#reviews`      | full review list (SEO / no-JS) | replaces list, adds a form → `POST /api/reviews` |

Two islands share state: `add-to-cart` posts to the cart API, and `cart-store.js` notifies the
`cart-widget` to re-render — without any framework, just a `Set` of listeners.

## Files

- `server.js` — Hono app: SSR route `/`, JSON APIs, static serving of `src/` and the islands.
- `data.js` — in-memory product, reviews, and cart (server state; global, for demo simplicity).
- `page.js` — server-side HTML for the page; embeds the initial reviews as JSON for hydration.
- `islands/` — client modules, imported with no build step:
  - `main.js` — entry point; mounts the three islands.
  - `cart-store.js` — shared cart state + `POST /api/cart`, with subscribe/notify.
  - `cart-widget.js`, `add-to-cart.js`, `reviews.js` — the islands.
- `styles.css` — page styling.

## Running

Unlike the other examples (static files), this one needs its server. From this folder:

```sh
deno task start
```

Or from the repo root:

```sh
deno run --allow-net --allow-read examples/ssr/server.js
```

Either way works — the server `chdir`s to the repo root on startup so `serveStatic` can reach
`src/`. Then open <http://localhost:8000>. Add items to the cart and post a review; reload to
confirm the server kept the state.
