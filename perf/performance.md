# Performance tests

`perf/` holds the performance test suite of imp. It measures how fast imp mounts components, applies
state updates and disposes of components, and it runs the same scenarios against React and Vue. This
file describes the method, the scenarios, how to run the suite, and the results of the reference
run.

## Goals

- **Measure imp on the paths that users hit most**: the first mount, a state update that reaches one
  node, an update that reaches many nodes, and the removal of a subtree.
- **Prove that disposal is complete.** After an unmount, imp must leave no DOM node, no event
  listener and no retained state behind. The suite checks this with the garbage collector, not by
  reading the code.
- **Compare against a virtual DOM (React) and a compiled reactive runtime (Vue)** with the same
  scenarios, the same data and the same DOM. The comparison shows where the real-DOM design of imp
  wins and where it costs.
- **Give a stable base** for a regression check. A run writes a JSON file, so two runs on the same
  machine compare number by number.

## How to run

```
cargo xtask perf                              build the three apps and run every scenario
cargo xtask perf --frameworks imp             one framework only (imp, react, vue)
cargo xtask perf --filter "1k rows"           scenarios whose name contains the text
cargo xtask perf --samples 20                 samples per scenario, default 10
cargo xtask perf --skip-build                 reuse perf/dist/ from the previous run
cargo xtask perf --profile                    readable bundles, and a CPU profile per scenario
```

The runner builds the imp binary first, so the numbers always describe the current source. It
builds the imp app with `imp build`, and the React and Vue apps with the bundler of imp. It serves
`perf/dist/` on a local port, and runs `perf/driver.spec.js` with `imp test`. The spec drives the
three apps through Puppeteer, and prints the result for xtask to write. A run
prints one line per scenario and writes two files:

- `perf/results/<date>.json` holds every sample, every memory probe and every DOM snapshot.
- `perf/results/latest.md` holds the tables of the run.

With `--profile`, the run also writes `perf/results/<framework>-<scenario>.cpuprofile` for the last
sample of every scenario. Chrome DevTools opens the file in its Performance panel. For a quick look
in the terminal, `cargo xtask perf-profile <file> 25` prints the functions with the most self time, and `--tree` at the end prints the call tree with inclusive times. A profiled run builds
readable bundles, without minification, so the function names are real.

The results folder is not committed. Copy a table into this file when a run becomes a reference.

A run needs Chrome. The suite finds the browser the same way `imp test --e2e` does, and it downloads
a pinned Chrome for Testing when the machine has none. The React and Vue apps import `npm:`
specifiers with exact versions, and the first build downloads them into the cache of imp.

## Layout

```
perf/
  performance.md          this file
  driver.spec.js          the imp test spec that drives Chrome through the scenarios
  scenarios.js            the scenario list, shared by every framework
  report.js               turns a result into the markdown tables
  profile-summary.js      summarizes a .cpuprofile file; cargo xtask perf-profile runs it
  apps/
    shared/bench-data.js  the row data and the list operations that every app shares
    imp/                  an imp project: imp.json, env.json, index.html, app.js,
                          and rich-text-document.js, the document of the rich text scenarios
    react/                index.html, app.js (React 19, createElement, no JSX)
    vue/                  index.html, app.js (Vue 3, render functions, no templates)
  dist/                   the built apps (not committed)
  results/                the output of a run (not committed)
```

## Method

**One app per framework, one protocol.** Each app renders the same DOM: a `ul` of `li` rows, each
row with a `span.label` and a `button.remove` that removes the row on click. Each app exposes
`window.__bench.ops`, an object of named operations. A scenario is a list of operations. The runner
never touches framework code. It calls the operations by name, so every framework does the same work
in its own idiomatic way.

**Each operation returns when the DOM is final.** imp updates the DOM in the `set` call, and its
unmount cleanup runs in a microtask, so the imp unmount operations drain the microtask queue before
they return. React wraps every update in `flushSync`, so the commit is part of the measured time.
Vue awaits `nextTick()` after every change. The runner measures the operation, then reads
`document.body.offsetHeight`, so the time includes style and layout, but not paint. The JSON file
records the layout part on its own, as `layouts`, next to the total `durations`. The split tells
whether a slow scenario spends its time in the framework or in the browser.

**Each sample starts from a fresh page.** The runner reloads the page, runs the untimed `prepare`
steps, times the `measure` steps, and runs the untimed `finish` steps. The first two samples of a
scenario are a warm-up and are dropped. A table cell is the median of the kept samples, with the
minimum and the maximum in parentheses, and the ratio to the fastest framework in the row.

**Disposal is checked with memory probes.** A disposal scenario takes three probes: on the empty
page, after `prepare`, and after the scenario ends. Each probe forces a garbage collection through
the Chrome DevTools Protocol, then reads the live DOM node count, the event listener count and the
used JS heap of the page. The "mounted" columns of the memory table are the cost of the mounted
scenario. The "left" columns are what stays behind after disposal. A clean disposal leaves 0 nodes
and 0 listeners. The heap column carries noise of some hundreds of kilobytes, from code caches and
allocations of the browser itself, so read it as a trend across runs, not as an absolute.

**A DOM check guards fairness.** After the measured steps of the first sample, the runner takes a
snapshot of the rows, the selected rows and the labels, through every shadow root. The report lists
any scenario where two frameworks ended with a different DOM. A number is only comparable when that
section reads "Every framework produced the same DOM after every scenario."

## Scenarios

The row count is 1000 and the nesting depth is 50, set in `perf/scenarios.js`.

| Scenario                                  | Group   | What it measures                                                                          |
| ----------------------------------------- | ------- | ----------------------------------------------------------------------------------------- |
| mount 1k rows                             | mount   | The first render of a list of 1000 row components.                                        |
| mount 10k rows                            | mount   | The same at ten times the size, to show how the cost scales.                              |
| mount 1k plain rows (imp only)            | mount   | The same list with a plain function per row, so the cost of a component boundary shows.   |
| mount 50 nested components                | mount   | A chain of 50 components, one inside the other, with a leaf that reads a root value.      |
| update 1 of 1k rows through the list      | update  | The parent replaces one item of the list. The framework must find and update one row.     |
| update 1 of 1k rows through its own state | update  | The row changes its own local state. The fine-grained path of each framework.             |
| update every 10th of 1k rows              | update  | The parent replaces 100 items. A partial update.                                          |
| update all 1k rows                        | update  | The parent replaces every item. The worst case for a keyed list.                          |
| swap two of 1k rows                       | update  | Two rows change places. A keyed move without a rebuild.                                   |
| select 1 row, 1k rows follow one state    | update  | One state that 1000 rows derive a class from. Fan-out of one notification.                |
| append 100 rows to 1k                     | update  | Growth of a keyed list.                                                                   |
| remove the middle row of 1k               | update  | Removal of one keyed item.                                                                |
| update a value read 50 components deep    | update  | A root state changes and a leaf 50 components down shows it. Propagation through a tree.  |
| 1000 committed updates of one text node   | update  | The fixed cost of one committed update, times 1000.                                       |
| 20 keystrokes in a rich text document     | update  | imp only. `richTextEditor` with 5 embedded images and 3000 words. Typing in a paragraph.  |
| 20 keystrokes beside an image             | update  | imp only. The same document. Typing in the paragraph that holds an image.                 |
| unmount 1k rows                           | dispose | The whole app leaves the page. Time, and what remains after garbage collection.           |
| clear 1k rows through the list            | dispose | The list state becomes empty while the app stays mounted.                                 |
| unmount 50 nested components              | dispose | Disposal of a deep chain.                                                                 |
| 20 mount and unmount cycles of 1k rows    | dispose | Repeated mount and unmount. A leak shows as nodes, listeners or heap that grow per cycle. |

## How each framework implements the protocol

- **imp.** A row is a component with its own shadow root. It holds one local state for the label,
  reads the selection state of the app through `useState`, and binds its class to a `computed`. The
  list is a keyed `each` on one array state. The parent-side updates replace items in a new array,
  so a keyed `each` renders the changed rows again and moves the rest. The deep chain uses
  `initState` at the root and `useState` in the leaf.
- **React.** A row is a `memo` component with one `useState` for the label. The list is one
  `useState` array in the app component, rendered with `map` and a `key`. Every update runs inside
  `flushSync`. The deep chain uses a context, and the middle components are `memo`, so only the leaf
  renders on an update.
- **Vue.** A row is a component with one `ref` for the label. The list is a `shallowRef` array, and
  every parent-side update assigns a new array, the same as the other two. The rows are rendered
  with `h` and a `key`. The deep chain uses `provide` and `inject` with a `ref`. Vue can also mutate
  an item in place, which the "through its own state" scenario approximates.

Every app registers the label state of every row in a map keyed by the row id, so the local update
scenario can reach one row from outside. Every app deletes the entry when the row unmounts.

## Reading the results

- The three groups answer three questions. Mount: what does a component cost to create? Update: what
  does a change cost, from one node to every node? Dispose: does the framework let go of everything?
- A large range next to a median means the machine was noisy during the run. Run the suite on an
  idle machine, and raise `--samples` when a number matters.
- Compare within a run. Numbers from two machines, or two Chrome versions, do not compare.
- The 144 listeners that React leaves after an unmount are the event delegation listeners on the
  root container. React installs them once per root and does not remove them on `unmount`. They do
  not grow with the cycles, so they are a fixed cost, not a leak.

## What the first run found, and what changed

The first run of the suite measured imp before any tuning. It found three problems. Two are fixed in
the library, and the numbers below are the medians of the first run on the reference machine against
the run after the fix, in milliseconds. The table of the reference run holds the full picture.

| Scenario                   | Before | After | Cause and fix                                                                                       |
| -------------------------- | -----: | ----: | --------------------------------------------------------------------------------------------------- |
| swap two of 1k rows        |    406 |     6 | The keyed `each` moved every node after the first change. It now moves only the nodes out of order. |
| mount 50 nested components |  fails |     3 | Each nested mount re-entered the browser and Chrome ran out of stack. imp now mounts from one loop. |

**The swap.** The keyed `each` placed the items in order and moved every node whose previous sibling
was not the expected one. After a swap of the second and the second-last item, that was every node
in between. Each move of a component host also made the host resolve its states again, and the
browser laid out every moved node again. The layout was the larger half: 80 to 150 ms of the total,
for a script part of 5 ms. The list now computes the longest rising sequence of previous positions,
keeps those items in place, and moves the rest. A swap moves two nodes.

**The nesting limit.** A parent mounted its children inside its own `connectedCallback`, through a
DOM insertion that the browser turned into the next `connectedCallback`. Each level re-entered the
browser, and each re-entry took a slice of the stack. Chrome failed with a `RangeError` at about 40
components nested one directly inside the other. A static layout rarely nests that deep, but a
recursive component does: a tree, a folder view, a thread of comments, a menu with submenus. And
every standard component in the chain counts. imp now mounts a tree from one loop. The first host
that connects mounts, every host that connects during that mount joins a list, and the loop mounts
them next, depth first, in document order. The order of the mounts did not change. A chain of 5000
components mounts, updates and unmounts. The suite runs the deep scenarios at 50 levels.

**The rich text editor.** `richTextEditor` commits its value as markdown on every keystroke. An
embedded image is a data URL of some hundred kilobytes, so a document with images is megabytes long.
Two causes made a keystroke slow. The check of an image address gave the whole data URL to the URL
parser, twice per image. And the editor wrote every block of the document again. The check now
accepts a `data:image/` prefix at once, and the editor keeps the markdown of each unchanged block.
The medians of 20 samples, in milliseconds for 20 keystrokes:

| Scenario                              | Before | Address check | Kept blocks |
| ------------------------------------- | -----: | ------------: | ----------: |
| 20 keystrokes in a rich text document |    266 |            74 |          41 |
| 20 keystrokes beside an image         |    287 |            71 |          44 |

A keystroke now costs about 2 ms, and most of it is the edit of the browser itself. The value is
still exact after each keystroke, because the commit stays synchronous.

The imp app is served under `/imp/`, so its `env.json` sets `IMP_BASEPATH` to `/imp`. The build
writes root-absolute script addresses, and without the base path the page does not load.

**What stays.** A row component costs more to mount than a row in React or Vue, because every
component is a custom element with a shadow root, and the browser charges for both. On the reference
machine, 1000 empty custom elements with a shadow root and three child nodes cost 10 to 40 ms to
create and insert, before imp runs a line. imp adds a mount scope, a `self`, an `AbortController`, a
state lookup event per `useState`, the state handles and the bindings. The profile of
`mount 1k rows` shows the event dispatch of the state lookups as the largest single item of imp's
own script time, at about 15 microseconds per lookup. That mechanism is a design decision, and it
stays. The update of all 1k rows pays the same cost, because a keyed `each` mounts a changed row
again as a whole. The fast path for a row that changes often is a component with its own state,
which the "through its own state" scenario measures. Unmount runs the cleanup of 1000 hosts in 1000
microtasks, and the emptying of 1000 shadow roots is most of its time.

## Reference run

The tables below are the output of `cargo xtask perf` on the reference machine, a Linux
x86_64 cloud container with a noisy CPU. Read the ratios, not the absolute numbers.

Date: 2026-09-23T12:17:59.533Z. Browser: Chrome/150.0.7871.46. Platform: linux x86_64. Versions: imp
0.1.0, react 19.3.0, vue 3.5.43. Samples per scenario: 10.

A timing cell is the median in milliseconds, the range in parentheses, and the ratio to the fastest
framework in the row.

### Mount

| scenario                                             | imp                             | react                         | vue                           |
| ---------------------------------------------------- | ------------------------------- | ----------------------------- | ----------------------------- |
| mount 1k rows                                        | 181.65 (120.10..322.40) 2.1x    | 85.10 (62.40..368.50) 1.0x    | 96.10 (61.40..638.60) 1.1x    |
| mount 10k rows                                       | 1696.80 (1314.90..3166.50) 2.7x | 629.40 (456.10..1898.80) 1.0x | 676.10 (542.40..1069.40) 1.1x |
| mount 1k plain rows (imp only, no component per row) | 78.25 (65.30..249.50) 1.0x      | -                             | -                             |
| mount 50 nested components                           | 3.95 (3.10..14.80) 1.2x         | 3.30 (2.20..11.60) 1.0x       | 5.30 (3.20..20.00) 1.6x       |

### State updates

| scenario                                  | imp                          | react                       | vue                        |
| ----------------------------------------- | ---------------------------- | --------------------------- | -------------------------- |
| update 1 of 1k rows through the list      | 11.30 (6.30..34.00) 2.1x     | 5.55 (4.40..33.30) 1.0x     | 5.50 (4.00..74.30) 1.0x    |
| update 1 of 1k rows through its own state | 1.55 (1.30..5.10) 1.0x       | 5.30 (4.20..24.40) 3.4x     | 2.05 (1.40..16.00) 1.3x    |
| update every 10th of 1k rows              | 26.30 (22.30..97.60) 2.8x    | 9.40 (8.20..11.70) 1.0x     | 15.00 (8.00..85.20) 1.6x   |
| update all 1k rows                        | 173.45 (146.50..223.90) 5.1x | 33.75 (32.00..96.30) 1.0x   | 60.00 (43.20..161.50) 1.8x |
| swap two of 1k rows                       | 7.60 (5.50..13.30) 1.8x      | 58.35 (45.10..127.20) 14.1x | 4.15 (3.80..7.90) 1.0x     |
| select 1 row, 1k rows follow one state    | 5.95 (3.90..40.10) 1.6x      | 4.20 (3.20..18.60) 1.1x     | 3.70 (2.30..18.00) 1.0x    |
| append 100 rows to 1k                     | 21.95 (16.10..143.60) 1.5x   | 14.40 (9.80..166.70) 1.0x   | 21.85 (10.10..164.20) 1.5x |
| remove the middle row of 1k               | 10.25 (6.60..15.10) 1.7x     | 7.45 (4.70..41.50) 1.2x     | 6.15 (4.00..52.20) 1.0x    |
| update a value read 50 components deep    | 0.40 (0.30..0.50) 1.0x       | 1.25 (1.10..6.30) 3.1x      | 0.80 (0.70..4.00) 2.0x     |
| 1000 committed updates of one text node   | 3.55 (2.40..17.30) 1.0x      | 24.50 (17.60..40.60) 6.9x   | 14.40 (8.70..99.90) 4.1x   |

### Disposal

| scenario                               | imp                             | react                         | vue                           |
| -------------------------------------- | ------------------------------- | ----------------------------- | ----------------------------- |
| unmount 1k rows                        | 45.50 (35.00..71.70) 2.4x       | 19.30 (10.50..149.90) 1.0x    | 23.15 (14.10..159.40) 1.2x    |
| clear 1k rows through the list         | 44.50 (35.80..68.30) 2.2x       | 20.00 (15.70..47.20) 1.0x     | 40.35 (16.50..160.70) 2.0x    |
| unmount 50 nested components           | 2.40 (1.90..8.00) 1.2x          | 1.95 (1.80..6.90) 1.0x        | 2.60 (1.50..10.50) 1.3x       |
| 20 mount and unmount cycles of 1k rows | 3807.40 (2734.20..5019.40) 4.3x | 915.40 (651.10..2666.50) 1.0x | 884.80 (654.80..1174.40) 1.0x |

### Memory after disposal

Each value is the median across samples. The "mounted" columns are the cost of the mounted scenario
relative to the empty page, after a forced garbage collection. The "left" columns are what stays
after the scenario ends and the garbage collector runs. A clean disposal leaves 0 nodes and 0
listeners. Heap deltas carry noise of a few tens of kilobytes.

| scenario                               | framework | mounted nodes | mounted listeners | mounted heap | left nodes | left listeners | left heap |
| -------------------------------------- | --------- | ------------- | ----------------- | ------------ | ---------- | -------------- | --------- |
| unmount 1k rows                        | imp       | 8005          | 2002              | 5253 kB      | 0          | 0              | 363 kB    |
| unmount 1k rows                        | react     | 6001          | 1144              | 1514 kB      | 0          | 144            | 364 kB    |
| unmount 1k rows                        | vue       | 6001          | 1000              | 2902 kB      | 0          | 0              | 410 kB    |
| clear 1k rows through the list         | imp       | 8005          | 2002              | 5251 kB      | 0          | 0              | 326 kB    |
| clear 1k rows through the list         | react     | 6001          | 1144              | 1516 kB      | 0          | 144            | 349 kB    |
| clear 1k rows through the list         | vue       | 6001          | 1000              | 2902 kB      | 0          | 0              | 373 kB    |
| unmount 50 nested components           | imp       | 159           | 1                 | 100 kB       | 0          | 0              | 85 kB     |
| unmount 50 nested components           | react     | 53            | 144               | 224 kB       | 0          | 144            | 229 kB    |
| unmount 50 nested components           | vue       | 53            | 0                 | 248 kB       | 0          | 0              | 188 kB    |
| 20 mount and unmount cycles of 1k rows | imp       | 0             | 0                 | 3 kB         | 0          | 0              | 508 kB    |
| 20 mount and unmount cycles of 1k rows | react     | 0             | 0                 | 1 kB         | 0          | 144            | 576 kB    |
| 20 mount and unmount cycles of 1k rows | vue       | 0             | 0                 | 3 kB         | 0          | 0              | 875 kB    |

### DOM check

Every framework produced the same DOM after every scenario.

## How to extend the suite

- **A new scenario** is one entry in `perf/scenarios.js`, built from the existing operations. Set
  `memory: true` to add the memory probes, `repeat` to run the measured steps in a loop, and
  `samples` to change the sample count of that scenario. Set `frameworks` to a list of names for a
  scenario that only some apps implement.
- **A new operation** needs an implementation in every app, with the same name and the same effect
  on the DOM. The DOM check catches an implementation that drifts.
- **A new framework** is one folder under `perf/apps/` with an `index.html` and an `app.js` that
  sets `window.__bench`, plus its name in the `FRAMEWORKS` list of `xtask/src/perf.rs`. An npm
  framework imports its package as an exact `npm:` specifier, which also gives its version to the
  report.
