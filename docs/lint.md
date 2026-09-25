# imp - Linting

```
imp lint [...paths]
imp lint --fix [...paths]
```

`imp lint` checks your code with a standard recommended rule set, and with the rules of imp. The
linter is part of the `imp` binary. There is nothing to install and nothing to configure, it works
offline, and one imp release lints the same way on every machine.

imp checks the paths that you give. A path can be a file or a directory. With no path, imp checks
the whole project. The command exits with an error when a path does not exist.

## What gets linted

`imp lint` checks a `.js`, `.mjs` and `.cjs` file. It also checks an `.html` file. imp lints an
inline `<script>` block like any other module, and reports a problem at its real line in the HTML
file. imp skips a script with a `src` attribute, because it lints the file that the attribute points
at on its own. imp also skips a script whose `type` is neither a JavaScript type nor `module`.

imp lints the code as modern browser code. It recognizes ES modules, current JavaScript syntax, and
the browser globals such as `document`, `fetch` and `localStorage`.

imp always skips the directories `.git`, `node_modules`, `dist` and `.imp`. It also skips the
vendored `dependencies/` folder, because the code there belongs to a package, not to you. To skip
more paths, use `exclude`. See _Configuration_ below.

## The rule set

The base is a standard recommended rule set for JavaScript. The rule names follow the ESLint naming,
which many people know. So a rule from that ecosystem has the same name here.

imp adds its own rules on top of the base set, and it always applies them as errors. A rule that
speaks of a hook, such as `setup`, `loading`, `error`, `onMount` or `onRemove`, looks only at the
definition object you pass to `component()` or to `router()`. A `setup` key in any other object, for
example a plugin for a bundler, is not a hook. These rules leave it alone.

### `imp/no-capital-component`

An imp component is a lowercase function. That is true of an element factory and of a `component()`
factory. There is no JSX. So a function name that starts with a capital letter comes from the habit
of another framework. The rule reports a function declaration, and a function-valued variable, whose
name starts with a capital letter:

```js
const Widget = () => div('widget')
```

```
error[imp/no-capital-component]: 'Widget' starts with a capital letter - imp components are lowercase functions (write 'widget')
 --> src/widget.js:1:7
```

### `imp/single-props-object`

An element takes at most one props object. Everything else that you pass is a child. A second object
literal is nearly always a mistake. At runtime imp merges the objects, and a later key wins with no
message. The rule reports a call that receives more than one object literal. That covers a call to a
built-in element factory, such as `div`, `span` or the generic `el`. It also covers a call to a
standard component, such as `button` or `emptyState`:

```js
div({ class: 'card' }, { onclick: open }, 'Open')
```

```
error[imp/single-props-object]: multiple props objects passed to 'div' - pass a single props object; later keys win
 --> src/app.js:1:26
```

Merge the properties into one object instead. For `el`, imp ignores the tag argument at the front.
It counts only the object literals after it.

### `imp/state-name-namespace`

A state name must carry a namespace. That is two or more dot-separated segments that are not empty,
such as `myapp.user`. See **[State](state.md)**. The rule checks every `initState` and `useState`
call whose name is a literal:

```js
const user = initState(self, 'user', { name: 'Ada' })
```

```
error[imp/state-name-namespace]: state name 'user' must include a namespace - use dot-separated segments like 'myapp.user'
 --> src/app.js:1:30
```

imp does not check a name that you build dynamically, such as a variable or a template with an
expression. The runtime does the same validation, and a bad name throws there.

### `imp/http-client-name-namespace`

An HTTP client name follows the same rule as a state name. It needs two or more dot-separated
segments that are not empty, such as `myapp.api`. See **[HTTP](http.md)**. The rule checks every
`createHttpClient`, `initHttpClient` and `useHttpClient` call whose name is a literal:

```js
const api = createHttpClient('api', { baseUrl: '/api' })
```

```
error[imp/http-client-name-namespace]: http client name 'api' must include a namespace - use dot-separated segments like 'myapp.api'
 --> src/app.js:1:30
```

### `imp/watch-with-self`

`watch(fn)` subscribes at once and registers no cleanup. So a `watch` in the `setup` of a component
that neither passes `self` nor keeps the stop function outlives the component. The subscriber keeps
running after the unmount, and it holds the DOM of the component alive. See **[State](state.md)**.
The rule reports a `.watch(fn)` call in `setup`, `error` or `onMount` whose result is discarded. It
checks a handle that the file created with `initState`, `useState`, `computed` or `useRoute`, and
also `lang`, `dir` and `theme`. imp tracks the handle, so an unrelated third-party `.watch()` method
stays out of the report:

```js
const themeWatcher = component('my-app-theme-watcher', {
  setup: () => {
    theme.watch((value) => document.body.setAttribute('data-theme', value))
  },
})
```

```
error[imp/watch-with-self]: 'theme.watch' runs in a component without self, so nothing stops it when the component unmounts and the subscriber keeps running - pass self first (theme.watch(self, fn)), or keep the stop that watch(fn) returns and call it in onRemove
 --> src/theme-watcher.js:3:5
```

Pass `self` first, as in `theme.watch(self, fn)`. imp then stops the subscription when the component
unmounts. A call whose result you keep, as in `self.stop = theme.watch(fn)`, is not reported,
because `onRemove` can call the stop.

### `imp/self-first-argument`

`initState`, `useState`, `initHttpClient` and `useHttpClient` take `self` as their first argument.
`self` is the first parameter of `setup`, `error`, `onMount` and `onRemove`. A call whose first
argument is a name, an options object or nothing else throws at mount. This rule catches it while
you write it. It reports a call whose first argument is a literal, a template, an object, an array,
a function, or is missing:

```js
const orders = component('my-app-orders', {
  setup: () => {
    const items = initState('myapp.items', [])
    return ul(items.each((item) => li(item.title)))
  },
})
```

```
error[imp/self-first-argument]: 'initState' takes self as its first argument, and here that argument is a literal - write initState(self, 'myapp.user', value); self is the first parameter of setup, error, onMount and onRemove
 --> src/orders.js:3:29
```

Take `self` from the hook, and pass it first, as in `initState(self, 'myapp.items', [])`. A helper
that resolves a state takes `self` as a parameter and passes it on. imp does not report a call whose
first argument is a variable, because that can be `self` under another name.

### `imp/no-self-in-loading`

`loading` runs before the component mounts, and it gets no `self`. See
**[Components](components.md)**. So a resolution there throws, and a binding there renders empty and
never updates. The rule reports, inside a `loading` function, a call to `initState`, `useState`,
`initHttpClient`, `useHttpClient` or `useRoute`. It also reports `text`, `view`, `each` and `watch`
on a state handle, and a state handle passed as an argument or as a prop value:

```js
const orders = component('my-app-orders', {
  loading: (self) => {
    const items = useState(self, 'myapp.items')
    return p(items.text())
  },
  setup: async (self) => renderOrders(await useHttpClient(self, 'myapp.api').get('/orders')),
})
```

```
error[imp/no-self-in-loading]: 'useState' runs in loading, which imp builds before the component mounts and without self, so the call throws - loading takes the factory arguments only; move the call into build
 --> src/orders.js:3:19

error[imp/no-self-in-loading]: 'items.text' binds state in loading, which imp builds before the component mounts, so the binding renders empty and never updates - pass a plain value here, and keep text, view, each, watch and a state-bound prop in build
 --> src/orders.js:4:14
```

Render a plain value in `loading`, such as a skeleton. Keep every state resolution and every binding
in `setup`.

### `imp/loading-with-async-setup`

A synchronous `setup` replaces the loading content before the paint, so nobody sees it. See
**[Components](components.md)**. imp warns about this at runtime. This rule reports it while you
write it. It reports a `loading` next to a `setup` that is not `async` and returns only DOM. Such
DOM is an element, a standard component, a bound `text`, `view` or `each`, a literal, or `null`:

```js
const badge = component('my-app-badge', {
  loading: () => span('...'),
  setup: () => span('ready'),
})
```

```
error[imp/loading-with-async-setup]: loading is set, but setup returns synchronously, so imp swaps the loading content out before paint and nobody sees it - make setup async, or return a promise from it, or remove loading
 --> src/badge.js:2:3
```

Make `setup` async, or return a promise from it, or remove `loading`. imp does not report a `setup`
that returns the result of a call it cannot classify, such as `load().then(render)`, because that
can be a promise.

### `imp/on-remove-through-self`

`onRemove` runs after the host has left the page. See **[Components](components.md)**. At that
point, `useState` and `useHttpClient` return only a handle that `setup` or `error` resolved through
`self`, and any other name throws. `initState`, `initHttpClient` and `watch(self, fn)` throw there
always. The rule reports these cases in `onRemove`. To know what `setup` resolved, imp reads the
literal names in `setup` and `error`. The rule reports no name mismatch when `setup` passes `self`
to a function that imp cannot see into, or resolves a name that is not a literal:

```js
const visitor = component('my-app-visitor', {
  setup: (self) => {
    useState(self, 'myapp.presence').set({ here: true })
    return p('here')
  },
  onRemove: (self) => {
    useState(self, 'myapp.visitors').set(null)
  },
})
```

```
error[imp/on-remove-through-self]: 'useState' in onRemove reaches state 'myapp.visitors', which setup never resolved - in onRemove, useState returns only a handle that setup resolved through self, and a new name throws because the host has left the page; resolve 'myapp.visitors' in setup, then reach it again here
 --> src/visitor.js:7:20
```

Resolve the name in `setup`, and reach it again in `onRemove` with the same name.

### `imp/no-self-at-module-scope`

A module lives across every mount. A `self`, a `self.host` or a handle resolved through `self` that
you store at module scope belongs to one mount. The next mount overwrites it, and an unmounted
component stays reachable, together with its DOM. See **[Components](components.md)**. Inside
`setup`, `error`, `onMount` or `onRemove`, the rule reports an assignment to a variable or object
that the module declares. It catches an assignment of `self`, of a property of `self`, or of an
`initState`, `useState`, `initHttpClient` or `useHttpClient` result:

```js
let current = null

const panel = component('my-app-panel', {
  setup: (self) => {
    current = self
    return p('panel')
  },
})
```

```
error[imp/no-self-at-module-scope]: 'current' at module scope stores what belongs to one mount - the module outlives every mount, so the next mount overwrites the value and an unmounted component stays reachable; store a per-mount resource on self instead (self.current = ...)
 --> src/panel.js:5:5
```

Store a per-mount resource on `self`. Every mount then gets its own, and imp drops it with the
mount.

### `imp/abort-check-after-await`

An async `setup` can wait while the component leaves the page. A resolution after that throws. See
**[Components](components.md)**. The rule reports, in an async `setup`, an `initState`, `useState`,
`initHttpClient` or `useHttpClient` call after an `await` that nothing guards. Three things count as
a guard. A read of `self.abortSignal.aborted` after the `await`. A `self.abortSignal` passed to the
awaited call, because that call then rejects on unmount. A resolution before the first `await`:

```js
const orders = component('my-app-orders', {
  setup: async (self) => {
    const api = useHttpClient(self, 'myapp.api')
    const data = await api.get('/orders')
    const orders = initState(self, 'myapp.orders', data)
    return ul(orders.each((order) => li(order.title)))
  },
})
```

```
error[imp/abort-check-after-await]: 'initState' runs after an await in an async setup with no check of self.abortSignal - the component can leave the page while setup waits, and a resolution after that throws; test self.abortSignal.aborted after the await and return, pass self.abortSignal to the awaited call, or resolve before the first await
 --> src/orders.js:5:20
```

Pass `{ signal: self.abortSignal }` to the call, or check `self.abortSignal.aborted` after the
`await` and return. Or initialize the state with an empty value before the `await`, and `set` the
data in after it.

### `imp/no-state-as-child`

A state handle is not DOM. An element factory or a standard component that gets one as a child logs
a warning and skips it. See **[State](state.md)**. The rule reports a handle that the file created
with `initState`, `useState`, `computed` or `useRoute`, and `lang`, `dir` and `theme`, passed as a
child:

```js
const counter = component('my-app-counter', {
  setup: (self) => {
    const count = initState(self, 'myapp.count', 0)
    return p('Count: ', count)
  },
})
```

```
error[imp/no-state-as-child]: 'count' is a state passed as a child of 'p', and imp skips it - render it with count.text(), count.view(fn) or count.each(fn), or bind a prop with { class: count }
 --> src/counter.js:4:25
```

Render the value with `count.text()`, or a `view` or an `each`, or bind a prop with the handle.

### `imp/no-get-in-binding`

A prop bound with the state itself follows the state. A prop set to `state.get()` copies the value
once, and never updates. See **[State](state.md)**. The rule reports a `.get()` on a state handle,
`lang`, `dir` or `theme` as a prop value of an element factory or a standard component:

```js
const form = component('my-app-form', {
  setup: (self) => {
    const busy = useState(self, 'myapp.busy')
    return button('Save', { disabled: busy.get() })
  },
})
```

```
error[imp/no-get-in-binding]: 'busy.get()' as the 'disabled' prop of 'button' copies the value once, and the prop never follows the state - pass the state itself: { disabled: busy }
 --> src/form.js:4:39
```

Pass the handle, as in `{ disabled: busy }`. Use `get()` in an event handler, where a snapshot is
what you want.

### `imp/no-root-query-in-setup`

While `setup` runs, the DOM that it returns is **not yet in the shadow root**. imp inserts the DOM
after `setup` returns, and after the promise resolves for an async `setup`. See
**[Components](components.md)**. A query on `self.host.shadowRoot` there finds the loading content,
not your own. This rule reports `querySelector`, `querySelectorAll` and `getElementById`, called
directly on `self.host.shadowRoot` in the body of `setup`. It does not report a later access inside
an event handler. It also does not report a query in `onMount` or `onRemove`, where the mounted DOM
is present:

```js
const card = component('my-app-card', {
  setup: (self) => {
    const box = div(span({ class: 'label' }, 'hi'))
    self.host.shadowRoot.querySelector('.label').textContent = 'ready'
    return box
  },
})
```

```
error[imp/no-root-query-in-setup]: the shadow root is queried in setup before the returned DOM is placed - setup's output fills the shadow root only after setup returns (after the awaited promise resolves, for an async setup), so this finds the loading content, not your own; keep a reference to the node you build and use it directly, or query self.host.shadowRoot in onMount, which imp runs on the next frame once your DOM is laid out on the page
 --> src/card.js:4:5
```

Keep a reference to the node that you build, and change it directly. You can also run the query in
`onMount`, which imp runs on the next frame after it places your DOM.
**[Components](components.md)** describes both fixes, under _self_ and _How to run code after imp
places the DOM_.

### `imp/component-name`

A component name becomes a real element tag. So it must be lowercase, and it must hold at least one
dash, such as `my-app-profile`. See **[Components](components.md)**. That is what makes the name a
valid custom element name, and the first segment is also the namespace of your app. The rule checks
every `component` call whose name is a literal:

```js
export const profile = component('profile', { setup: () => div('...') })
```

```
error[imp/component-name]: component name 'profile' must be lowercase with at least one dash - like 'my-app-profile'
 --> src/profile.js:1:34
```

imp also rejects a small set of names that the HTML standard reserves, such as `font-face` and
`missing-glyph`. The runtime validates a name that you build dynamically, and a bad name throws
there.

### `imp/import-source`

The library of imp is split by subject: `imp`, `imp/html`, `imp/state`, `imp/router`, `imp/theme`,
`imp/i18n`, `imp/log`, `imp/http` and `imp/icons`. See **[Imports](imports.md)**. Each name has
exactly one home. An import of a name from a sibling specifier fails at runtime, with a
missing-export error that does not say where to look. So the rule names the correct specifier
instead:

```js
import { component, div } from 'imp'
```

```
error[imp/import-source]: 'div' is not exported by 'imp' - it comes from 'imp/html': import { div } from 'imp/html'
 --> src/app.js:1:21
```

`imp lint --fix` repairs the import for you. It moves the name to an import of the correct
specifier, and merges it into an import that you already have. The line that the name came from
disappears when nothing is left on it.

imp checks its own specifiers only. So imp never reports a name that your app, or a dependency,
shares with an imp export.

### `imp/icons-by-name`

`imp/icons` holds the whole Lucide set. That is 1791 icons, and 434 kB of drawing data. An app pays
only for the icons that it names, because the build keeps each icon that it sees imported and drops
the rest. See **[Standard components](std-components.md)**. Anything that takes the module as a
whole defeats that. There are three such forms: a namespace import, an `export *` re-export and a
dynamic `import()`. The rule reports all three:

```js
import * as icons from 'imp/icons'

export * from 'imp/icons'

const set = await import('imp/icons')
```

```
error[imp/icons-by-name]: 'import * as icons' reaches for the whole 'imp/icons' set (1791 icons) - the build drops only the icons an app never names, so import each one you draw: import { luHouse } from 'imp/icons'
 --> src/icons.js:1:8
```

Import each icon by name, as in `import { luHouse, luStar } from 'imp/icons'`. When a module of your
own collects the icons, re-export them by name in the same way.

### `imp/exact-dependency-versions`

imp vendors a dependency. You declare it under `dependencies` in `imp.json`, and `imp install`
bundles it into the `dependencies/` folder of your project. See
**[Managing dependencies](dependencies.md)**. This rule enforces that model in all three places
where a dependency can appear:

- **A pin in `imp.json` must be exact.** Every `dependencies` entry must be an `npm:` or `jsr:`
  specifier with an exact version, such as `npm:mitt@3.0.1`. Never write `npm:mitt@3`,
  `npm:mitt@^3.0.1` or a bare `npm:mitt`. There is no lock file. The exact pin and the committed
  bundle are what make the resolution reproducible.

  ```
  error[imp/exact-dependency-versions]: dependency 'dayjs': 'npm:dayjs@1' must pin an exact version ('1' is not an exact version) - the vendored bundle in dependencies/ is built from this pin (e.g. 'npm:dayjs@1.0.0'); run 'imp install' to re-resolve and re-pin it
   --> imp.json:1:1
  ```

- **Write no inline `npm:` or `jsr:` specifier in code.** You install a dependency. You do not
  import it by URL:

  ```js
  import mitt from 'npm:mitt@3.0.1'
  ```

  ```
  error[imp/exact-dependency-versions]: 'npm:mitt@3.0.1' is an inline dependency specifier - dependencies are vendored: run 'imp install mitt@3.0.1' and import 'mitt' instead
   --> src/app.js:1:18
  ```

- **A bare import must be declared.** A bare specifier must match a declared dependency alias. A
  bare specifier is anything that is not relative, not absolute, not a URL, and not part of imp
  itself, which is `imp` and its subpaths:

  ```js
  import confetti from 'canvas-confetti'
  ```

  ```
  error[imp/exact-dependency-versions]: 'canvas-confetti' is not a declared dependency - run 'imp install canvas-confetti' to vendor it and add it to 'dependencies' in imp.json
   --> src/app.js:1:22
  ```

  imp reports an `imp/...` specifier that is not part of the library for what it is, and lists the
  specifiers that exist:

  ```
  error[imp/exact-dependency-versions]: 'imp/std/charts' is not part of the imp library - import 'imp', 'imp/html', 'imp/state', 'imp/router', 'imp/theme', 'imp/i18n', 'imp/log', 'imp/http', 'imp/icons', 'imp/std', 'imp/std/layout', 'imp/std/display', 'imp/std/inputs', 'imp/std/navigation', 'imp/std/shell', 'imp/std/feedback', 'imp/std/data', 'imp/test', 'imp/preview'
   --> src/app.js:2:23
  ```

The rule checks a static import, a re-export, and a dynamic `import()` call with a literal
specifier.

## Dead code across the project

Every rule above judges one file on its own. Three more checks judge the project as a whole. imp
follows every import from your starting points. It reports the code that nothing reaches, and it
reports the one import shape that it cannot follow.

imp finds the starting points for you:

- every `<script>` in an HTML page. This includes the file that a `src` attribute points at, module
  or classic, and the imports of an inline module block;
- every `*.test.js` and `*.spec.js` test, every `*.preview.js` preview, and every `*.mock.js` mock;
- every module that `imp.json` gives to `imp preview`: the `preview.themes`, `preview.translations`
  and `preview.groups` files;
- every script under `public/`. This ships without a change, and anything can load it;
- anything you list in `publicExports`, described below.

When a project has none of these, there is nothing to start from, and imp skips the project checks.
That is a project with no page, no test and nothing declared public.

imp follows an import only. A module that loads in another way is invisible to the walk. Examples
are `new Worker('./worker.js')`, `new URL('./chunk.js', import.meta.url)`, and a path that you build
at runtime and fetch. imp reports such a module as unreachable until you list it under
`publicExports`.

### `imp/unreachable-module`

This rule reports a module that no chain of imports reaches from a starting point. Nothing loads it.
So it ships in no bundle, and it runs nowhere:

```
error[imp/unreachable-module]: nothing imports src/orphan.js - no entry page, test, preview setting or public export reaches it; delete it, or add it to "publicExports" in imp.json if it is used from outside the project
 --> src/orphan.js:1:1
```

### `imp/unused-export`

This rule reports a name that a reachable module exports, and that no other module imports. The code
around the export can run. This export does not:

```js
export const greeting = 'hello'

export const unusedHelper = (text) => text.trim()
```

```
error[imp/unused-export]: 'unusedHelper' is exported by src/lib.js but nothing imports it - delete it, or add it to "publicExports" in imp.json if it is used from outside the project
 --> src/lib.js:3:14
```

imp never reports the exports of a starting point, because nothing must import them. Only an import
that imp can reach counts. A module that nothing loads can import as much as it wants. Its imports
keep no export of another module alive. So one dead file cannot hide a second dead file.

### `imp/computed-import`

This rule reports an `import()` whose specifier imp cannot read. That is a variable, a call, or a
template with no folder in front of the placeholder. The call could load anything, and imp does not
guess. imp reports the call, and the two checks above continue as if the call loaded nothing:

```js
export const load = (name) => import(name)
```

```
error[imp/computed-import]: import() takes a computed specifier, so imp cannot tell which module it loads - name the folder in a template like import(`./pages/${name}.js`), or list the modules it loads in "publicExports" in imp.json
 --> src/app.js:3:31
```

The message names the fix. Put the folder into the template, so imp can follow it. Or list what the
call loads under `publicExports`. In both cases imp accounts for every module that the call can
reach, and it reports nothing that the call loads as dead.

All three checks always read the whole project, also when you pass paths. One file cannot tell you
what the rest of the project imports. imp still follows a path under `exclude`, so excluded code
still counts as an importer of your code. imp only never reports an excluded path.

### Declaring exports the project itself does not use

Code that something outside the project uses has no importer for imp to find. Examples are a module
that another repository imports, and a page that loads by a path that imp cannot see. List such code
under `publicExports`, and imp counts it as used:

```json
{
  "lint": {
    "publicExports": ["src/sdk.js", "src/plugin.js#register"]
  }
}
```

A bare path, which is a file or a folder, makes the whole file public. imp never reports it as
unreachable, and it reports none of its exports. Add `#name` to make one export public. imp then
checks every other export in the file as usual.

### What `import()` does to the checks

imp follows a dynamic `import()` when it can read the path:

- imp follows **a literal**, such as `import('./admin/area.js')`, like a static import. That is the
  shape that `area()` and a translation loader already use. The names that you take off the loaded
  module are usually computed. So every export of that module counts as used.
- **A template with a literal folder**, such as ``import(`./locales/${code}.js`)``, could load any
  module in `./locales/`. So the whole folder counts as loaded and used.
- imp does not follow **a computed specifier**, such as `import(path)`. That is the
  `imp/computed-import` error above.

imp follows `export * from './x.js'` name by name. An import of `format` from a barrel that
re-exports `./format.js` counts only `format` as used there. imp still reports an export that
nothing takes from the barrel. A `publicExports` entry follows `export *` the same way. A bare path
on a barrel makes every name public that the barrel takes from a star target. A `#name` entry makes
that one name public wherever the barrel finds it.

Only an import that imp can reach counts. A module that nothing loads can import as much as it
wants. Its imports keep no export of another module alive. So one dead file cannot hide a second
dead file.

The per-file rules report a module that imp cannot parse, as usual. The two project checks stop for
that run, because a file that does not parse could import anything. imp prints a `note:` line that
says which file it was. Fix the syntax error, and the checks come back.

## Configuration

More lint configuration lives under `lint` in `imp.json`. imp applies it on top of the base set:

```json
{
  "lint": {
    "rules": { "no-unused-vars": "off", "eqeqeq": "warn" },
    "exclude": ["legacy/"]
  }
}
```

- **`rules`** sets the severity of each rule, which is `"off"`, `"warn"` or `"error"`. imp reports a
  warning, and a warning does not fail the command. An error makes the command exit with a non-zero
  code.
- **`exclude`** lists the project-relative paths to skip.
- **`publicExports`** lists the paths whose exports something outside the project uses. Each path
  can name a single export with `#`, as described above.

imp always applies its own rules as errors, and you cannot reconfigure them. For a deliberate
exception in one place, use an ignore comment, described below.

An invalid `lint` block, such as an unknown rule or a bad severity, fails the command. The message
explains what is wrong:

```
error: invalid lint configuration in imp.json - Key "rules": Key "eqeqeq": Expected severity of "off", 0, "warn", 1, "error", or 2.
```

## Suppressing findings in code

To suppress a finding, put an ignore comment on the line above. A rule list is optional, and you
separate the names with a comma. With no list, imp ignores everything on that line:

```js
// imp-lint-ignore no-capital-component
const Widget = () => div('widget')
```

To stop the linting of a whole file, put the file-level directive anywhere in the file. You can also
list the rules to stop:

```js
// imp-lint-ignore-file
```

You can write the name of an imp rule bare, as `no-capital-component`, or in full, as
`imp/no-capital-component`. Both forms work.

## Applying fixes

Many rules know how to repair the code that they report. Run `imp lint --fix` to apply every
available autofix. imp rewrites the affected files in place:

```
imp lint --fix
```

imp changes only a problem that has a known fix. It leaves anything that needs a decision from a
person, and it still reports it. Examples are a violation of an imp rule and an unused variable. In
an `.html` file, imp fixes an inline `<script>` block like a standalone module. imp never fixes a
problem that you silenced with an `imp-lint-ignore` comment, and it keeps the ignore comments
exactly as you wrote them.

After a fix run, the summary counts the files that changed, and the problems that remain:

```
Fixed 1 file
Found 1 problem
Checked 8 files
```

The exit code follows the same rule as a plain run. It is `1` when an error remains after the fix,
and `0` otherwise. Commit or stash your work before a `--fix` run, so the rewrites are easy to
review.

## Output and exit code

imp prints each finding with its severity, its rule name and its location:

```
warning[eqeqeq]: Expected '===' and instead saw '=='.
 --> src/app.js:12:11

Found 1 problem
Checked 8 files
```

The command exits `0` when there is no finding, or only a warning. It exits `1` when there is at
least one error.
