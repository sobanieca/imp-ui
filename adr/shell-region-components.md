# The shell's usual region contents ship as their own group, `imp/std/shell`

## Context

`shell` frames an app in named regions (`app-shell-component.md`). The nav levels it draws itself,
from data; the rest of a region is DOM the frame places without looking inside. That leaves every
app writing the same pieces by hand: a brand block, a breadcrumb trail, the signed-in person, a
sign-out button, and the theme and language pickers. `todo/stdlib-components.md` recorded the gap as
"ready-made contents for `shell`'s regions" and named its blocker: nav rows want an icon per
destination, and imp had four private marks rather than a public `icon`.

Two shapes were available. The pieces could be **props on `shell`** (`shell({ logo, user })`), which
would sort content by name again and re-open the question the frame ADR closed. Or they could be
**components an app passes into a region**, which is what a region prop already accepts. Nothing
about them is frame-specific: a breadcrumb in a page body or a theme picker on a settings screen is
the same component.

## Decision

**`imp/std/shell` is a component group like any other**, holding the pieces an app frame is usually
filled with: `appLogo`, `breadcrumbs`, `userCard`, `themeSelect` and `langSelect`.

- **`shell` gains no props.** Every piece is DOM the app passes into a region, so the frame is
  unchanged and any piece can be swapped for the app's own without asking it for permission. The
  group's name says where they are usually used, not where they may be used.
- **Nav rows are not a new component.** A sidebar row and a navbar row are nav items, which take an
  `icon` (any DOM) and an `onClick`; a row with an `onClick` and no `href` renders a real
  `<button>`, which is how a menu carries an action beside its destinations. One data shape drives
  the column, the bar, the drawer and the phone's bottom bar, and `shell` and `navMenu` render it
  through one shared row builder.
- **`icon` lands in the General group**, drawing one icon in `currentColor` from a value the app
  imports (`bundled-icon-set.md`). Every icon-taking prop in the library accepts **any DOM**, so
  `icon` is a convenience and never a requirement, and a component that needs a mark internally
  still draws its own rather than importing one.
- **`breadcrumbs` ships as the trail only**, in this group rather than in `imp/std/navigation`: it
  is a region's content, and its sibling-picker half is still blocked on the anchored-overlay seam
  (`todo/breadcrumbs.md`). Deriving a trail from the route stays out of the component, so an app
  with a literal trail carries no router.
- **`themeSelect` and `langSelect` own their setting end to end** - they apply it, remember it in
  `localStorage` and re-apply the remembered choice on the next mount, with `remember: false` to opt
  out. A remembered choice deliberately wins over the app's own `applyTheme` at startup; with no
  remembered choice, the component applies its first option only when the app has applied no theme,
  so an app's own theme is never clobbered on a first visit.
- **An asynchronous, failable action is a function prop** - `userCard`'s `onSignIn` / `onSignOut`,
  following `bugReport`'s `onSubmit` - because a `CustomEvent` cannot be awaited. imp holds no
  session and talks to no identity provider.

## Consequences

- The frame is a quick win rather than an empty grid: `shell` plus this group stands an app up
  without hand-written region markup.
- The group is the first one named after a **place** rather than a kind of thing. That is accepted:
  the alternative was scattering six components across General, Display and Navigation, where the
  pieces that go together would no longer be found together.
- `icon` costs only the icons an app names, because each one is its own export
  (`bundled-icon-set.md`), and the DOM-accepting props keep even that optional.
- Two components now write to `localStorage`, which imp had not used before. Both keys are
  namespaced (`imp.theme`, `imp.lang`), reads and writes are wrapped, and a storage-less browser
  degrades to session-only behaviour rather than failing.
- `breadcrumbs` living here means the navigation group holds no trail; when the picker lands it
  extends this component rather than opening a second one.
