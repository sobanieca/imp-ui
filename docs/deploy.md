# Deploying an app

`imp build` writes a folder of static files. Any host that serves files can serve it. This page
tells you what the host must do with those files: the deep links, the cache headers, the security
header, the update of an installed app, and where the errors of a live app go.

## What the build gives you

```
dist/
  index.html                  <- the page, with its plain name
  chunks/main-4ZDAFRFX.js     <- every script, with a content hash in its name
  chunks/chunk-QX3J7M2A.js
  chunks/logo-7CWPN3KD.svg    <- every file that a script imports, with a hash too
  LICENSES.txt                <- the licence notices of the code in your bundle
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

## Cache headers

Two rules cover every file of the build:

| Files                       | Header                                               |
| --------------------------- | ---------------------------------------------------- |
| everything under `/chunks/` | `Cache-Control: public, max-age=31536000, immutable` |
| every other file            | `Cache-Control: no-cache`                            |

Every file under `chunks/` has a content hash in its name, and only imp writes to that folder. A
`public/chunks/` folder stops the build. A new build writes new names, so a browser can keep such a
file for a year and never ask again. `no-cache` does not stop the cache. It makes the browser ask
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
the app for it, with no hash and no nonce to maintain. Add the origins of anything else that your
app loads, such as the script of an analytics provider. See
[Content Security Policy](cli.md#content-security-policy) for what the policy blocks in your own
code.

## An example for nginx

This server block applies all of the rules above:

```nginx
server {
  root /srv/my-app/dist;

  location /chunks/ {
    add_header Cache-Control "public, max-age=31536000, immutable";
  }

  location / {
    add_header Cache-Control "no-cache";
    add_header Content-Security-Policy "script-src 'self'; style-src 'self'";
    try_files $uri /index.html;
  }
}
```

nginx does not merge an `add_header` of a `location` with the headers of the server. So each
`location` names all of its own headers. Other hosts have the same settings under other names. Apply
the same rules there.

Under a sub-path, such as `/my-app/`, prefix every path of the rules with it. See
[Deploying under a sub-path](cli.md#deploying-under-a-sub-path).

## The update of an installed app

An app that you build with `--pwa` updates itself. The new service worker takes control of an open
tab at once, and a tab that still runs the previous build keeps its lazy chunks. You write no code
for this, and the app shows no prompt. The host only has to serve `sw.js` with `no-cache`, which the
rules above already do. See [Progressive Web App](cli.md#progressive-web-app---imp-build---pwa).

## The errors of a live app

A built app has no source map, so a stack trace from production points into minified code. imp
reports each failure with its message and its context instead: the page, the view and the source.
Register an analytics sink that forwards the `error` records to your store, and you learn what
breaks, where and how often. See [Errors only](analytics.md#errors-only).

## Checklist

- Upload the whole output folder, `LICENSES.txt` included.
- Serve `index.html` for an unknown path.
- Send `immutable` for `/chunks/`, and `no-cache` for every other file.
- Send the Content Security Policy with the page, and add the origins that your app loads from.
- Register a sink for the `error` records before the first real user arrives.
