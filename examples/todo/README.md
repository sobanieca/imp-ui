# imp todo — one app, every feature

A todo app in two halves — a classic quick list and a Trello-style board — built to exercise every
feature of the imp UI library in one buildless JavaScript file. No bundler, no install step:
`app.js` imports from the bare `imp` specifiers (`imp`, `imp/html`, `imp/state`, …), which
`imp start` resolves for you.

The two halves are **routed screens**: the quick list lives at `/`, the board at `/board`, and a
lazily-loaded guide at `/guide`. A persistent shell — the toolbar, the tabs, the tip box, and the
recent-activity log — stays put across navigation, and all app-lifetime state (todos, cards, theme)
lives in that shell above the router, so switching screens never loses your data.

## Run it

From this folder:

```sh
imp start
```

Then open <http://localhost:9085/> — the `imp.json` here sets `devServerPort` to `9085`. It also
declares two environments; the `default` alias points at `env/dev.json`, so plain `imp start`
already serves the development values. Try `imp start --env prod` and watch the footer label and the
seed-loading delay change.

Deep-link straight to <http://localhost:9085/board> and hit refresh — the dev server serves the app
for any extensionless path, so client routing takes over and the board comes up directly.

## Demo script — what to try

1. **Watch the load.** The shell's `onMount` is async: a skeleton (`placeholder`) shows while the
   seed todos "fetch" (the delay comes from `env.SEED_DELAY_MS`).
2. **Move between screens.** Click the tabs — _quick list_, _board_, _guide_. Each is an entry in
   the `router`'s `routes` table, the router swaps the matched screen in, and the active tab styling
   comes from `useRoute()`. Add a todo, hop to the board and back — it's still there: app-lifetime
   state lives in the shell above the router, so navigation never resets it. The URL follows along;
   refresh on `/board` and it comes straight up.
3. **Work the quick list.** Add todos, toggle them done, filter with the chips, watch the counts
   line and the completion meter follow. Type into an item's **notes** field, then toggle a
   _different_ item — the notes survive, because the keyed `each` keeps unchanged items' DOM.
4. **Promote a todo to the board.** _to board_ turns a list item into a draggable card in the _new_
   column, carrying whatever you typed into its **notes** field along as the card's note — then
   `navigate('/board')` takes you there to see it land.
5. **Drag a card mid-edit.** Click the `✎` button by the badge to open edit mode, type into the
   title or notes inputs — don't save — and drag it by its `⠿` grip into _in progress_. The
   half-written text is still there (the DOM moved, nothing re-rendered), while the badge now reads
   _in progress_: the card's `useState('todo.stage')` binding re-resolved to the new column.
   **save** stores the title and notes in the card's own `initState` — state a component initializes
   itself travels with it on the next drag.
6. **Open the guide.** The _guide_ tab returns a dynamic `import()` from its route, so its module is
   fetched on demand the first time you open it (and code-split by `imp build`). The router's
   `placeholder` covers the moment while that chunk downloads.
7. **Visit a dead URL.** Edit the address bar to something like `/nope` — no route matches, so the
   router renders its single `onNotFound` screen, with a button that `navigate`s home.
8. **Break the tip service.** Click _next tip_ a few times — every fourth tip throws, and the tip
   box's `onError` fallback appears in its place. _retry_ bumps a counter state whose `view` region
   re-creates the box: a fresh mount with a fresh error budget.
9. **Toggle the session clock.** Off unmounts it (`onUnmount` clears its interval); on mounts a
   fresh instance counting from zero.
10. **Flip the theme.** A headless component subscribes with `watch` and syncs `body[data-theme]`
    plus `localStorage` — reload and the choice sticks.
11. **Open _recent activity_** to see a plain unkeyed `each` fed by actions across the app —
    including drops handled by the board columns.
12. **Compare the two list bindings.** The main list and the _spotlight_ line below it show the same
    data two ways. The list is a keyed `each` on one `computed` of items + filter — flip the filter
    and items that stay visible keep their DOM (notes text survives). The spotlight instead _nests_
    `items.each(…)` inside `filter.view(…)`: fully supported, inner subscriptions are re-created and
    the old ones unsubscribed on every outer rebuild — but the whole inner region is rebuilt
    whenever the outer state changes, so nothing inside it survives a filter flip. That is why it
    holds display-only pills, never an input.

## Feature map

Every imp feature, and where it lives in `app.js`:

| Feature                                       | Where                                                                                                    |
| --------------------------------------------- | -------------------------------------------------------------------------------------------------------- |
| element factories / `el()`                    | everywhere; `el('meter', …)` builds the completion meter                                                 |
| type-based argument dispatch                  | `button('add', { … })` and `button({ … }, 'save')` both work — order is irrelevant                       |
| array children, flattening                    | `STAGES.map(…)` columns, filter chips                                                                    |
| conditional children skipped                  | `list.length === 0 && p(…)` empty state, `on && sessionClock()`                                          |
| `class` string / array / object               | most elements / stage badge / list items & filter chips                                                  |
| `style` object & string                       | column accent via `--accent` custom property / clock face                                                |
| `events`, incl. options form                  | handlers throughout; `[fn, { once: true }]` on the intro's _got it_ button                               |
| property-first props                          | `checked`, `value`, `draggable`; `data-id` and `aria-label` land as attributes                           |
| `mount` and its unmount function              | `mount('#app', …)`; dismissing the intro calls the function `mount('#intro', …)` returned                |
| `html()`                                      | the intro banner's copy                                                                                  |
| `component()` + factory args                  | the `todo-*` components, incl. per-screen ones; `todoCard({ title, note })`, `boardColumn({ …stage })`   |
| `styles` (component-scoped CSS)               | every visible component carries its own CSS; shared strings (`buttonStyles`, `fieldStyles`) compose them |
| `placeholder` + async `onMount`               | the shell skeleton while seeds load; the tip text; the router loader while the guide chunk downloads     |
| `onUnmount`                                   | the session clock clearing its interval                                                                  |
| `onError` boundary + remount retry            | the tip box; every fourth tip fails on purpose                                                           |
| move semantics                                | dragging cards between columns — DOM, input text, and own state travel; `useState` rebinds               |
| `initState` (component-scoped)                | `todo.stage` per column; `todo.cardTitle`, `todo.cardNote` & `todo.editing` per card                     |
| `initState` (app-lifetime, in root)           | `todo.items`, `todo.theme`, `todo.filter`, `todo.activity`, … in `todo-shell`, the root above the router |
| `useState`                                    | every screen reads the shell's state; theme sync, card stage badge, column activity logging              |
| `router({ routes })`                          | `/` list, `/board`, `/guide` area; the router swaps screens inside the persistent shell                  |
| `router` `placeholder`/`onError`/`onNotFound` | one router carries the guide loader, a route error boundary, and the single 404 screen                   |
| `area()` + `areaRoutes()` (code splitting)    | `'/guide': area(() => import('./guide.js'))` — the section's own module and table, fetched on demand     |
| `navigate()`                                  | the nav-bar tabs; _to board_ after promoting; the 404 and guide "back to the list" buttons               |
| `useRoute()`                                  | active-tab class derived from the live path, reacting as you navigate                                    |
| `get` / `set`                                 | throughout the handlers                                                                                  |
| `watch()`                                     | theme sync (headless component), driving the held `<meter>` node                                         |
| `text(select?)`                               | card title, counts line, theme button label                                                              |
| `view()`                                      | filter chips, empty state, stage badge, clock toggle, tip retry region                                   |
| `each()` keyed / unkeyed                      | the quick list / the activity log                                                                        |
| nested bindings                               | spotlight: `items.each(…)` inside `filter.view(…)`; tip box: component inside a `view`                   |
| `computed`                                    | visible (filtered) list, counts line, completion ratio, active-tab class                                 |
| `env`                                         | footer label and seed delay from `imp.json` environments                                                 |
