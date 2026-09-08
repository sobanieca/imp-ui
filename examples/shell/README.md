# shell example - a small todo app

A todo app built on one application map, so the navbar, the sidebar, the trail and the extras of
`shell` can be looked at in one running page rather than in isolated previews.

```
imp start        serve it with live reload
imp map          print the map
imp test --unit  the in-process test
imp test --e2e   the browser spec
```

## What it shows

- **One map drives everything.** `src/app-map.js` lists the features: the tasks with three filters
  and a task detail, and the settings. The router, the navbar, the sidebar, the trail and the page
  title derive from it. Nothing else names a path.
- **`shell` holds the frame.** `src/app.js` passes `logo`, `navbar: { map, icons }`, `sidebar` and
  `extras`, with the router as the main content. Nothing below the shell knows where it is rendered.
- **The screens bind by handle.** `screens` maps `map.tasks.all`, `map.tasks.$taskId` and the rest
  to their factories. A screen reads its heading and its description from `node.spec`.
- **A section without children gets no sidebar.** Open Settings and the column is gone, not empty,
  and the content takes the full width.
- **The marked rows come from the route.** The router derives the current section and row, so
  `aria-current` follows navigation instead of being set by hand.
- **The counts are live.** `navbar.tags` binds a state to each filter by handle, the app root fills
  it from the todo list, and adding or ticking a task updates the sidebar.
- **A task is a param node with a picker.** `router({ options })` binds `$taskId` to a state that
  the app root fills with the tasks. Open a task, and the crumb for it lists the other tasks.
  Picking one keeps you on the detail screen of that task.
- **The map holds no binding.** `home` forwards to the tasks through `redirect(map.tasks)` in
  `screens`, and the page title is a `title` function of the router. The map file says only what the
  features are.
- **The root forwards.** `/` forwards to `/tasks`, and `/tasks` forwards to its first filter,
  because nothing binds a screen to those nodes.
- **The extras hold the person.** `themeSelect` and a `userCard` sit in `extras`. Shrink the window
  past `48rem` and the frame folds into a phone app: the filters become the bottom bar, the top bar
  becomes a hamburger and a two-line title from the trail, and the sections, the theme picker and
  the card move into the drawer.

## Layout note

A std layout component adopts the children you pass it into **its own** shadow root, so the styles
of the component that built those nodes do not reach them. `src/screens/tasks.js` therefore keeps
each styled box (`todo-add`, `todo-list`, `todo-row`) in its own component instead of styling a
`div` it hands to `stack`.
