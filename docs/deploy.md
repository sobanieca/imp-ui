# Deploying an app

`imp build` writes a folder of static files. Any host that serves files can serve it. This page
tells you what the host must do with those files: the deep links, the cache headers, the security
header, the files of the previous build, the update of an installed app, and where the errors of a
live app go.

## What the build gives you

```
dist/
  index.html                  <- the page, with its plain name
  chunks/main-4ZDAFRFX.js     <- every script, with a content hash in its name
  chunks/chunk-QX3J7M2A.js
  chunks/logo-7CWPN3KD.svg    <- every file that a script imports, with a hash too
  LICENSES.txt                <- the licence notices of the code in your bundle
  app-analytics.json          <- the pages, zones and outcomes of your app, for an analytics store
  styles.css                  <- a copy of each file in public/
  manifest.webmanifest        <- with --pwa: the manifest, the icons and sw.js
  icons/icon-192.png
  sw.js
```

Upload the whole folder. `LICENSES.txt` is part of the app. The licences of the code in your bundle
require it, so do not leave it out.

## Deep links

A visit to `/todos/42`, or a refresh of it, asks your host for that path. The host must answer with
`index.html`, so the router of your app can take over. Every host has a setting for this. See
[Deployment: a deep link and a refresh](routing.md#deployment-a-deep-link-and-a-refresh) for the
setting of each host.

**The fallback must not cover `/chunks/`.** A request for a file under `/chunks/` that does not
exist must get a `404`, never `index.html`. A browser can ask for a new chunk before the upload of
that chunk is complete. When the host answers with `index.html` and the `immutable` header, the
browser keeps that page under the name of the chunk for a year. The app then fails for that user.
With a `404`, the browser asks again on the next load, and gets the file.

## Cache headers

Two rules cover every file of the build:

| Files                       | Header                                               |
| --------------------------- | ---------------------------------------------------- |
| everything under `/chunks/` | `Cache-Control: public, max-age=31536000, immutable` |
| every other file            | `Cache-Control: no-cache`                            |

Every file under `chunks/` has a content hash in its name, and only imp writes to that folder. A
`public/chunks/` folder stops the build. A new build writes new names, so a browser can keep such a
file for a year and never ask again. Send `immutable` only with a file that exists. Never send it
with a `404` or with a fallback page. `no-cache` does not stop the cache. It makes the browser ask
the host whether the file changed, on every load. That costs one small request, and a file that did
not change is not sent again.

The page itself must use `no-cache`. It is the one file that names the scripts of the current build.
A browser that keeps an old `index.html` loads the old build. The same holds for `sw.js`, the
manifest, the icons and the files of `public/`, because their names do not change between builds.

## Content Security Policy

A built app runs under a strict Content Security Policy. Send this header with your page:

```
Content-Security-Policy: script-src 'self'; style-src 'self'
```

The policy blocks every script and every style that does not come from your own origin. imp builds
the app for it, with no hash and no nonce to maintain. `imp build` warns about inline code in your
`index.html` that the policy blocks, with the line of each case. Add the origins of anything else
that your app loads, such as the script of an analytics provider. See
[Content Security Policy](cli.md#content-security-policy) for what the policy blocks in your own
code.

## A deploy and the open tabs

A tab runs the build that it loaded, until it loads the page again. A part of the app that loads on
demand comes from `chunks/` of that build. Examples are an area of the router and the translations
of a language that the user selects later. So a tab that is open during a deploy still asks for the
files of the previous build.

**Keep the files of the previous build in `chunks/` when you deploy.** Upload the new files next to
the old ones. Do not empty the folder first. The names never collide, because each name has a
content hash. Remove the files of an old build only when no tab can still run it, for example after
a week.

When a file is gone anyway, imp loads the page again one time:

1. The import of the chunk fails.
2. imp asks the host for the current page, and reads which build it names.
3. When the page names a newer build, imp loads the current URL again. The tab then runs the new
   build, and the user stays on the same screen.
4. When the host cannot be reached, or the page names the same build, imp does not load the page
   again. The error of the router shows, as for any other failed load.

A tab loads the page again at most once for each build. So a broken deploy cannot start a loop of
reloads. A reload loses the state of the page that the app does not store, such as text in a field.
Keep the previous build to prevent this. An app that you build with `--pwa` also keeps the previous
build in the cache of its service worker, see
[The update of an installed app](#the-update-of-an-installed-app).

## An example for nginx

This server block applies all of the rules above:

```nginx
server {
  root /srv/my-app/dist;

  location /chunks/ {
    add_header Cache-Control "public, max-age=31536000, immutable";
    try_files $uri =404;
  }

  location / {
    add_header Cache-Control "no-cache";
    add_header Content-Security-Policy "script-src 'self'; style-src 'self'";
    try_files $uri /index.html;
  }
}
```

nginx does not merge an `add_header` of a `location` with the headers of the server. So each
`location` names all of its own headers. nginx sends an `add_header` only with a successful answer,
so a `404` under `/chunks/` gets no `immutable`. Other hosts have the same settings under other
names. Apply the same rules there.

Under a sub-path, such as `/my-app/`, prefix every path of the rules with it. See
[Deploying under a sub-path](cli.md#deploying-under-a-sub-path).

## The update of an installed app

An app that you build with `--pwa` updates itself. The new service worker takes control of an open
tab at once, and a tab that still runs the previous build keeps its lazy chunks. You write no code
for this, and the app shows no prompt. The host only has to serve `sw.js` with `no-cache`, which the
rules above already do. See [Progressive Web App](cli.md#progressive-web-app---imp-build---pwa).

## The errors of a live app

A built app has no source map, so a stack trace from production points into minified code. imp
counts each failure on its page instead. Register an analytics sink that forwards the `error`
records to your store, and you learn which page breaks and how often. The browser console and the
logs of your server hold the message. See [Errors only](analytics.md#errors-only).

## Checklist

- Upload the whole output folder, `LICENSES.txt` included.
- Keep the files of the previous build in `chunks/`.
- Serve `index.html` for an unknown path, but a `404` for a missing file under `/chunks/`.
- Send `immutable` for a file under `/chunks/`, and `no-cache` for every other file.
- Send the Content Security Policy with the page, and add the origins that your app loads from.
- Register a sink for the `error` records before the first real user arrives.
