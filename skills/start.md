# start - the dev server, and the log file to grep

```
imp start [file.html] [--port 4507] [--env <name>] [--mock | --no-mock]
```

Serves the directory holding the entry HTML (default `index.html` in the current directory) with the
entry reachable at `/`. A missing file, or a directory, exits with an error. **Development is
buildless**: files are served exactly as written, so what runs is the source you typed.

Port resolution: `--port`, else `devServerPort` in `imp.json` - see [config](config.md) - else
`4507`.

## What imp injects into every served document

Skipped for a document that already contains it - you never reference the library by path.

- **The import map** - `imp` and its subpaths resolve to the served library (under `/@imp/`), and
  every alias in `dependencies` to its vendored bundle. See [imports](imports.md).
- **Console + error telemetry** - `console.*`, uncaught errors and unhandled rejections are
  forwarded to the terminal as `[browser:*]` lines.
- **Network telemetry** - a service worker at root scope reports every request (`fetch`, XHR,
  images, scripts, navigations) as `[net] METHOD url → status ms`. `/@imp/` requests pass through.
- **PWA manifest and icons**, generated on the fly, when `imp.json` has a `pwa` block - so the app
  is installable while you work. The **offline** service worker is build-only; see
  [build](build.md).

## What is served

Your **`public/` folder answers at the site root** - `public/styles.css` is `/styles.css`, exactly
as in the built site - and the rest of the project is served behind it, so module sources load as
written. Keep the entry HTML at the project root: a `public/index.html` is ignored with a warning.
See [build](build.md).

The same run can answer requests from `*.mock.js` files instead of the network - `--mock` /
`--no-mock` override the `mocks` block in `imp.json` for one run, and the server prints
`[INFO] mocks - N file(s) from mocks/ serving through the browser` when they are on. See
[mocks](mocks.md).

## `.imp/dev.log` - read the browser from the terminal

Everything printed also lands in `.imp/dev.log`, one entry per line: browser console, errors,
network, and imp's own status lines. **This is the primary debugging surface for an agent** - drive
the app, then grep the file instead of watching a terminal you cannot see:

```
grep '\[browser:error\]' .imp/dev.log
grep '\[net\] POST' .imp/dev.log | tail -20
```

The file is truncated at every `imp start`, so it always reflects the current session, and capped at
`maxLogEntries` (4000 by default) with older entries rolling off. `.imp/` is imp's per-project
working directory and belongs in `.gitignore`.

## `.imp/reviews/` - what the person looking at the page said

The same injected client puts a **review widget** on every served page: the person picks an element,
comments on it, and imp writes one text file per review to `.imp/reviews/`. `imp review` lists them.
Read that folder before acting on a vague report - see [review](review.md).

## Rules an agent gets wrong

- **`imp start` is long-running.** Start it in the background (or in another terminal) and read
  `.imp/dev.log`; do not wait on it to exit.
- **Live reload is included** - never restart the server after editing a file. Changes under the
  served directory reload the browser; `.git/`, `node_modules/`, `dist/` and `.imp/` are ignored.
- **A declared dependency with no vendored bundle only warns**, pointing at `imp install`. Run it
  from [dependencies](dependencies.md) rather than editing `imp.json` by hand.
- **Deep links work in development without configuration** - a navigation request to an
  extensionless path serves the entry HTML, while a genuinely missing asset (a bad `.js` path) still
  404s. Production needs a host-side rewrite; see [routing](routing.md).
- **`/@imp/*` is reserved** - `/@imp/events` (the reload stream), `/@imp/log` (the telemetry sink),
  `/@imp/review` (the review sink), `/@imp/sw.js` (the service worker) and the library source. Do
  not serve app files from there.
- **The review widget is dev-only and local-only** - `imp start` and `imp preview` inject it,
  `imp build` never does, and the server takes a review only from the machine it runs on. Never
  write review UI into the app.
- A request for a directory redirects to its trailing-slash URL and serves the `index.html` inside
  it; paths outside the served directory are rejected.
