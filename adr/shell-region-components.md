# The shell's usual region contents ship as their own group, `imp/std/shell`

## Context

`shell` frames an app in named regions, see `app-shell-component.md`. It draws the nav levels
itself, from data. The rest of a region is DOM, and the frame places that DOM without a look inside.
So every app wrote the same pieces by hand: a brand block, a breadcrumb trail, the signed-in person,
a sign-out button, and the theme and language pickers. A nav row also wants an icon per destination,
and that needs a public `icon`.

There were two shapes. The pieces could be **props on `shell`**, as in `shell({ logo, user })`. That
would sort content by name again, and it would open the question that the ADR of the frame closed.
Or they could be **components that an app passes into a region**, which is what a region prop
already accepts. Nothing about them belongs to the frame. A theme picker on a settings screen is the
same component as the one in the bar.

## Decision

**`imp/std/shell` is a component group like any other.** It holds the pieces that usually fill the
frame of an app: `appLogo`, `breadcrumbs`, `userCard`, `orgSelect`, `themeSelect`, `langSelect` and
`notifications`.

- **`shell` gains no prop for a piece.** Each piece is DOM that the app passes into a region. So the
  frame does not change, and you can replace any piece with your own, and you ask the frame for no
  permission. The name of the group says where these pieces are usually used, not where you can use
  them. The one piece the frame renders itself is `breadcrumbs`, from the application map, see
  `application-map.md`. The trail is chrome, because it derives from the nav tree and folds into the
  phone title.
- **A nav row is not a new component.** A sidebar row and a navbar row are nodes of the application
  map. Each one takes an `icon`, which is any DOM, and a `tag`, through the `nav` of the shell. One
  data shape drives the column, the bar, the drawer and the bottom bar of a phone. `shell` renders
  that shape through one shared row builder. An action is not a destination, so it goes in `extras`,
  such as the `accountMenu`.
- **`icon` lands in the General group.** It draws one icon in `currentColor`, from a value that the
  app imports, see `bundled-icon-set.md`. Every icon prop in the library accepts **any DOM**. So
  `icon` is a convenience, and never a requirement. A component that needs a mark internally still
  draws its own mark, and it imports none.
- **`breadcrumbs` is the trail, and a crumb can carry a picker.** It sits in this group, beside
  `shell`. A crumb with `options` renders two controls: the crumb itself, which is a link to that
  level, and a disclosure button beside it, named "Change {label}" through `t()`. The button opens a
  `popover="auto"` panel of links that CSS anchor positioning places, on the shared anchored seam,
  see `overlay-top-layer.md`. To fold both into one control would remove the way to navigate to the
  level the picker belongs to. The component does not derive a trail from the route. The router
  derives it, and the shell hands it over. So an app with a literal trail carries no router.
- **`themeSelect` and `langSelect` own their setting completely.** They apply it, remember it in
  `localStorage`, and apply the remembered choice again on the next mount. `remember: false` turns
  that off. A remembered choice deliberately wins against the `applyTheme` of the app at startup.
  With no remembered choice, the component applies its first option only when the app has applied no
  theme. So imp never overwrites the theme of an app on a first visit.
- **Every picker of the group is a `menuButton`.** `themeSelect`, `langSelect` and `orgSelect`
  render the shared menu, with the current choice on the trigger and a `menuitemradio` per option. A
  native `<select>` in a bar had a different look in every browser and no room for an icon or an
  avatar. A menu is the one control of the library for a choice from a short list, and the three
  pickers add no drawing of their own to it.
- **`orgSelect` is the tenant switcher, and it remembers nothing.** It shows the organizations that
  the app passes, marks the current one, and reports a choice through a cancelable `select` event
  and a write into the `selected` state. The tenant belongs to the session and to the URL, so what a
  switch does is the app's: a navigation to the param node of the tenant, see `application-map.md`.
  The theme and the language pickers remember, because their setting belongs to the device.
- **An action that is asynchronous, and that can fail, is a function prop**, as the `onSubmit` of
  `bugReport`. You cannot await a `CustomEvent`. imp holds no session, and it talks to no identity
  provider.
- **`notifications` is the bell, and it renders its own drawer.** It composes `button`, a `tag` with
  the unread count, and a modal `drawer` with the list. So an app gives the drawer no mount point.
  The bell takes no data. It reads the app-wide store that `notify` writes, see
  `app-wide-notification-store.md`. The list inside the drawer is a component of its own, because
  the CSS of the bell does not reach the content of the drawer, see `shadow-dom-isolation.md`.
- **`userCard` displays the person, and nothing else.** It has no sign-in button, no sign-out button
  and no menu, because how a person signs in and out differs with every app, and a button with a
  fixed label in the card was the wrong place for that decision. The app renders its own `button` or
  `menuButton` beside the card. Whether anybody is signed in is the guard of the root, in the router,
  and the sign-in page is a node of the map, see `app-shell-component.md`.

## Consequences

- The frame is a quick win, and not an empty grid. `shell` with this group stands an app up, and
  nobody writes markup for a region by hand.
- This is the first group named after a **place**, and not after a kind of thing. imp accepts that.
  The alternative was to spread six components across General, Display and Layout. Then the pieces
  that belong together would no longer sit together. `shell` itself lives here too, so the frame and
  its parts share one import.
- `icon` costs only the icons that an app names, because each one is its own export, see
  `bundled-icon-set.md`. The props that accept DOM keep even that cost optional.
- Two components write to `localStorage`. Both keys carry a namespace, which is `imp.theme` and
  `imp.lang`. imp wraps each read and each write. A browser with no storage falls back to behaviour
  for the session, and it does not fail.
- `breadcrumbs` lives here, beside the frame that renders it. The picker is part of this component,
  and not a second one. The panel has no filter field.
