# imp-ui (experiment)

Full implementation of the framework described in [`../essence.md`](../essence.md): buildless,
vanilla-JS, element factories + Solid-style signals + real DOM, all-in-one toolkit, AI agents as the
primary author.

```js
import { button, css, div, each, h1, mount, signal, t, when } from './imp/imp.js'

function counter() {
  const count = signal(0)
  return div([
    h1(() => `Count: ${count()}`),
    button({ events: { click: () => count.update((c) => c + 1) } }, '+1'),
  ])
}

mount('#app', counter)
```

## Layout

| Path             | What                                                                                                                                                                                                              |
| ---------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `imp/`           | the kernel: `render` (el + ~70 tag factories), `signals`, `scope` (owner-tree disposal), `primitives` (`when`/`each`/`match`/`onMount`/`portal`), `styles` (`css` ``), `theme`, `i18n`, `router`, `wc`, `testing` |
| `stdlib/`        | component library: layout, display, inputs, feedback, navigation, data — all theme-token + `t()` consumers                                                                                                        |
| `cli/`           | the `imp` CLI (Deno): `dev` (live reload + browser→CLI telemetry), `test`, `lint`, `fmt`, `build`, `showcase`, `new`                                                                                              |
| `showcase/`      | every stdlib component live, with a theme/locale editor — `deno task showcase`                                                                                                                                    |
| `examples/todo/` | canonical example: signals, keyed lists, theme switch, en/pl plurals, persistence                                                                                                                                 |
| `tests/`         | the framework's own test suite — `deno task test`                                                                                                                                                                 |
| `docs.md`        | the terse agent-ingestible API reference (the doc to feed an agent)                                                                                                                                               |

## Try it

```sh
deno task test                       # 67 tests, DOM via happy-dom
deno task showcase                   # → http://localhost:4508/showcase/
deno run -A cli/main.js dev          # serve any app dir
deno compile -A -o imp cli/main.js   # the single-binary CLI
```

The whole framework is plain ES modules — `imp/` + `stdlib/` can be vendored into an app by copying
the two directories (`imp new` does exactly that).
