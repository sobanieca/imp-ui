# imp todo — one app, every feature

A todo app in two halves — a classic quick list and a Trello-style board — built to exercise every
feature of the imp UI library in one buildless JavaScript file. No bundler, no install step:
`app.js` imports from the bare `imp` specifier, which `imp start` resolves for you.

## Run it

From this folder:

```sh
imp start
```

Then open <http://localhost:9085/> — the `imp.json` here sets `devServerPort` to `9085`. It also
declares two environments; the `default` alias points at `env/dev.json`, so plain `imp start`
already serves the development values. Try `imp start --env prod` and watch the footer label and the
seed-loading delay change.

## Demo script — what to try

1. **Watch the load.** The app's `onMount` is async: a skeleton (`placeholder`) shows while the seed
   todos "fetch" (the delay comes from `env.SEED_DELAY_MS`).
2. **Work the quick list.** Add todos, toggle them done, filter with the chips, watch the counts
   line and the completion meter follow. Type into an item's **notes** field, then toggle a
   _different_ item — the notes survive, because the keyed `each` keeps unchanged items' DOM.
3. **Promote a todo to the board.** _to board_ turns a list item into a draggable card in the _new_
   column, carrying whatever you typed into its **notes** field along as the card's note.
4. **Drag a card mid-edit.** Click the `✎` button by the badge to open edit mode, type into the
   title or notes inputs — don't save — and drag it by its `⠿` grip into _in progress_. The
   half-written text is still there (the DOM moved, nothing re-rendered), while the badge now reads
   _in progress_: the card's `useState('todo.stage')` binding re-resolved to the new column.
   **save** stores the title and notes in the card's own `initState` — state a component initializes
   itself travels with it on the next drag.
5. **Break the tip service.** Click _next tip_ a few times — every fourth tip throws, and the tip
   box's `onError` fallback appears in its place. _retry_ bumps a counter state whose `view` region
   re-creates the box: a fresh mount with a fresh error budget.
6. **Toggle the session clock.** Off unmounts it (`onUnmount` clears its interval); on mounts a
   fresh instance counting from zero.
7. **Flip the theme.** A headless component subscribes with `on` and syncs `body[data-theme]` plus
   `localStorage` — reload and the choice sticks.
8. **Open _recent activity_** to see a plain unkeyed `each` fed by actions across the app —
   including drops handled by the board columns.
9. **Compare the two list bindings.** The main list and the _spotlight_ line below it show the same
   data two ways. The list is a keyed `each` on one `mergeStates` of items + filter — flip the
   filter and items that stay visible keep their DOM (notes text survives). The spotlight instead
   _nests_ `items.each(…)` inside `filter.view(…)`: fully supported, inner subscriptions are
   re-created and the old ones unsubscribed on every outer rebuild — but the whole inner region is
   rebuilt whenever the outer state changes, so nothing inside it survives a filter flip. That is
   why it holds display-only pills, never an input.

## Feature map

Every imp feature, and where it lives in `app.js`:

| Feature                              | Where                                                                                                      |
| ------------------------------------ | ---------------------------------------------------------------------------------------------------------- |
| element factories / `el()`           | everywhere; `el('meter', …)` builds the completion meter                                                   |
| type-based argument dispatch         | `button('add', { … })` and `button({ … }, 'save')` both work — order is irrelevant                         |
| array children, flattening           | `STAGES.map(…)` columns, filter chips                                                                      |
| conditional children skipped         | `list.length === 0 && p(…)` empty state, `on && sessionClock()`                                            |
| `class` string / array / object      | most elements / stage badge / list items & filter chips                                                    |
| `style` object & string              | column accent via `--accent` custom property / clock face                                                  |
| `events`, incl. options form         | handlers throughout; `[fn, { once: true }]` on the intro's _got it_ button                                 |
| property-first props                 | `checked`, `value`, `draggable`; `data-id` and `aria-label` land as attributes                             |
| `mount` and its unmount function     | `mount('#app', …)`; dismissing the intro calls the function `mount('#intro', …)` returned                  |
| `html()`                             | the intro banner's copy                                                                                    |
| `component()` + factory args         | all seven `todo-*` components; `todoCard({ title, note })`, `boardColumn({ …stage, cards })`               |
| `styles` (component-scoped CSS)      | every visible component carries its own CSS; shared strings (`buttonStyles`, `fieldStyles`) compose them   |
| `placeholder` + async `onMount`      | the app skeleton while seeds load; the tip text                                                            |
| `onUnmount`                          | the session clock clearing its interval                                                                    |
| `onError` boundary + remount retry   | the tip box; every fourth tip fails on purpose                                                             |
| move semantics                       | dragging cards between columns — DOM, input text, and own state travel; `useState` rebinds                 |
| `initState` (component-scoped)       | `todo.items` & friends in `todo-app`; `todo.stage` per column; `todo.cardTitle` & `todo.cardNote` per card |
| `initState` (module scope, pagewide) | `todo.theme`                                                                                               |
| `useState`                           | theme sync, card stage badge, column activity logging                                                      |
| `get` / `set` / `update`             | throughout the handlers                                                                                    |
| `on()`                               | theme sync (headless component), driving the held `<meter>` node                                           |
| `text(select?)`                      | card title, counts line, theme button label                                                                |
| `view()`                             | filter chips, empty state, stage badge, clock toggle, tip retry region                                     |
| `each()` keyed / unkeyed             | the quick list / the activity log                                                                          |
| nested bindings                      | spotlight: `items.each(…)` inside `filter.view(…)`; tip box: component inside a `view`                     |
| `mergeStates`                        | visible (filtered) list, counts line, completion ratio                                                     |
| `env`                                | footer label and seed delay from `imp.json` environments                                                   |
