# The shell's usual region contents ship as their own group, `imp/std/shell`

## Context

`shell` frames an app in named regions, see `app-shell-component.md`. It draws the nav levels
itself, from data. The rest of a region is DOM, and the frame places that DOM without a look inside.
So every app wrote the same pieces by hand: a brand block, a breadcrumb trail, the signed-in person,
a sign-out button, and the theme and language pickers. `todo/stdlib-components.md` recorded that gap
as "ready-made contents for the regions of `shell`". It also named the blocker. A nav row wants an
icon per destination, and imp had four private marks in place of a public `icon`.

There were two shapes. The pieces could be **props on `shell`**, as in `shell({ logo, user })`. That
would sort content by name again, and it would open the question that the ADR of the frame closed.
Or they could be **components that an app passes into a region**, which is what a region prop
already accepts. Nothing about them belongs to the frame. A breadcrumb trail in the body of a page,
and a theme picker on a settings screen, are the same components.

## Decision

**`imp/std/shell` is a component group like any other.** It holds the pieces that usually fill the
frame of an app: `appLogo`, `breadcrumbs`, `userCard`, `themeSelect` and `langSelect`.

- **`shell` gains no prop.** Each piece is DOM that the app passes into a region. So the frame does
  not change, and you can replace any piece with your own, and you ask the frame for no permission.
  The name of the group says where these pieces are usually used, not where you can use them.
- **A nav row is not a new component.** A sidebar row and a navbar row are nav items. Each one takes
  an `icon`, which is any DOM, and an `onClick`. A row with an `onClick` and no `href` renders a
  real `<button>`. That is how a menu carries an action beside its destinations. One data shape
  drives the column, the bar, the drawer and the bottom bar of a phone. `shell` renders that shape
  through one shared row builder.
- **`icon` lands in the General group.** It draws one icon in `currentColor`, from a value that the
  app imports, see `bundled-icon-set.md`. Every icon prop in the library accepts **any DOM**. So
  `icon` is a convenience, and never a requirement. A component that needs a mark internally still
  draws its own mark, and it imports none.
- **`breadcrumbs` ships as the trail only.** It sits in this group, and not in `imp/std/navigation`.
  It is the content of a region. Its other half, the sibling picker, still waits on the seam of an
  anchored overlay, see `todo/breadcrumbs.md`. The component does not derive a trail from the route.
  So an app with a literal trail carries no router.
- **`themeSelect` and `langSelect` own their setting completely.** They apply it, remember it in
  `localStorage`, and apply the remembered choice again on the next mount. `remember: false` turns
  that off. A remembered choice deliberately wins against the `applyTheme` of the app at startup.
  With no remembered choice, the component applies its first option only when the app has applied no
  theme. So imp never overwrites the theme of an app on a first visit.
- **An action that is asynchronous, and that can fail, is a function prop.** `onSignIn` and
  `onSignOut` of `userCard` are examples, and they follow the `onSubmit` of `bugReport`. You cannot
  await a `CustomEvent`. imp holds no session, and it talks to no identity provider.

## Consequences

- The frame is a quick win, and not an empty grid. `shell` with this group stands an app up, and
  nobody writes markup for a region by hand.
- This is the first group named after a **place**, and not after a kind of thing. imp accepts that.
  The alternative was to spread six components across General, Display and Navigation. Then the
  pieces that belong together would no longer sit together.
- `icon` costs only the icons that an app names, because each one is its own export, see
  `bundled-icon-set.md`. The props that accept DOM keep even that cost optional.
- Two components now write to `localStorage`, and imp had not used it before. Both keys carry a
  namespace, which is `imp.theme` and `imp.lang`. imp wraps each read and each write. A browser with
  no storage falls back to behaviour for the session, and it does not fail.
- `breadcrumbs` lives here, so the navigation group holds no trail. When the picker arrives, it
  extends this component. It does not open a second one.
