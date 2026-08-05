# Standalone example showcase repositories

Ship a set of larger, self-contained imp apps as **separate open-source GitHub repositories** - each
a real project a developer can clone, run, and study end to end, not a snippet under `examples/`.
Every repo is imp-branded (`imp.json`, `imp start`, `imp.lock`) with its own README, license, and
CI, and demonstrates imp holding up at application scale.

Initial set:

- **Facebook-like social app** - feed, posts, comments, likes, profiles; exercises interactive
  client state, lists that grow, and per-item reactivity.
- **Grafana-like admin panel** - dashboards, charts, tables, filters, and dense data-heavy layouts;
  exercises stdlib components, theming, and refresh/polling patterns.
- **E-commerce shop with SSR** - server-rendered product pages hydrated with islands, cart, and
  reviews; the full-scale successor to the SSR-islands example that used to live in-repo under
  `examples/ssr`.

Each repo should track imp's published version so the examples stay runnable as imp evolves, and
link back to the main imp repo and docs.
