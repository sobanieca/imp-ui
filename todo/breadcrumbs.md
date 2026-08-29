# `breadcrumbs` - the sibling picker, and the route derivation

The trail has landed as `breadcrumbs` in `imp/std/shell` (`adr/shell-region-components.md`): items
as plain data, the last crumb `aria-current="page"`, a real separator element, and the `select` ->
`onClick` -> href activation order `navMenu` uses. What is still owed is the half that was blocked,
plus the route pairing that was always meant to live outside the component.

## The picker is a crumb's own overlay

A breadcrumb is two things an app usually conflates: a **trail of levels**, and a **picker** at one
of those levels for switching to a sibling - GitHub's repo crumb, which opens a filterable list of
the user's other repos. The trail shipped; the picker is an anchored panel and waits on the seam.

A crumb grows one key:

| Key       | Values                                     | Default | Notes                     |
| --------- | ------------------------------------------ | ------- | ------------------------- |
| `options` | array of `{ id, label, href }`, or a state | -       | Gives this crumb a picker |

`options` may sit on **any** crumb, not only the last. GitHub puts it on the repo crumb, which is a
middle crumb once a file path follows it, so special-casing the trailing position buys nothing.

The trigger and the panel are rendered by `breadcrumbs` itself. Composing
`dropdownMenu({ options }, crumb)` cannot be made correct: `anchor-name` and `aria-controls` both
stop at a shadow root, so the panel could not anchor to or reference the crumb
(`todo/overlay-seam.md`, _Where the component boundary falls_).

A crumb with options renders **two controls**, not one: the crumb itself, a link to that level, and
a disclosure `<button popovertarget aria-expanded>` beside it, named `t()`-side as "Change {label}".
Folding both into one control is the tempting move and the wrong one - it takes away the ability to
navigate to the level the picker belongs to.

The panel is `popover="auto"` placed by CSS anchor positioning through the seam's `anchoredStyles`,
so light dismiss, Escape, stacking and placement are all platform. Above a threshold of options it
grows a filter field: fuzzy scoring over the options, with `aria-activedescendant` roving and focus
parked in the field. **Write that list once in `std/shared` rather than in each panel** -
`dropdownMenu` is the other consumer, and the scoring is written with it rather than ahead of it.

`events: { open }` fires when a panel opens, with the crumb's `id`, so an app can load the option
list into the state `options` reads.

## Collapsing is the same panel again

`max` (default `4`, `0` never collapses) arrives with the picker, because it is built from it: a
trail longer than `max` collapses its middle into a single crumb whose label is an ellipsis and
whose `options` are the hidden levels; the root and the last two are always shown. Its disclosure is
named "Show {count} hidden levels". Until then a long trail wraps, and an app shortens `items`
itself.

## The route pairing is a derivation, not a mode

```js
import { routeCrumbs } from 'imp/router'

breadcrumbs({
  items: routeCrumbs({
    '/': 'Home',
    '/orders': 'Orders',
    '/orders/:id': ({ params }) => `Order ${params.id}`,
  }),
})
```

`routeCrumbs(map)` returns a computed over `imp.route`. It walks every prefix of the current path -
`/`, `/orders`, `/orders/8f3a` - matches each against the map's patterns with the router's own
segment matcher, **drops the prefixes that match nothing**, and emits one crumb per hit with `href`
set to that prefix (through `url()`, so a base path is honoured) and params accumulated from the
outer levels inward. So `/orders/:id/items` can be a page without `/orders/:id` being one.

A map value is a string, a state, a `({ params, path }) => ...` returning either, or a full crumb
object - which is how a level gets a picker:

```js
'/repos/:repo': ({ params }) => ({ label: params.repo, options: myRepos })
```

Two reasons this is a separate function rather than a `breadcrumbs({ crumbs })` prop:

- **Bundle cost.** Deriving inside the component pulls `router.js` into every app that renders a
  breadcrumb, including one that passes a literal array and has no router at all. That is the exact
  regression `adr/tree-shakeable-library.md` measures with a build-size test.
- **Composition.** Items are a state, so amending the trail needs no feature:

  ```js
  breadcrumbs({ items: computed([routeCrumbs(map), trail], (auto, extra) => [...auto, ...extra]) })
  ```

`routeCrumbs` lives in `imp/router` beside `useRoute`, not in a component barrel: a barrel export
must ship a `*.skill.md` (enforced by a test), and `imp skill std/routeCrumbs` describing a function
that is not a component is the wrong shape. It documents in `skills/routing.md` and
`docs/routing.md`.

## Build order

1. `overlay.js`'s `anchoredStyles` and the test-DOM top-layer emulation (`todo/overlay-seam.md`
   steps 1-2) - the vendored happy-dom has no `showPopover`, so nothing about the panel is
   unit-testable until that lands.
2. `options`, `max` and the shared filtered list, alongside or just before `dropdownMenu` - it is
   the same anchored panel, and building them together is what forces the shared list module out.
3. `routeCrumbs`, which is independent of both and can land at any point.

## Docs, skills and naming

- `breadcrumbs.skill.md` beside the component records what exists; the picker's props go in when
  they ship, and `docs/std-components.md` gets the same update.
- Two docs pages illustrate app code calling `breadcrumb()` singular - `docs/routing.md` and
  `site/articles/routing.md` - and should be aligned with the plural name.
