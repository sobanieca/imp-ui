# `breadcrumbs` - the trail as data, derived from the route or written by hand

A breadcrumb is two things an app usually conflates: a **trail of levels** the user is standing in,
and a **picker** at one of those levels for switching to a sibling - GitHub's repo crumb, which
opens a filterable list of the user's other repos. The trail is route-shaped and the picker is
overlay-shaped, so the component only holds together if the two are kept apart in the API.

The shape below keeps `breadcrumbs` a plain data-driven component in the same mould as `tabs` and
`navMenu` (`adr/standard-component-library.md`), and puts the route pairing in a function that
produces its data rather than in a prop that changes its behaviour.

## The component takes items and nothing else

```js
import { breadcrumbs } from 'imp/std/navigation'

breadcrumbs({
  items: [
    { id: 'home', label: 'Home', href: '/' },
    { id: 'orders', label: 'Orders', href: '/orders' },
    { id: 'order', label: 'Order 8f3a', href: '/orders/8f3a' },
  ],
})
```

`items` is an array or a state holding one, live like `navMenu`'s. The last item is the current
level: it renders as text with `aria-current="page"` rather than a link, whether or not it carries
an `href`.

| Prop     | Values                                 | Default       | Notes                 |
| -------- | -------------------------------------- | ------------- | --------------------- |
| `items`  | array of crumbs, or a state - live     | `[]`          | The trail, root first |
| `label`  | string, or a state - live              | `t()` default | Names the `<nav>`     |
| `max`    | number of crumbs shown before collapse | `4`           | `0` never collapses   |
| `events` | `{ select, open }`                     | -             | Both fire on the host |

Each crumb:

| Key       | Values                                     | Default   | Notes                               |
| --------- | ------------------------------------------ | --------- | ----------------------------------- |
| `label`   | string, or a state - live                  | required  | The word in the trail               |
| `id`      | string or number                           | its index | What the events refer to            |
| `href`    | string                                     | -         | Without one the crumb is inert text |
| `options` | array of `{ id, label, href }`, or a state | -         | Gives this crumb a picker           |

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
- **Composition.** Items are a state, so amending the trail needs no feature. A screen that wants to
  relabel the leaf, or a shell that wants a fixed crumb in front, writes ordinary state:

  ```js
  breadcrumbs({ items: computed([routeCrumbs(map), trail], (auto, extra) => [...auto, ...extra]) })
  ```

  There is no push channel to design, no registration to unwind on unmount, and no ordering to
  reconcile between contributors - which is what a `useCrumb()` that appends from inside a screen
  would have cost.

`routeCrumbs` lives in `imp/router` beside `useRoute`, not in the navigation barrel: a barrel export
must ship a `*.skill.md` (enforced by a test), and `imp skill std/routeCrumbs` describing a function
that is not a component is the wrong shape. It documents in `skills/routing.md` and
`docs/routing.md`.

## The picker is a crumb's own overlay

`options` may sit on **any** crumb, not only the last. GitHub puts it on the repo crumb, which is a
middle crumb once a file path follows it, and the collapsed crumb below needs the same panel - so
special-casing the trailing position buys nothing and forecloses both.

The trigger and the panel are rendered by `breadcrumbs` itself. Composing
`dropdownMenu({ options }, crumb)` cannot be made correct: `anchor-name` and `aria-controls` both
stop at a shadow root, so the panel would be unable to anchor to or reference the crumb
(`todo/overlay-seam.md`, _Where the component boundary falls_). This is the same constraint that
made `tooltip` a prop of the component owning the trigger.

A crumb with options renders **two controls**, not one:

- the crumb itself, a link to that level;
- a disclosure `<button popovertarget aria-expanded>` beside it, named `t()`-side as "Change
  {label}".

Folding both into one control is the tempting move and the wrong one - it takes away the ability to
navigate to the level the picker belongs to.

The panel is `popover="auto"` placed by CSS anchor positioning through the seam's `anchoredStyles`,
so light dismiss, Escape, stacking and placement are all platform. Above a threshold of options it
grows a filter field, and at that point it is `commandPalette`'s list with the dialog taken off:
same `fuzzy.js` scoring, same `aria-activedescendant` roving with focus parked in the field. **Lift
that list into `std/shared` rather than writing it a second time** - `dropdownMenu` is the third
consumer.

`events: { open }` fires when a panel opens, with the crumb's `id`, so an app can load the option
list into the state `options` reads. `events: { select }` matches `navMenu` exactly: cancelable,
`detail: { id, item }`, the href followed unless the app calls `preventDefault()`.

## Collapsing is the same panel again

A trail longer than `max` collapses its middle into a single crumb whose label is an ellipsis and
whose `options` are the hidden levels; the root and the last two are always shown. So the overflow
crumb is not a second mechanism - it is a crumb built from the ones it hides, through the picker
that already exists. Its disclosure is named "Show {count} hidden levels".

## Accessibility

- `<nav aria-label>` (default from the component's own messages) wrapping an `<ol>` of `<li>`.
- The last crumb is a `<span aria-current="page">`, not a link. With `options` it still gets its
  disclosure button.
- **The separator is a real `<span aria-hidden="true">`, not `li + li::before`.** Generated content
  is exposed to assistive tech in current engines, where it reads as "slash" between every level.
- Every disclosure button is icon-shaped and so takes an explicit name through `t()`
  (`adr/translatable-by-default.md`); crumb labels are app strings and are not translated by imp.
- Truncation is `min-inline-size: 0` with an ellipsis on the label, logical properties throughout so
  RTL mirrors, `focusRing` on both control types, and the shared `forcedColors` block.
- The test asserts the `navigation` role and its name, `aria-current` on the last crumb only,
  `aria-expanded` tracking the panel, and that the picker is operable from the keyboard.

## Build order

The picker half is blocked: `anchoredStyles` is step 1 of `todo/overlay-seam.md` and does not exist,
and the vendored happy-dom has no `showPopover`, so nothing about the panel is unit-testable until
the seam's test-DOM emulation lands either.

1. `overlay.js` and the test-DOM top-layer emulation (`todo/overlay-seam.md` steps 1-2).
2. `breadcrumbs` with `items`, `routeCrumbs`, collapsing and the picker, alongside or just before
   `dropdownMenu` - it is the same anchored panel, and building them together is what forces the
   shared list module out of `commandPalette`.

Shipping the trail first and adding `options` later is available - imp is pre-1.0 and a new prop
costs nothing - but a breadcrumb without the picker is missing the feature the component was wanted
for.

## Docs, skills and naming

- The catalog calls it `breadcrumbs` (`todo/stdlib-components.md`), plural like `tabs`. Two docs
  pages illustrate app code calling `breadcrumb()` singular - `docs/routing.md` and
  `site/articles/routing.md` - and should be aligned when this lands so the name reads one way.
- `breadcrumbs.skill.md` beside the component, `routeCrumbs` in `skills/routing.md` and
  `docs/routing.md`, and the component in `docs/std-components.md`.
