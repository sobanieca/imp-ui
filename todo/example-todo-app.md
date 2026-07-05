# Basic todo-app example (in-repo)

Add a small, canonical **todo app** to `examples/` — the classic add / toggle / filter / delete
list, the smallest useful demo of imp's client-side reactivity. Unlike the larger showcase apps
(`todo/example-showcase-repos.md`), this one lives **inside the imp repository** alongside `spa` and
`ssr` as an entry-point example a newcomer reaches for first.

Keep it minimal and imp-branded (`imp.json`, `imp start`), with a short README, so it doubles as a
copy-paste starting point in the docs.

The existing in-repo examples (`examples/spa` and `examples/ssr`) are to be **removed** in favor of
this single todo app — their larger, application-scale scenarios move out to the standalone showcase
repositories (`todo/example-showcase-repos.md`), leaving `examples/` with just the one minimal
entry-point demo.
