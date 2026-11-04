# Todo - an imp example

This app is a todo list that uses most features of imp. It runs without a backend. The `mocks/`
folder answers every API call through the dev server.

## Run it

Run these commands in this folder:

```
imp start              serve the app on http://localhost:4400/
imp test --unit        run the unit tests
imp test --e2e         run the browser specs against the mocks
imp preview            show the todoProgress component in isolation
imp map                print the application map
imp build --env prod   build an installable app, with BULK_ACTIONS and ANALYTICS off
```

Sign in with any name and email. The mock backend refuses only an email that starts with `locked@`,
so you can see a failed submit.

## Where each feature is

| Feature                        | File                                                                                         |
| ------------------------------ | -------------------------------------------------------------------------------------------- |
| Application map                | `src/app-map.js`                                                                             |
| Shell, router, `guards`        | `src/app.js`                                                                                 |
| A crumb named by the data      | `imp.routeLabels` in `src/todos/todo-detail-screen.js`                                       |
| Sign-in page and return path   | `signIn` node in `src/app-map.js`, the guard in `src/app.js`, `next` in `src/sign-in.js`     |
| HTTP client and interceptor    | `src/todos/todo-api.js`, initialized in `src/app.js`                                         |
| Retry of a failed read         | `mocks/todos.mock.js` returns one `503`, the client retries it                               |
| Named state and `computed`     | `src/app.js`, `src/todos/todo-list-screen.js`                                                |
| Forms and validation           | `src/sign-in.js`, `src/todos/todo-list-screen.js`                                            |
| A failed submit, a clean form  | `formError` in `src/sign-in.js`, `imp.form.dirty` in `src/submit-button.js`                  |
| Page titles and descriptions   | `title` of the router in `src/app.js`, `description` of a node in `src/app-map.js`           |
| Async `setup` and error screen | `src/todos/todo-detail-screen.js`                                                            |
| Dialogs, toasts, notifications | `src/todos/todo-detail-screen.js`, `src/app.js`                                              |
| History of a todo              | `timeline` in `src/todos/todo-detail-screen.js`, events kept by `mocks/todos.mock.js`        |
| Translations (English, Polish) | `locales/`, bound through `src/translate.js`                                                 |
| Lazy area with own messages    | `src/stats/area.js`, `src/stats/locales/`                                                    |
| Build flag                   | `BULK_ACTIONS` in `imp.json` and `env/`, read in the todo list screen                        |
| Analytics                      | `src/analytics.js`, zones and outcomes in `src/todos/`                                       |
| Custom light and dark theme    | `src/theme.js`, listed in `init` in `src/main.js`, offered by `themeSelect`                  |
| Styled components of your own  | `src/ui/`: the hero, the stat tiles, the backdrop and the logo mark                          |
| Account menu                   | `src/ui/account-menu.js`: a popover on desktop, inline in the drawer                         |
| QR code of the app address     | `qrCode` in `src/about/about-screen.js`, with the address as text                            |
| Environments                   | `env/dev.json`, `env/prod.json`                                                              |
| Installable offline app        | `pwa` in `imp.json`, so `imp build` writes the manifest, the icons and the offline worker   |
| Size budget of the build       | `build.maxSize` in `imp.json`                                                                |
| Logger                         | `createLogger` in `src/app.js` and `src/todos/todo-list-screen.js`                           |
| Custom component with a skill  | `src/todos/todo-progress.js`, `.skill.md` and `.preview.js` beside it                        |
| Focus on a new screen          | `src/screen-frame.js`                                                                        |
| Accessibility checks           | `toHaveAccessibleControls` in `test/app.spec.js`                                             |
| Unit tests                     | `test/*.test.js`: the model, the HTTP client, the translations, the UI                       |
| Browser specs                  | `test/app.spec.js`: one user session from sign-in to sign-out                                |

## Deploy it

`imp build --env prod` writes `dist/`. Upload that folder, and give the host these rules:

- Serve `index.html` for a path that has no file, so a deep link works. A missing file under
  `/chunks/` must get a `404`, not `index.html`.
- Send `Cache-Control: public, max-age=31536000, immutable` for a file under `/chunks/`, and
  `Cache-Control: no-cache` for every other file.
- Keep the `chunks/` files of the previous build, so an open tab can still load its lazy chunks.
- Send the Content Security Policy below with the page. The app loads its fonts from its own
  `public/fonts/` folder, so the policy names no other origin:

```
Content-Security-Policy: script-src 'self'; style-src 'self'
```

The fonts are IBM Plex Sans and Sora. Both are licensed under the SIL Open Font License 1.1. The
license texts are next to the font files.
