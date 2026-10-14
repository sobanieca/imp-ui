# init - scaffold a runnable project

```
imp init [dir] [--pwa] [--font <name>]
```

`imp init` writes a complete project that runs: a page, an application map, a frame with a counter
screen, a theme, one self-hosted font, a unit test and an e2e spec. The command is
**non-interactive**. It never prompts, so it runs unattended. With no `dir`, imp scaffolds in the
current directory. With `dir`, imp creates that directory if necessary and scaffolds there.

## What it writes

| File                                  | Is                                                                                       |
| ------------------------------------- | ---------------------------------------------------------------------------------------- |
| `imp.json`                            | the only config file. It pins the imp version that wrote it.                             |
| `index.html`                          | the served page: the `#app` mount point, the `/src/main.js` entry, `/fonts/fonts.css`    |
| `src/main.js`                         | applies `src/theme.js` with `init({ theme })` and mounts the frame                       |
| `src/theme.js`                        | the theme: `base: 'imp-light'` and the font in `font-family`. Make the palette your own. |
| `src/app-map.js`                      | the application map, named in `imp.json`. It exports `app`: `home` and `about`.          |
| `src/app.js`                          | the frame and the router. It exports `root`; `home` binds a click counter.               |
| `test/app.test.js`                    | the unit test, in a blank page                                                           |
| `test/app.spec.js`                    | the e2e spec, in a real browser                                                          |
| `public/favicon.svg`                  | published at the site root                                                               |
| `public/fonts/fonts.css`              | the `@font-face` rules of the font, weights 400 to 700                                   |
| `public/fonts/<font>-latin.woff2`     | the font, Latin subset                                                                   |
| `public/fonts/<font>-latin-ext.woff2` | the font, Latin Extended subset                                                          |
| `public/fonts/<font>-ofl.txt`         | the copyright notice and the license of the font                                         |
| `.gitignore`                          | `dist/`, `.imp/`, every `.env`, and the usual JavaScript entries                         |

`--pwa` adds a complete `pwa` block to `imp.json`. It also writes `icon.svg` at the project root.
imp renders the whole icon set from that one source image. The image is a build input, so it does
**not** go in `public/`.

## The font

`imp init` picks one font at random from this list and writes it into the project. `--font <name>`
picks the font instead. Every font is a Google Fonts family, copied from the binary. imp makes no
network request.

| `--font`            | Family            | License                   |
| ------------------- | ----------------- | ------------------------- |
| `inter`             | Inter             | SIL Open Font License 1.1 |
| `manrope`           | Manrope           | SIL Open Font License 1.1 |
| `plus-jakarta-sans` | Plus Jakarta Sans | SIL Open Font License 1.1 |
| `dm-sans`           | DM Sans           | SIL Open Font License 1.1 |
| `outfit`            | Outfit            | SIL Open Font License 1.1 |
| `space-grotesk`     | Space Grotesk     | SIL Open Font License 1.1 |
| `sora`              | Sora              | SIL Open Font License 1.1 |
| `figtree`           | Figtree           | SIL Open Font License 1.1 |
| `nunito-sans`       | Nunito Sans       | SIL Open Font License 1.1 |
| `work-sans`         | Work Sans         | SIL Open Font License 1.1 |

The font is self-hosted under `public/fonts/`. The page sends no request to another origin. So the
app works offline, a `--pwa` build caches the font, and a `style-src 'self'` policy allows it.

## Give the new app its own look

A new app must not look like the bare built-in theme. After `imp init`, do these steps before you
build features:

1. Keep the font that `imp init` wrote. Do not replace it, and do not add a second family.
2. Choose a palette that suits the subject of the app. Do not copy the colours of the built-in
   themes.
3. Write the palette into `src/theme.js`. Keep `base: 'imp-light'`, keep `font-family`, and add the
   tokens in the table below.
4. Set `background-app` to a gradient where it suits the app, such as a soft `linear-gradient` or
   `radial-gradient` of two tints of the palette.
5. Set the radius and the shadow of the app. `radius-item` and `radius-container` change together.
6. Write a dark theme in `src/theme-dark.js` if the app needs one. Use `base: 'imp-dark'` and the
   same font tokens.
7. With `--pwa`, set `pwa.themeColor` and `pwa.backgroundColor` in `imp.json` to colours of the
   palette.

| Token                                                          | Set it to                                        |
| -------------------------------------------------------------- | ------------------------------------------------ |
| `color-primary`, `color-on-primary`                            | the main colour of the app, and its text colour  |
| `color-secondary`                                              | the muted text tone                              |
| `color-surface`, `color-surface-sunken`, `color-surface-hover` | tints of one hue, light to dark in a light theme |
| `color-text`, `color-heading`, `color-border`                  | the ink of the palette                           |
| `background-app`                                               | a colour or a gradient under the `shell`         |
| `radius-item`, `radius-container`                              | for example `0.5rem` and `1rem`                  |
| `color-shadow`, `shadow-sm`, `shadow-md`, `shadow-lg`          | a tinted shadow, or `none`                       |
| `loader`                                                       | `spinner`, `dots`, `bar` or `pulse`              |

```js
// src/theme.js
export default {
  name: 'app-light',
  base: 'imp-light',
  tokens: {
    'font-family': "'Sora', system-ui, sans-serif",
    'color-primary': '#0f766e',
    'color-on-primary': '#ffffff',
    'color-secondary': '#4b635f',
    'color-surface': '#ffffff',
    'color-surface-sunken': '#eef6f4',
    'color-surface-hover': '#e2efec',
    'color-text': '#10201d',
    'color-heading': '#0b3b36',
    'color-border': '#c5dbd6',
    'background-app': 'linear-gradient(160deg, #f3faf8 0%, #e3f1ee 100%)',
    'radius-item': '0.625rem',
    'radius-container': '1.25rem',
    'color-shadow': '#0b3b36',
    loader: 'dots',
  },
}
```

- **Every text pair must reach 4.5:1.** Check `color-text`, `color-heading` and `color-secondary` on
  each surface, and `color-on-primary` on `color-primary`. See [theming](theming.md).
- **Check a gradient by eye.** The contrast check of the theme editor cannot read a gradient. Each
  stop of `background-app` must reach 4.5:1 against `color-text`.
- **Read a token with `var()` in your own styles.** Do not write a hex value into a component. A
  theme change then reaches every part of the app.
- **A custom style can use a gradient too**, such as the header of a card. Build it from the tokens:
  `linear-gradient(135deg, var(--imp-color-primary), var(--imp-color-surface-sunken))`.
- **Keep `public/fonts/<font>-ofl.txt` beside the font.** The license requires the notice with every
  copy of the font. `imp build` copies `public/` as it is, so the notice ships with the app. No
  credit in the page is necessary.
- **Do not edit the font files.** An edited file is a modified version under the license.

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
- **`--font` takes a name from the font table.** Any other name exits `1` and lists the names. imp
  writes nothing then.
- **Never add a `package.json` or a bundler config** to the scaffolded project.
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
imp test --unit  the unit test
imp test --e2e   the browser spec
```

Related: [cli](cli.md), [start](start.md), [testing](testing.md), [config](config.md),
[build](build.md), [theming](theming.md)
