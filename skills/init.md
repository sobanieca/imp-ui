# init - scaffold a runnable project

```
imp init [dir] [--pwa]
```

`imp init` writes a complete project that runs: a page, a counter component, a unit test and an e2e
spec. The command is **non-interactive**. It never prompts, so it runs unattended. With no `dir`,
imp scaffolds in the current directory. With `dir`, imp creates that directory if necessary and
scaffolds there.

## What it writes

| File                 | Is                                                                           |
| -------------------- | ---------------------------------------------------------------------------- |
| `imp.json`           | the only config file. It pins the imp version that wrote it.                 |
| `index.html`         | the served page. It has the `#app` mount point and the `/src/main.js` entry. |
| `src/main.js`        | applies the theme and mounts the app                                         |
| `src/app.js`         | the components. It exports `app`, a click counter.                           |
| `test/app.test.js`   | the unit test, in process                                                    |
| `test/app.spec.js`   | the e2e spec, in a real browser                                              |
| `public/favicon.svg` | published at the site root                                                   |
| `.gitignore`         | `dist/`, `.imp/`, every `.env`, and the usual JavaScript entries             |

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
- **That is the whole file set.** There is no `README` and no example other than the counter. Do not
  expect a larger template.
- **Never add a `deno.json` or a `package.json`** to the scaffolded project.
- **The scaffold passes `imp lint`, `imp fmt --check`, `imp test --unit` and `imp test --e2e` as
  written.** Keep it passing while you edit.

## What the scaffold shows

```js
export const app = component('app-root', {
  build: () => {
    const clicks = initState('app.clicks', 0)
    return div(
      p({ id: 'clicks' }, clicks.text((value) => `Clicks: ${value}`)),
      button({ events: { click: () => clicks.set((value) => value + 1) } }, 'Click me'),
    )
  },
})
```

It shows a namespaced state name, a live text node in place of a re-render, and a standard
component. The e2e spec selects `#clicks` directly. It names `imp-button >>> button` only to select
one button out of the page.

## Next

```
imp start        serve with live reload
imp test --unit  the in-process test
imp test --e2e   the browser spec
```

Related: [cli](cli.md), [start](start.md), [testing](testing.md), [config](config.md),
[build](build.md)
