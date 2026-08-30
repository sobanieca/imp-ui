# shell example - a small todo app

A four-screen todo app built on `shell`, so the header, the sidebar and the bottom bar can be looked
at in one running page rather than in isolated previews.

```
imp start        serve it with live reload
imp test --unit  the in-process test
imp test --e2e   the browser spec
```

## What it shows

- **`shell` holds the frame.** `src/app.js` passes `header`, `sidebar` and `bottomNav` as DOM and
  the router slot as the main content. Nothing below the shell knows where it is rendered.
- **The same sections feed the sidebar and the bottom bar.** `src/nav.js` builds one list of
  sections into two `navMenu` calls - a grouped column with live counts for the sidebar, a
  short-labelled `direction: 'row'` one for the bottom bar. Passing `bottomNav` suppresses the
  mobile drawer, so below `48rem` the sidebar is replaced rather than hidden behind a trigger.
- **The marked section comes from the route.** `selected` is a `computed` over `useRoute()`, so
  `aria-current` follows navigation instead of being set by hand.
- **The counts are live.** Each count is a `computed` over the todo state, handed to a nav item as
  `tag: { text }`, so adding or ticking a task updates both menus.
- **The header is an app component.** `src/app_bar.js` is a plain component holding `appLogo`,
  `themeSelect` and `userCard` - a region is DOM, so the shell never needs a prop for what is in it.

## Layout note

A std layout component adopts the children you pass it into **its own** shadow root, so the styles
of the component that built those nodes do not reach them. `src/screens/tasks.js` therefore keeps
each styled box (`todo-add`, `todo-list`, `todo-row`) in its own component instead of styling a
`div` it hands to `stack`.
