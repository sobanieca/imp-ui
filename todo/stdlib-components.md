# Standard component library

Ship a batteries-included component library so an app can be built without assembling a component
stack or pulling third-party UI dependencies (essence #5/#6 in `prev/essence.md`: imp is an
all-in-one toolkit targeting the 80% — dashboards, CRUD, internal tools, product UIs). A fleshed-out
draft set lives in `prev/experiment/stdlib/`.

## What ships

Group components the way the draft does, importable from imp itself (never a third-party package):

- **Layout** — `stack`, `row`, `grid`, `spacer`, `container`.
- **Inputs** — `textField`, `textArea`, `selectBox`, `checkbox`, `radioGroup`, `switchToggle`,
  `slider`, `datePicker`, `formBox` (SPA-default `submit` with `preventDefault`).
- **Display** — `card`, `badge`, `avatar`, `tag`, `tooltip`.
- **Feedback** — `spinner`, `progressBar`, `alert`, `toast`, `modal`, `drawer`.
- **Navigation** — `tabs`, `menuList`, `breadcrumbs`, `pagination`.
- **Data** — `dataTable`, `listView`, `tree`.

## Conventions (keep from the draft)

- **Components are lowercase functions** (essence #14) — no framework component concept, one naming
  rule (lint-enforced). Built entirely on the public kernel API, nothing privileged.
- **Two-way binding by convention:** pass a `signal` as `value`/`checked` and the control reads it
  reactively and writes back on input; pass a plain value for an uncontrolled initial. Extra props
  (`placeholder`, `disabled`, `events`, …) flow through to the underlying element via the existing
  type-based dispatch.
- **Every component consumes `--imp-*` theme tokens** (`todo/theme-styling.md`) and styles with
  `css``` using **logical properties only**, so theming and RTL work for free.
- **User-facing strings pipe through `t()`** and register defaults via `defineMessages` (the draft's
  `stdlib/index.js` seeds `imp.close`, `imp.loading`, etc.) — gated on the future i18n item.

## Dependencies

This is the top of the stack: it needs the signal graph and structural primitives
(`todo/reactivity-signals.md`),
``css``` + theme tokens (``todo/theme-styling.md`), and the i18n`t()`/`defineMessages`layer. Some components (`toast`,`modal`,`drawer`) also use`portal`
from the structural primitives. Land those first; the stdlib can grow group by group.

## A showcase surface

Consider an `imp showcase` / component-gallery command (essence #20 lists a gallery with a live
theme/locale editor) so agents and humans can see every component render under each theme and
direction. Scope it as its own todo if it grows beyond a thin dev-server view.

## ADR impact

New ADR `standard-component-library.md`: what the stdlib guarantees (token-driven, i18n-piped,
logical-properties-only, signal-bound-by-convention, lowercase-function components on the public
API), and the deliberate 80% scope boundary (heavy data viz, native mobile, collaborative editing
out of scope). Update the ADR table; document the component catalog in `docs/`.

## Open questions

- **Catalog scope for v1.** Which of the draft groups are must-have vs. later additions.
- **Overlay management.** Shared stacking/focus-trap/escape handling for `modal`/`drawer`/`toast`
  rather than each rolling its own.
- **Accessibility baseline.** The ARIA/keyboard contract every interactive component must meet.
- **`console.warn` paths** (e.g. duplicate-key warnings surfaced from `each`) route through the
  built-in logger (`todo/logger.md`).
