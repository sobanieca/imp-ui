# start - the dev server, and the log file to grep

```
imp start [file.html] [--port 4507] [--env <name>] [--mock | --no-mock]
```

`imp start` serves the directory that holds the entry HTML file. The default entry is `index.html`
in the current directory. The entry answers at `/`. A missing file, or a directory in place of the
file, exits with an error. **Development is buildless.** imp serves a file exactly as you wrote it,
so the code that runs is the source that you typed.

imp resolves the port in this order: `--port`, then `devServerPort` in `imp.json`, then `4507`. See
[config](config.md).

## What imp injects into every served document

imp skips an item that the document already contains. You never reference the library by path.

- **The import map.** `imp` and its subpaths resolve to the served library under `/@imp/`. Every
  alias in `dependencies` resolves to its vendored bundle. See [imports](imports.md).
- **Console and error telemetry.** imp forwards `console.*`, an uncaught error and an unhandled
  rejection to the terminal as a `[browser:*]` line.
- **Network telemetry.** A service worker at root scope reports every request as
  `[net] METHOD url -> status ms`. This covers `fetch`, XHR, images, scripts and navigations. A
  `/@imp/` request passes through.
- **The PWA manifest and icons**, generated while the server runs, when `imp.json` has a `pwa`
  block. So the app is installable while you work. The **offline** service worker is build-only, see
  [build](build.md).

## What imp serves

Your **`public/` folder answers at the site root**. So `public/styles.css` is `/styles.css`, exactly
as in the built site. imp serves the rest of the project behind it, so a module source loads as
written. Keep the entry HTML at the project root. imp ignores a `public/index.html` and prints a
warning. See [build](build.md).

The same run can answer a request from a `*.mock.js` file instead of the network. `--mock` and
`--no-mock` override the `mocks` block in `imp.json` for one run. When the mocks are on, the server
prints `[INFO] mocks - N file(s) from mocks/ serving through the browser`. See [mocks](mocks.md).

## `.imp/dev.log` - how to read the browser from the terminal

imp writes everything that it prints to `.imp/dev.log` as well, one entry per line. The file holds
the browser console, the errors, the network lines and imp's own status lines. **This is the main
debugging surface for an agent.** Drive the app, then search the file. You do not have to watch a
terminal that you cannot see:

```
grep '\[browser:error\]' .imp/dev.log
grep '\[net\] POST' .imp/dev.log | tail -20
```

imp truncates the file at every `imp start`, so the file always holds the current session. The limit
is `maxLogEntries`, and the default is 4000 entries. imp removes the oldest entries above the limit.
`.imp/` is imp's working directory for the project. Put it in `.gitignore`.

## `.imp/reviews/` - what the person who looks at the page said

The same injected client puts a **review widget** on every served page. The person selects an
element and writes a comment. imp writes one text file per review to `.imp/reviews/`. `imp review`
lists them. Read that folder before you act on an unclear report. See [review](review.md).

## Rules an agent gets wrong

- **`imp start` runs for a long time.** Start it in the background, or in another terminal, and read
  `.imp/dev.log`. Do not wait for it to exit.
- **Live reload is included.** Never restart the server after you edit a file. A change under the
  served directory reloads the browser. imp ignores `.git/`, `node_modules/`, `dist/` and `.imp/`.
- **A declared dependency with no vendored bundle gives a warning only.** The warning points at
  `imp install`. Run that command, see [dependencies](dependencies.md). Do not edit `imp.json` by
  hand.
- **A deep link works in development with no configuration.** A navigation request to a path with no
  extension serves the entry HTML. A missing asset, such as a wrong `.js` path, still returns 404.
  In production the host must rewrite the URL, see [routing](routing.md).
- **`/@imp/*` is reserved.** It holds `/@imp/events` for the reload stream, `/@imp/log` for the
  telemetry sink, `/@imp/review` for the review sink, `/@imp/sw.js` for the service worker, and the
  library source. Do not serve an app file from there.
- **The review widget is for development only, and for the local machine only.** `imp start` and
  `imp preview` inject it. `imp build` never injects it. The server accepts a review only from the
  machine that runs it. Never write a review UI into the app.
- A request for a directory redirects to the URL with a trailing slash, and serves the `index.html`
  inside the directory. imp rejects a path outside the served directory.
