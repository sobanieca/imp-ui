# init — scaffold a runnable project

```
imp init [dir] [--pwa]
```

Writes a complete, runnable project: a page, a counter component, a unit test and an e2e spec.
**Non-interactive** — it never prompts, so it runs unattended. No `dir`: scaffold here. With `dir`:
create it if needed and scaffold there.

## What it writes

| File                 | Is                                                        |
| -------------------- | --------------------------------------------------------- |
| `imp.json`           | the only config file — pins the imp version that wrote it |
| `index.html`         | the served page: `#app` mount point, `/src/main.js` entry |
| `src/main.js`        | applies the theme, mounts the app                         |
| `src/app.js`         | the components — exports `app`, a click counter           |
| `test/app.test.js`   | unit test, in-process                                     |
| `test/app.spec.js`   | e2e spec, real browser                                    |
| `public/favicon.svg` | published at the site root                                |
| `.gitignore`         | `dist/`, `.imp/`, every `.env`, plus the usual JS noise   |

`--pwa` adds a filled-in `pwa` block to `imp.json` and writes `icon.svg` at the project root — the
one source image imp renders the whole icon set from. It is a build input, so it does **not** go in
`public/`.

## Rules

- **It refuses rather than overwrite.** If any file it would write already exists, nothing is
  written and it exits `1`. Scaffold into an empty directory. An existing empty `public/` is not a
  conflict.
- **`.gitignore` is merged, not refused.** An existing one keeps its contents; imp appends only the
  entries no pattern in it already covers (`node_modules` covers `node_modules/`, `/dist` covers
  `dist/`, `.env*` covers `.env` and `.env.*`) under an `# added by imp init` comment, and warns
  that it changed the file. Nothing to merge means nothing is written.
- **That is the whole file set** — no `README`, no example beyond the counter. Do not expect a
  richer template.
- **Never add a `deno.json` or `package.json`** to the scaffolded project.
- **The scaffold passes `imp lint`, `imp fmt --check`, `imp test --unit` and `imp test --e2e` as
  written.** Keep it passing as you edit.

## What the scaffold demonstrates

```js
export const app = component('app-root', {
  onMount: () => {
    const clicks = initState('app.clicks', 0)
    return div(
      p({ id: 'clicks' }, clicks.text((value) => `Clicks: ${value}`)),
      button({ events: { click: () => clicks.set((value) => value + 1) } }, 'Click me'),
    )
  },
})
```

A namespaced state name, a live text node instead of a re-render, and a standard component. The e2e
spec selects `#clicks` plainly, and names `imp-button >>> button` only to pick one button out of the
page.

## Next

```
imp start        serve with live reload
imp test --unit  the in-process test
imp test --e2e   the browser spec
```

Related: [cli](cli.md), [start](start.md), [testing](testing.md), [config](config.md),
[build](build.md)
