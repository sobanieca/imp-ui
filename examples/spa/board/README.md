# board — a Trello-style board that moves state with the DOM

A Trello-style todo board showing imp's move semantics in action. Cards are components; columns are
components that each provide a `board.stage` state; dragging a card to another column is a plain DOM
reparent — imp keeps the card alive and rebinds its subscriptions to the new column.

## Run it

From the `examples/` folder:

```sh
imp start index.html
```

Then open <http://localhost:4507/spa/board/index.html> (or pick _Todo board_ on the index page).

## What to try

1. **+ new card** adds a card to the _new_ column. Its badge reads the surrounding column's
   `board.stage` state.
2. Type into the card's input — don't save — and drag the card by its `⠿` grip into _in progress_.
   The half-written text is still there (the DOM moved, nothing re-rendered), while the badge now
   says _in progress_ (the `useState('board.stage')` binding re-resolved to the new column).
3. **save** stores the title in the card's own state (`initState('card.title', …)`). Drag the card
   again — the saved title travels with it, because state a component initializes itself belongs to
   the element, not the position.
