# Two-level testing - unit tests in a blank page, specs against the app, both in Chrome

## Context

imp needed first-class testing, and it could not break its constraints. A user never configures a
third-party framework, and the toolchain is part of the one binary, see `native-toolchain.md`. A
component touches the real DOM directly, see `real-dom-no-virtual-dom.md`, and the library relies on
the platform for focus, the top layer, popovers and dialogs, see `browser-support-baseline.md`. A
simulated DOM fires `toggle` and `close` at the wrong time, and has no top layer and no focus model.
A unit test against it passed where the real page failed. So both levels need a real browser. An e2e suite also had to run in
parallel across the machines of a CI system, because a browser run in sequence dominates the time of
CI.

## Decision

There is one command, `imp test`, and the name of a file chooses the level. A `*.test.js` file runs
in a blank page of a headless Chrome, with no app behind it. A `*.spec.js` file runs against a
served app, in a headless Chrome. Both import their API from `imp/test`, which is
`cli/js/test-library.js`. That API holds
`test`, `test.only` and `test.skip`, with a timeout per test. It holds `beforeAll`, `beforeEach`,
`afterEach` and `afterAll`. It holds a set of `expect` matchers. The file walker of imp feeds the
discovery.

- **One file per process and per browser is the primitive of isolation. `imp test` fans out across
  processes for a whole level.** A single `imp test <file>` runs exactly that one file in its own
  Chrome, and exits with its result. The bundler and the server stay in the imp process. So the
  globals, the timers and the module graph of a file, and for an e2e file its server and its
  browser, never leak into another file. That invocation of a worker is also the unit that imp
  schedules. To run a whole level needs an explicit flag for the level. imp then discovers every
  file of that kind, and **starts one `imp test <file>` subprocess per file**. It runs them through
  a pool with a limit, which `--jobs <n>` sets, and which defaults to the CPU count. imp summarizes a file that passes in one line. It reproduces the
  full output of a child process that failed, without a change. The aggregate exits `1` when a file
  failed. This is a **deliberate exception about a subprocess**, against the rule of
  `native-toolchain.md`. The CLI invokes its own executable again. It does not delegate to an
  external tool. The isolation of one file per process is exactly what makes a fan-out to a
  subprocess equivalent to a run of each file alone.
  - **A bare `imp test` refuses to guess.** With no flag for a level, and with more than one
    candidate file, imp prints the three ways to run. Those are `--unit`, `--e2e`, and a single
    file. imp then exits with a **non-zero** code, and runs nothing. That case covers a bare
    `imp test`, a directory, and several paths. So imp never runs a partial or unintended subset in
    silence, and a stray `imp test` in a CI step fails loudly, in place of passing green with
    nothing run. A path narrows the discovery, as in `imp test --e2e checkout/`. One resolved file,
    with no flag, is unambiguous, and it runs at once.
  - **`--list` stays the machine-readable surface, for a fan-out across machines.** It emits the
    selected files as a JSON array, narrowed by `--unit` or `--e2e`. So a CI matrix can put one file
    per job, on its own runner. imp cannot schedule that parallelism, because it spans machines.
    `--jobs` handles the case on one machine, and `--list` handles the case across machines.

  imp schedules the fan-out inside one machine itself, in place of leaving every caller to write
  `xargs -P`. The reason is local ergonomics. A developer, or an AI agent, that runs the whole suite
  gets parallel results, and detail for a failure only, from one command. The guarantees of
  isolation, and the exit code per file that CI depends on, do not change.

- **Mocking is two concepts, `spy` and `mockModule`, and imp keeps both small.** A `spy(fn?)` is a
  function that records its calls, in a plain `spy.calls` array. Its behaviour is the function that
  you passed to it. So there is no configurator in the style of `.mockReturnValue` or
  `.mockImplementation`. An assertion about a call reuses the existing `expect` matchers, with
  `toEqual` or `toContain` on `.calls`. It does not use a family of `toHaveBeenCalled*` matchers.
  The same verb wraps a method in place, as `spy(obj, method[, impl])`, and imp dispatches that on
  the types of the arguments, see `type-based-argument-dispatch.md`. There is no separate `spyOn`.
  The runner owns the lifecycle. It registers every spy in the registry of `Symbol.for`. After each
  test it clears every `.calls` array, and restores any method that somebody wrapped **during** a
  running test. A wrap at module level stays. So there is no surface to reset or to restore by hand.
- **A module mock is a rewrite of the resolution at bundle time, and not a registry at runtime.**
  imp compiles each test file into one bundle. An import across modules is inlined. So there
  is no module boundary at runtime to intercept, in the way that Vitest intercepts one. So
  `mockModule(specifier, factory)` happens where imp already owns the seam, which is the resolution.
  Before it bundles, imp scans the file statically for a `mockModule('...', ...)` call. It reads a
  string literal as a specifier, and nothing else. It resolves each specifier to a **canonical
  key**. A relative path becomes the absolute path of the real file, after imp resolves an extension
  or an index, and canonicalizes it with `realPath`. A bare specifier is a dependency alias from
  `imp.json`. imp reads the export names of the real module with the parser of its linter, and it
  executes nothing. A plugin for the resolution then redirects **every** import that resolves
  to that key, at any depth in the graph, to a generated virtual module. That module runs the
  factory once, and feeds it `{ spy, orig }`. It exports exactly the names of the real module, and
  fills any name that the factory omitted with a fresh `spy()`. `orig()` is a live `import` of the
  real file. So a partial mock, such as `{ ...orig(), one: spy() }`, keeps the rest real. To key by
  the resolved file, and not by the string of the specifier, is what makes `'../http.js'` and
  `'./http.js'` collapse to one mock. It is also what makes an npm or jsr dependency mockable by its
  alias. imp inlines the factory into the virtual module. So the factory runs before the module
  under test loads, which matches the order of evaluation in jest. So the factory cannot close over
  a local variable of the test file, and jest imposes the same constraint.
- **The model of execution is imp's own runner, in the page.** imp bundles each test file with its
  embedded bundler. That resolves `imp`, `imp/test`, a vendored dependency alias, and a relative
  import, with the same resolution as `imp build`. imp starts a small server on an ephemeral port
  and launches Chrome on its runner page. The runner page imports the bundle, runs the registry,
  and posts each result line back to the imp process, which prints it. The registration flows
  through a global registry, keyed by `Symbol.for`. So the bundled copy of `imp/test` and the
  runner share state, and they do not share a module identity. The runner sets
  `globalThis.__IMP_DEV__`, so the dev checks of the library run in a unit test as they do under
  `imp start`.
- **A fuzzy match is an asymmetric placeholder.** `expect.any`, `expect.anything`,
  `expect.stringContaining`, `expect.stringMatching`, `expect.arrayContaining`,
  `expect.objectContaining` and `expect.closeTo` return a marker object. imp tags each one with a
  `Symbol.for` key, so the marker survives the boundary of a realm. `deepEqual` stops on such a
  marker, and calls its `match(actual)`. They hook `deepEqual`. So they compose everywhere that
  structural equality runs, which is inside `toEqual`, inside `toContain`, and in an assertion over
  `spy.calls`. They are not a parallel family of matchers.
- **The results are readable text on stdout, and there is no report file.** The runner emits no
  machine-readable format for a report. There is no `--reporter`, and there is no JUnit or JSON
  output. Each `imp test <file>` prints a line per test, with a pass or a fail, and a summary of one
  line, to stdout. It exits `0` or `1`. A failing test prints its name, and the message of the
  assertion, inline on stdout. A run of a level, with `--unit` or `--e2e`, sits on top of that, and
  invents no format. It prints one `✓ <file>` line per passing file. For each failing file, it
  prints the stdout of the failing worker, without a change. It then prints an aggregate summary. So
  there is full detail only where a run went red. That is a deliberate simplification. The main
  consumer is an AI coding agent that drives imp turn by turn, and that reads plain logs on stdout.
  So a structured format for a report is complexity that this consumer never uses. A CI system that
  wants a pass or a fail reads the same stdout, and the same exit code. The one machine-readable
  surface that remains is `--list`. It emits the _selection_ of files before a run, as a JSON array,
  for a fan-out across a CI matrix. It describes what _would_ run, and not how a run went.
- **There is one matcher for equality.** `expect` exposes one `toEqual`, and not a pair of `toBe`
  and `toEqual`. It is structural for data. It compares a primitive with `Object.is`, and it
  compares an array, a plain object, a `Map`, a `Set`, a `Date` and a `RegExp` by value. It falls
  back to identity for everything else. That covers a DOM node, which imp matches through `nodeType`
  and `nodeName`, a class instance, and a function. That removes the most common trap in an
  assertion, and it fixes a real one. The old deep equality, which compared by key, reported two
  different DOM nodes with no keys as equal.
- **The set of matchers is deliberately small.** Seven matchers survive. Those are `toEqual`,
  `toContain`, `toMatch`, `toBeTruthy`, `toBeGreaterThan`, `toBeLessThan` and `toThrow`. imp cut
  everything that another form expresses. The sugar over a value folds into `toEqual`, or into
  optional chaining. That covers `toBeNull`, `toBeUndefined`, `toBeNaN`, `toBeDefined` and
  `toHaveProperty`. `toBeFalsy`, and a comparison that ends in `OrEqual`, are the `.not` of their
  opposite. `toBeInstanceOf`, `toBeCloseTo` and `toHaveLength` are redundant beside the asymmetric
  placeholders `expect.any` and `expect.closeTo`, or beside a plain comparison of `.length`.
  `toBeTruthy` stays, although it looks like sugar. Truthiness is a rule of coercion, and not
  equality to a finite set of values. So no form of `toEqual` expresses it correctly.
- **The unit environment is the real page.** `document`, `window`, the elements, the events and the
  top layer are the ones of Chrome. A Navigation API handler keeps the runner page in place when a
  test navigates, so a reload or a pushed URL does not unload the tests. The runner connects
  Puppeteer to its own page and turns on the focus emulation of the DevTools protocol. So focus
  behaves as in a focused window, also when many browsers run at the same time. `toEqual` compares
  by a structural tag, and not by the identity of a prototype.
- **The e2e environment gives each spec file a fresh instance of the app.** The internals of
  `imp start` serve the entry page on an ephemeral port, with the standard injection. The default
  page is `index.html`, and `test.entry` in `imp.json` overrides it. So the console of the browser,
  and the network telemetry, stream to the terminal during a run. The browser build of
  puppeteer-core runs in the runner page, see `vendored-browser-driver.md`, and drives a second page
  on the app. A test receives `{ page, browser, baseUrl }`, and the tests in a file share the page. So
  a spec reads as one session of one user. A failing test saves a screenshot under
  `.imp/screenshots/`. Nothing is shared between two spec files. So `imp test <file>.spec.js` is a
  self-contained job for CI. `imp test --e2e --list` emits the list of specs as JSON, for a matrix
  in GitHub Actions with one job per spec.
- **imp resolves the browser in this order.** First it uses `test.browser` in `imp.json`. Then it
  uses the `IMP_BROWSER` environment variable. Then it uses an installed Chrome or Chromium, which
  covers a GitHub Actions runner with no setup. Otherwise it uses a Chrome for Testing build. imp
  pins that build by version, and by a sha256 hash per platform, in `cli/src/browser.rs`. imp
  downloads it once, into the cache folder of imp at `~/.imp/browser/`, and never inside a project,
  see `vendored-dependencies.md`. imp extracts it with its own unzip.
- **A sealed CI needs no network for the browser.** `IMP_CACHE_DIR` moves the cache folder, so a CI
  can restore a cached folder that already holds the browser. `test.browser` and `IMP_BROWSER` point
  at a browser that the image of the CI already has. imp adds no download mirror. Either path is
  enough, and a mirror would be one more address to trust.
- **`imp test` has two approved exceptions about a subprocess**, against `native-toolchain.md`. The
  first is the browser, which is the system under test, and not a delegated tool. The second is the
  fan-out over a level, where imp invokes itself again, as one worker per file. Inside any single
  `imp test <file>` worker, the bundler and the server run in the imp process, and the runner and
  the assertions run in the page. The subprocesses are the browser under test, and copies of imp
  itself. They are never an external toolchain.

- **There is no watch mode.** The code of an imp app is written by an AI agent for the most part. An
  agent edits, finishes a portion of work, and then runs the tests once. Nobody observes a test
  result between two edits, so a watcher that reruns the suite on every save reports on a state of
  the code that is not finished, and nobody reads the report. `imp test` runs once and exits.
- **Chrome is the only test browser, and there is no coverage report.** Puppeteer drives Chrome over
  the DevTools protocol, and imp vendors nothing that drives Firefox or Safari. A spec proves one
  engine. The browser-support policy, see `browser-support-baseline.md`, holds for the library, and
  imp checks the other engines by hand. A coverage report would count the lines of a bundled test
  file, not of the source, so imp does not print one. The docs state both limits.

## Consequences

- A unit test runs fast, and offline, anywhere that the binary runs and a Chrome exists. It sees the
  real timing of the platform. A popover `toggle` event and a dialog `close` event arrive one task
  later, so a test awaits a task before it checks their effect. An event that a test dispatches is
  not trusted, so the light dismiss of a popover on `Escape` belongs to an e2e spec. A unit run
  starts one Chrome per file, which costs about a second per file of startup. The total e2e time in CI falls to the time of the slowest
  spec file. The deliberate cost is that each spec repeats its own setup state, such as a sign-in.
  That repetition is what makes a spec schedulable on its own.
- A bare `imp test` does not run the suite. It asks which level to run. To run a level is one
  command, which is `imp test --unit` or `imp test --e2e`, and it fans out across local processes. A
  pipeline can also feed `imp test --list` into a CI matrix, for a fan-out across machines. One file
  is still the unit of the isolation, and of the exit code per file. A run of a level is many such
  processes for one file, scheduled together. So no two files ever share the globals, the timers,
  the server or the browser of one process.
- The fan-out makes imp start copies of itself, through the path of its own executable. A run of a
  level costs one process and one browser per file. For an e2e run it also costs one server per file
  that runs at the same time. `--jobs` limits that. A CI system that needs a
  spread across machines still uses `--list`, and not a large local `--jobs`.
- imp bundles a test file before it runs it. So a failure reports per test, with the detail of the
  assertion, and with no stack trace to the original file and line. The granularity per file, and
  the name of the test, carry the location.
- imp resolves a mock per file, and that fits the model of one file per process. A `mockModule`
  applies to every test in its file, and it cannot leak across files. But a mock is fixed for the
  file, and it is not swappable per test. The behaviour of a spy is chosen when somebody creates it,
  and the runner clears `.calls` between two tests. So nobody resets a spy by hand. The scan is
  static. So somebody must call `mockModule` by that name, with a string literal as the specifier.
  When a file declares no mock, imp installs no hook in the resolver, and the bundling does not
  change.
- The browser build of puppeteer-core adds about 1 MB to the binary, see
  `vendored-browser-driver.md`. The pinned Chrome download is about 190 MB, once per user, per
  pinned version. A platform with no pinned build must configure `test.browser`.
- A pin by checksum means that a release of imp decides the version of the managed e2e browser, and
  an update of a browser on the machine does not. To move that version is a change to one file,
  which holds the version and the hashes.
