# `breadcrumbs` - the sibling picker, and the route derivation

The trail has landed, as `breadcrumbs` in `imp/std/shell`, see `adr/shell-region-components.md`. It
takes its items as plain data. It marks the last crumb with `aria-current="page"`. It renders a real
element as a separator. It uses the order of activation of the nav rows of `shell`, which is
`select`, then `onClick`, then the href. What is still owed is the half that was blocked, and the
pairing with the route, which was always meant to live outside the component.

## The picker is an overlay of one crumb

A breadcrumb trail is two things, and an app usually mixes them. The first is a **trail of levels**.
The second is a **picker**, at one of those levels, to change to a sibling. The repository crumb of
GitHub is the example. It opens a list of the other repositories of the user, and a person can
filter it. The trail shipped. The picker is an anchored panel, and it waits on the seam.

A crumb grows one key:

| Key       | Values                                     | Default | Notes                     |
| --------- | ------------------------------------------ | ------- | ------------------------- |
| `options` | array of `{ id, label, href }`, or a state | -       | Gives this crumb a picker |

`options` can sit on **any** crumb, and not on the last one only. GitHub puts it on the repository
crumb. That crumb is in the middle, once a path to a file follows it. So a special case for the last
position buys nothing.

`breadcrumbs` renders the trigger and the panel itself. Nobody can make a composition of
`dropdownMenu({ options }, crumb)` correct. `anchor-name` and `aria-controls` both stop at a shadow
root. So the panel could not anchor to the crumb, and it could not reference the crumb. See
`todo/overlay-seam.md`, in _Where the component boundary falls_.

A crumb with options renders **two controls**, and not one. The first is the crumb itself, which is
a link to that level. The second is a disclosure, which is a `<button popovertarget aria-expanded>`
beside it. imp names it through `t()`, as "Change {label}". To fold both into one control is the
tempting move, and it is the wrong one. It removes the ability to navigate to the level that the
picker belongs to.

The panel is `popover="auto"`. CSS anchor positioning places it, through the `anchoredStyles` of the
seam. So the light dismissal, Escape, the stacking and the placement all belong to the platform.
Above a threshold of options, the panel grows a field for a filter. That field scores the options
fuzzily. It uses `aria-activedescendant` to move a virtual focus, and it parks the real focus in the
field. **Write that list once, in `std/shared`, and not in each panel.** `dropdownMenu` is the other
consumer, and somebody writes the scoring with it, and not before it.

`events: { open }` fires when a panel opens. It carries the `id` of the crumb. So an app can load
the list of options into the state that `options` reads.

## To collapse the trail is the same panel again

`max` arrives with the picker, because it is built from it. Its default is `4`, and `0` never
collapses. A trail that is longer than `max` collapses its middle into one crumb. The label of that
crumb is an ellipsis, and its `options` are the levels that imp hid. imp always shows the root, and
the last two crumbs. imp names its disclosure "Show {count} hidden levels". Until `max` lands, a
long trail wraps, and an app makes `items` shorter itself.

## The pairing with the route is a derivation, and not a mode

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

`routeCrumbs(map)` returns a computed over `imp.route`. It walks every prefix of the current path,
which is `/`, then `/orders`, then `/orders/8f3a`. It matches each prefix against the patterns of
the map, with the segment matcher of the router. It **drops a prefix that matches nothing**. It
emits one crumb per match. It sets `href` to that prefix, through `url()`, so a base path applies.
It accumulates the params, from the outer level inward. So `/orders/:id/items` can be a page, and
`/orders/:id` does not have to be one.

A value in the map is a string, a state, or a function `({ params, path }) => ...` that returns
either of those. It can also be a full crumb object, and that is how a level gets a picker:

```js
'/repos/:repo': ({ params }) => ({ label: params.repo, options: myRepos })
```

There are two reasons why this is a separate function, and not a `breadcrumbs({ crumbs })` prop:

- **The cost in a bundle.** To derive inside the component pulls `router.js` into every app that
  renders a breadcrumb trail. That includes an app that passes a literal array, and that has no
  router. That is exactly the regression that `adr/tree-shakeable-library.md` measures, with a test
  of the build size.
- **The composition.** The items are a state. So to add to the trail needs no feature:

  ```js
  breadcrumbs({ items: computed([routeCrumbs(map), trail], (auto, extra) => [...auto, ...extra]) })
  ```

`routeCrumbs` lives in `imp/router`, beside `useRoute`. It does not live in a barrel of components.
An export of a barrel must ship a `*.skill.md` file, and a test enforces that. An
`imp skill std/routeCrumbs` page that describes a function, and not a component, is the wrong shape.
So `routeCrumbs` documents itself in `skills/routing.md`, and in `docs/routing.md`.

## The order of the work

1. Build the `anchoredStyles` of `overlay.js`, and the emulation of the top layer in the test DOM.
   Those are steps 1 and 2 of `todo/overlay-seam.md`. The vendored happy-dom has no `showPopover`.
   So nothing about the panel is testable in a unit test until that lands.
2. Build `options`, `max` and the shared filtered list. Do that beside `dropdownMenu`, or just
   before it. It is the same anchored panel, and to build both together is what forces the shared
   module for the list out.
3. Build `routeCrumbs`. It is independent of both, and it can land at any point.

## Documentation, skills and the name

- `breadcrumbs.skill.md`, beside the component, records what exists. The props of the picker go in
  when they ship. `docs/std-components.md` gets the same update.
- Two pages of the documentation show app code that calls `breadcrumb()`, in the singular. Those are
  `docs/routing.md` and `site/articles/routing.md`. Align both with the plural name.
