---
name: imp
description: Write and change apps and components built with imp, the buildless UI toolkit. Use when the project has an imp.json file, or when asked to build pages, components, routes, state, styles or tests with imp.
---

# imp

imp is a buildless UI toolkit. Its call shapes differ from React, Vue and other
frameworks in ways that look correct either way. Do not write imp code from
memory. Read the manuals that ship with the imp version the project runs.

## Workflow

1. Run `imp skill` before you write code. It prints the index of every manual.
   In a new project from `imp init`, follow `imp skill init` first: keep the
   font it picked and give the app a theme of its own.
2. Run `imp skill <subject>` for each part you need, such as
   `imp skill state routing` or `imp skill std/button`.
3. For a component of the project, run `imp skill ./path/to/component.js`.
   Write a `<name>.skill.md` next to every component you build.
4. When the person mentions a review, a comment or an element they marked in
   the browser, run `imp review` first.
5. Run `imp logs` to read the browser console, the errors and the network of
   the dev server.
6. After every batch of edits, run `imp fmt`, then `imp lint`, in every imp
   project, the scaffolded and the existing alike. Fix every error and every
   warning that `imp lint` reports. Work is not done until both run clean and
   the tests pass (`imp test --unit`, `imp test --e2e`).

## Rules

- Configuration lives in `imp.json`. Add no bundler and no JSX.
- Add a package with `imp install <package>`. It vendors the package into
  `dependencies/`.
