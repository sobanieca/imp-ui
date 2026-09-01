# shell example - a small todo app

A four-screen todo app built on `shell`, so the navbar, the sidebar and the account chrome can be
looked at in one running page rather than in isolated previews.

```
imp start        serve it with live reload
imp test --unit  the in-process test
imp test --e2e   the browser spec
```

## What it shows

- **`shell` holds the frame.** `src/app.js` passes `logo`, `navbar`, `sidebar`, `extras` and
  `account`, with the router slot as the main content. Nothing below the shell knows where it is
  rendered.
- **One nav tree, three surfaces.** `src/nav.js` declares the sections once: Tasks carries its own
  `groups` of filters, Settings carries none. The frame lists the sections in the top bar, the
  current section's filters in the column, and the same filters in the bottom bar on a phone.
- **A section without groups gets no sidebar.** Open Settings and the column is gone, not empty, and
  the content takes the full width.
- **The marked rows come from the route.** `navbar.selected` and `sidebar.selected` are `computed`
  over `useRoute()`, so `aria-current` follows navigation instead of being set by hand.
- **The counts are live.** Each count is a `computed` over the todo state, handed to a nav item as
  `tag: { text }`, so adding or ticking a task updates the sidebar.
- **The account is data too.** `account: { name, description }` is all the app passes and the frame
  builds the `userCard`. Shrink the window past `48rem` and the frame folds into a phone app: the
  filters become the bottom bar, the top bar becomes a hamburger and a two-line title, and the
  sections, the theme picker and the card move into the drawer.

## Layout note

A std layout component adopts the children you pass it into **its own** shadow root, so the styles
of the component that built those nodes do not reach them. `src/screens/tasks.js` therefore keeps
each styled box (`todo-add`, `todo-list`, `todo-row`) in its own component instead of styling a
`div` it hands to `stack`.
