# Standalone example showcase repositories

Ship a set of larger, self-contained imp apps, as **separate open-source GitHub repositories**. Each
one is a real project that a developer can clone, run and study from start to end. None of them is a
snippet under `examples/`. Every repository carries the imp brand, with an `imp.json`, an
`imp start` command, and a committed `dependencies/` folder. Each one has its own README, licence
and CI. Each one shows that imp works at the scale of an application.

This is the first set:

- **A social app in the style of Facebook.** It has a feed, a post, a comment, a like and a profile.
  It exercises interactive state on the client, a list that grows, and reactivity per item.
- **An admin panel in the style of Grafana.** It has a dashboard, a chart, a table, a filter, and a
  dense layout with much data. It exercises the standard components, the theming, and the patterns
  for a refresh and for a poll.
- **An e-commerce shop with server-side rendering.** It has product pages that a server renders, and
  that islands hydrate. It also has a cart and a review. It is the successor, at full scale, of the
  SSR islands example that used to live in this repository, under `examples/ssr`.

Each repository must follow the published version of imp. So the examples stay runnable while imp
changes. Each one must also link back to the main repository of imp, and to the documentation.
