# The catalog is short: one component per job, and a prop in place of a second component

## Context

The mainstream component sets hold sixty components or more. Many of them do the same job. A
password field, a search field, a number field and a text area are one text input with a different
`type`. A segmented control and a toggle group are one row of choices. A date picker and a time
picker are one panel. A date range picker and a period picker are one panel. A badge is a tag with a
dot. Each extra name is a name that a person must find in the gallery of `imp preview`, and that an
agent must choose between. A long catalog also hides the few components that an app really needs.

imp targets the 80%: a dashboard, CRUD, an internal tool, the UI of a product. The catalog must be
short enough to read in one look at the sidebar of `imp preview`. It must still build most apps.

## Decision

**One component does one job, and a prop covers a variant of that job.** A second component exists
only when it adds behaviour of its own. These are the merges that follow from that rule:

| Job                         | The component                        | What it replaces                                           |
| --------------------------- | ------------------------------------ | ---------------------------------------------------------- |
| Any text input              | `textField`, with `type` and `rows`  | A password, search, number and multi-line component        |
| A choice drawn as a row     | `segmented`, with `multiple`         | A toggle group                                             |
| A value from a list         | `comboBox`, with `multiple`/`custom` | A tag input, a cascader, a tree select                     |
| A date                      | `datePicker`, with `time`            | A time picker                                              |
| A range of dates            | `dateRangePicker`, with `presets`    | A period picker, a relative time picker                    |
| Progress and a measurement  | `progress`, with `shape`             | A gauge, a statistic                                       |
| A wait with no measure      | `loader`                             | A spinner component per size, and a busy overlay           |
| A status mark               | `tag`, with `dot`                    | A badge                                                    |
| A page-level message        | `emptyState`, with `icon` and `kind` | A result page, an illustration component                   |
| An inline message           | `notice`                             | An alert. The name `alert` shadows the global of a browser |
| A menu of actions           | `menuButton`, with `items`           | A dropdown menu, a split button component                  |
| A panel beside a control    | `dialog({ modal: false, anchor })`   | A popover, a popconfirm                                    |
| A pager                     | none                                 | Paging is an infinite scroll, in `table` and in `list`     |
| Dated events in order       | `timeline`, with `icon` and `color`  | An activity feed, a history log, an audit trail            |
| A chart of numbers          | `chart`, with `type` and `stacked`   | A bar, a column, a line and a stacked chart component      |
| An arrangement in two axes  | none                                 | An app writes CSS grid in its own component                |
| A floating button           | none                                 | A `button` that the app places with its own CSS            |
| A submit button             | `button`, with `submitForm`          | A submit button component, a reset button component        |
| A tenant switcher           | `orgSelect`                          | A workspace menu that every app wrote by hand              |
| A joined row of controls    | `flex`, with `joined`                | A button group                                             |
| A number with step buttons  | `textField`, with `stepper`          | A number stepper, an input group                           |
| Panes that a person resizes | `splitPane`, nested for a third pane | A splitter, a resizable panel group                        |

**Paging is an infinite scroll.** `table`, `list` and `timeline` take `hasMore` and `onLoadMore`. A
sentinel at the end of the rows asks for the next page when it comes into view. There is no pager
component, and no page number prop.

**The shared code lives in `std/shared/`, and a component never copies a drawing.** The menu panel
of `menuButton` and of `breadcrumbs` is `shared/menu.js`. The avatar of `userCard`, of `list` and of
`avatar` is `shared/avatar.js`, and `orgSelect` renders `avatar` itself. The ring of a loading
`button` and of `loader` is `shared/spinner.js`. `themeSelect`, `langSelect` and `orgSelect` render
`menuButton`, and add no menu of their own. The infinite scroll of `table`, `list` and `timeline` is
`shared/load-more.js`. The month matrix of `datePicker` and `calendar` is `shared/dates.js`. The
check of an `items` array, with the warning for a bad entry and the `id` that defaults to the index,
is `shared/items.js`. The padding of a button, a segment and a text segment per `size` is
`controlPaddingRules` in `shared/css.js`.

**A pair of named wrappers over one factory stays, when the two names are two jobs.** `checkbox` and
`toggle` share `checkable.js`.

## Consequences

- The sidebar of `imp preview` shows the whole library in one look. A person who does not know a
  name finds the component by its job.
- An agent has one candidate per job. It cannot pick the wrong one of two near-equal components.
- A merged component has more props than each of its parts had. Each skill page states which props
  belong together, and imp warns about a pair with no meaning, such as `type` with `rows`.
- A new component must name a job that no existing component does. When a prop on an existing
  component covers the case, the prop is the answer.
- An app that needs a control outside the catalog writes it as its own component, on the same public
  API that the standard library uses.
