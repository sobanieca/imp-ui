# init - scaffold a runnable project

```
imp init [dir] [--pwa]
```

`imp init` writes a complete project that runs: a page, an application map, a frame with a counter
screen, a unit test and an e2e spec. The command is **non-interactive**. It never prompts, so it
runs unattended. With no `dir`, imp scaffolds in the current directory. With `dir`, imp creates that
directory if necessary and scaffolds there.

## What it writes

| File                 | Is                                                                              |
| -------------------- | ------------------------------------------------------------------------------- |
| `imp.json`           | the only config file. It pins the imp version that wrote it.                    |
| `index.html`         | the served page. It has the `#app` mount point and the `/src/main.js` entry.    |
| `src/main.js`        | applies the theme and mounts the frame                                          |
| `src/app-map.js`     | the application map, named in `imp.json`. It exports `app`: `home` and `about`. |
| `src/app.js`         | the frame and the router. It exports `root`; `home` binds a click counter.      |
| `test/app.test.js`   | the unit test, in process                                                       |
| `test/app.spec.js`   | the e2e spec, in a real browser                                                 |
| `public/favicon.svg` | published at the site root                                                      |
| `.gitignore`         | `dist/`, `.imp/`, every `.env`, and the usual JavaScript entries                |

`--pwa` adds a complete `pwa` block to `imp.json`. It also writes `icon.svg` at the project root.
imp renders the whole icon set from that one source image. The image is a build input, so it does
**not** go in `public/`.

## Rules

- **imp refuses to overwrite a file.** If one file that imp would write is already present, imp
  writes nothing and exits `1`. Scaffold into an empty directory. An empty `public/` that is already
  present is not a conflict.
- **imp merges `.gitignore`. It does not refuse.** A `.gitignore` that is already present keeps its
  contents. imp appends only the entries that no pattern in the file covers. For example,
  `node_modules` covers `node_modules/`, `/dist` covers `dist/`, and `.env*` covers `.env` and
  `.env.*`. imp puts the new entries under an `# added by imp init` comment, and warns that it
  changed the file. If there is nothing to merge, imp writes nothing.
- **That is the whole file set.** There is no `README` and no example other than the counter. The
  `about` node renders a stub until you bind it. Do not expect a larger template.
- **Never add a `deno.json` or a `package.json`** to the scaffolded project.
- **The scaffold passes `imp lint`, `imp fmt --check`, `imp test --unit` and `imp test --e2e` as
  written.** Keep it passing while you edit.

## What the scaffold shows

```js
// src/app-map.js
export const app = appMap({
  home: { path: '/', description: 'The counter the scaffold starts with' },
  about: 'Bind this node in src/app.js, or delete it here',
})

// src/app.js
export const root = component('app-root', {
  setup: () =>
    shell(
      { logo: appLogo({ label: 'My imp app' }), navbar: { map: app } },
      router({ map: app, screens: { [app.home]: () => counter() } }),
    ),
})
```

It shows the map, the frame, a binding by handle, a namespaced state, a live text node in place of a
re-render, and a standard component. Start with the map: add a node per feature, run the app, and
bind screens one by one. See [routing](routing.md). The e2e spec selects `#clicks` directly. It
names `imp-button >>> button` only to select one button out of the page.

## Next

```
imp start        serve with live reload
imp test --unit  the in-process test
imp test --e2e   the browser spec
```

Related: [cli](cli.md), [start](start.md), [testing](testing.md), [config](config.md),
[build](build.md)
