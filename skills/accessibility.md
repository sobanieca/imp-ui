# accessibility - what the standard components guarantee, and what the app still owes

A standard component already meets the baseline: native element first, a keyboard path for every
pointer interaction, the focus managed by the top layer, ARIA state bound to the visible state, a
name on every control, a visible focus ring, and no motion under reduced motion. Do not add ARIA,
key handlers or a focus trap to a standard component. There is no prop that tunes them.

## What the app owes

| Duty                           | Write                                                                          |
| ------------------------------ | ------------------------------------------------------------------------------ |
| name an icon-only button       | `button({ label: t('Delete') }, icon(luTrash))`                                |
| name an image                  | `img({ src, alt: t('Sales per month') })`, or `alt: ''` for decoration         |
| name a field                   | `textField({ field: 'email', label: t('Email') })` - every input takes `label` |
| move the focus on a navigation | one frame around the router slot, see [routing](routing.md)                    |
| first focus inside an overlay  | the native `autofocus` attribute on that element                               |
| a readable custom theme        | the contrast report of the theme editor is empty, see [theming](theming.md)    |
| a component of your own        | the same contract, see [custom-components](custom-components.md)               |

## Rules an agent gets wrong

- **A tooltip never names a control.** `tooltip` is hidden from assistive technology. Name the
  control itself with `label`, and let the tooltip repeat it.
- **Name the button, not the icon inside it.** `icon({ label })` inside a `button` is wrong. Write
  `button({ label }, icon(luX))`.
- **The standard `button` has no `aria-label` prop.** It takes `label`. A plain `button` from
  `imp/html` takes `'aria-label'`.
- **An `alt` is always present on `img`.** A decorative image takes `alt: ''`, never no `alt`.
- **Never put a `role` on a `div` to make a control.** Use `button`, `link` or an input. A focusable
  element with no role fails the matcher below.
- **Route every user-facing name through `t()`**, see [i18n](i18n.md).

## Checks

| Check                                           | Finds                                                                             |
| ----------------------------------------------- | --------------------------------------------------------------------------------- |
| `imp lint` rule `imp/img-alt`                   | an `img` call with no `alt` key                                                   |
| `imp lint` rule `imp/icon-button-name`          | a `button` with no name whose only children are `icon(...)` calls with no `label` |
| `await expect(page).toHaveAccessibleControls()` | e2e: a control with no name, a focusable element with no role, in the a11y tree   |
| the contrast report of the theme editor         | a text and background token pair below 4.5:1, or a pair it cannot read            |

- The matcher takes the page or an element from `page.$()`. Always `await` it. See
  [testing](testing.md).
- The contrast report sits under the tabs of the editor, and changes with each edit.
- imp ships no full audit such as axe-core. Do not add one to satisfy these checks.

```js
test('the checkout names every control', async ({ page }) => {
  await page.click('#checkout-open')
  await expect(await page.$('#checkout')).toHaveAccessibleControls()
})
```

Supported pairs: VoiceOver with Safari on macOS and iOS, NVDA with Chrome and with Firefox on
Windows, TalkBack with Chrome on Android. JAWS is not in the list.
