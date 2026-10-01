# A notification is plain data in one app-wide store, raised by a function with no `self`

## Context

A toast is a popup in a corner. A person who looks away misses it, and then the message is lost, and
so is the question that it asked. So imp keeps every notification. A bell in the frame of the app
opens a list of the recent ones. The popup, the count on the bell, and the list must always agree.

Every other shared value in imp is a named state that a component resolves from its position in the
DOM, see `state-plain-data-values.md`. That shape does not fit here, for two reasons.

- **A notification outlives an area.** The bell sits in the frame. The region that draws the popups
  sits beside the router. A call site inside an area is an ancestor of neither one. So no position
  in the tree can provide a state that all three reach.
- **The HTTP client raises one from outside any component.** A failed request has no `self`, see
  `http-client.md`. Only a function that needs no `self` fits that call site.

## Decision

**One store holds every notification of the app. `notify(data)` and `dismiss(id)` are plain
functions that write to it. `toast` and `notifications` are two independent watchers that draw it.**

- **The store is one `createState` value, built on first use.** It lives in a module beside the
  region, in `lib/src/std/feedback`. Nothing runs at module scope, see `tree-shakeable-library.md`.
  Its value is one array of entries, newest first. The bell imports the store by path from the
  feedback folder, because the store belongs to neither component.
- **An entry is plain data.** It holds the keys of the call, which are `id`, `kind`, `title`,
  `description`, `icon`, `image`, `link`, `actions`, `duration` and `ttl`. The store adds four keys.
  `time` is the ISO time of the call. `read` is a boolean. `choice` is the `id` of the chosen
  action, or `null`. `popup` is true while the entry wants a place in the corner.
- **The pending answers live beside the store, and never inside it.** `notify` returns a promise. A
  `Map` from the `id` to the resolver holds it, because a promise is not plain data. The promise
  resolves with the `id` of an action. It resolves with `null` on a dismissal, on the end of the
  `ttl`, and when the `limit` drops the entry.
- **The store owns the `ttl` and the `limit`. The region owns the `duration` and the `visible`
  count.** The store has the documented defaults, so `notify` works before a region mounts, and with
  no region at all. A mounted region writes its `ttl` and its `limit` to the store, and the store
  takes the defaults back when the region unmounts. The timer of a popup pauses on the pointer and
  on the focus, and those are events of the DOM. So that timer lives in the region.
- **A call with a listed `id` replaces the entry.** The entry keeps its place while its popup is in
  the corner, so a progress popup does not jump. When the popup has left, the entry moves to the
  front, unread, and the popup shows again. That keeps a repeated failure as one entry, and it keeps
  the list in the order of the time.
- **An open list takes its entries out of the corner.** The drawer of the bell and the popups use
  the same edge of the screen. So when the drawer opens, every listed entry leaves the corner, read.
  A listed entry that arrives while the drawer is open goes to the list only, read, because the
  person sees it there. The page behind a modal is inert, so a popup there would cover the list and
  take no click.
- **An entry with `ttl: 0` is a plain toast.** The store holds it only while its popup is in the
  corner. The bell never lists it and never counts it.
- **The store lives in memory, for the session.** A pending action is a promise at a call site, and
  a promise does not survive a reload. So a list that survived a reload would show actions that
  nothing can answer.
- **Only one region draws the popups.** A second `toast()` warns and renders nothing. Two regions
  would show every popup twice, and would announce it twice.
- **The region is a `popover="manual"` element that imp promotes with `showPopover()`.** It does not
  use `panelOverlay` of `overlay-top-layer.md`, because that helper gives the focus back on a close.
  A popup never takes the focus, so a restore would move the focus away from the work of the person.
  The region gives the focus back in one case only: a popup that held the focus closes. The popups
  use `overlayMotion` and the closing slide of the same seam. The region shows itself again when a
  new popup arrives, so it sits above a modal that opened in the meantime.
- **The text of a popup goes to one of two live regions that stay mounted.** They sit outside the
  popover, because a hidden popover is not in the accessibility tree. A `role="status"` element
  takes `info` and `success`. A `role="alert"` element takes `warning` and `error`. The popup itself
  carries no live role, so a screen reader announces the text once.

## Consequences

- **The data of a notification has a hard limit.** An icon is a Lucide export, or an image URL. The
  text has no markup. A link is its own key. An action is an `id` and a label, and never a function.
  Anything else is not plain data, and the store reports it.
- The popup, the count and the list cannot disagree, because all three read one value.
- A call site needs no component. A module, a service and a hook of an HTTP client can all raise a
  notification. The cost is that a test cannot scope the store to a subtree. A test dismisses what
  it raised.
- A caller that wants to change or remove an entry passes its own `id`. `notify` returns the answer
  of the person, and not a handle.
- A popup that arrives while a modal is open is visible, and it is inert. The platform makes
  everything outside a modal inert. The list of the bell is the path to its actions.
- The list does not survive a reload. An app that needs a durable list feeds `notify` from its
  server at the start.
