# Todo - an imp example

This app is a todo list that uses most features of imp. It runs without a backend. The `mocks/`
folder answers every API call through the dev server.

## Run it

Run these commands in this folder:

```
imp start              serve the app on http://localhost:4507/
imp test --unit        run the unit tests
imp test --e2e         run the browser specs against the mocks
imp preview            show the todoProgress component in isolation
imp map                print the application map
imp build --env prod   build for production, with BULK_ACTIONS and ANALYTICS off
```

Sign in with any name and email. The mock backend accepts everybody.

## Where each feature is

| Feature                        | File                                                                   |
| ------------------------------ | ---------------------------------------------------------------------- |
| Application map                | `src/app-map.js`                                                       |
| Shell, router, guard, options  | `src/app.js`                                                           |
| HTTP client and interceptor    | `src/todos/todo-api.js`, initialized in `src/app.js`                   |
| Retry of a failed read         | `mocks/todos.mock.js` returns one `503`, the client retries it         |
| Named state and `computed`     | `src/app.js`, `src/todos/todo-list-screen.js`                          |
| Forms and validation           | `src/sign-in.js`, `src/todos/todo-list-screen.js`                      |
| Async `setup` and error screen | `src/todos/todo-detail-screen.js`                                      |
| Dialogs, toasts, notifications | `src/todos/todo-detail-screen.js`, `src/app.js`                        |
| Translations (English, Polish) | `locales/`, bound through `src/translate.js`                           |
| Lazy area with own messages    | `src/stats/area.js`, `src/stats/locales/`                              |
| Feature flag                   | `BULK_ACTIONS` in `imp.json` and `env/`, read in the todo list screen  |
| Analytics                      | `src/analytics.js`, zones and outcomes in `src/todos/`                 |
| Custom light and dark theme    | `src/theme.js`, applied in `src/main.js`, offered by `themeSelect`     |
| Styled components of your own  | `src/ui/`: the hero, the stat tiles, the backdrop and the logo mark    |
| Account menu                   | `src/ui/account-menu.js`: a popover on desktop, inline in the drawer   |
| Environments                   | `env/dev.json`, `env/prod.json`                                        |
| Logger                         | `createLogger` in `src/app.js` and `src/todos/todo-list-screen.js`     |
| Custom component with a skill  | `src/todos/todo-progress.js`, `.skill.md` and `.preview.js` beside it  |
| Focus on a new screen          | `src/screen-frame.js`                                                  |
| Accessibility checks | `toHaveAccessibleControls` in `test/app.spec.js`, `contrastProblems` in `test/theme.test.js` |
| Unit tests                     | `test/*.test.js`: the model, the HTTP client, the translations, the UI |
| Browser specs                  | `test/app.spec.js`: one user session from sign-in to sign-out          |
