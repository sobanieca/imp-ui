# bugReport - the Report a bug button or link: the person points at an element and describes what is wrong

```js
import { bugReport } from 'imp/std/feedback'

bugReport({
  onSubmit: (report) =>
    fetch('/api/bug-reports', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(report),
    }),
})
```

The call shape is `bugReport(props?, ...children)`. The children are the visible content of the
trigger. With no children, the trigger says "Report a problem" through `t()`.

A press on the trigger starts the element picking. imp outlines the element under the pointer. A
click, or `Enter`, selects it. `Escape` cancels. A comment panel then opens next to the outlined
element. `onSubmit` receives one report object of plain data.

| Prop       | Values                                    | Default     | Notes                                                           |
| ---------- | ----------------------------------------- | ----------- | --------------------------------------------------------------- |
| `onSubmit` | `(report) => void \| Promise`             | -           | **Required.** Where the report goes. May be async and may throw |
| `as`       | `'button'`, `'link'`                      | `'button'`  | How the trigger looks - both render a native `<button>`         |
| `variant`  | any `button` variant                      | `'default'` | Passed to `button`; only when `as: 'button'`                    |
| `size`     | `'sm'`, `'md'`, `'lg'`                    | `'md'`      | Trigger size                                                    |
| `label`    | string, or a state holding one - **live** | -           | Trigger text; with children it becomes the accessible name      |
| `events`   | any DOM events                            | -           | Bound on the component's root                                   |

## The report `onSubmit` receives

The report is plain data that is safe as JSON. imp captures it **at the moment when the person
picked the element**, not when they finished the comment. So it describes the screen that the
comment is about, even when the app moved on:

```js
{
  comment: 'The save button does nothing.',
  time: '2026-08-25T12:10:36.682Z',
  page: 'https://acme.test/settings',
  title: 'Settings - Acme',
  viewport: '1440x900',            // 'at 2x' appended when the DPR is not 1
  scroll: '0,1240',                // '' when the page was not scrolled
  scheme: 'dark',                  // from prefers-color-scheme
  motion: 'reduce',                // '' unless reduced motion is on
  lang: 'en',
  dir: 'ltr',
  element: {
    path: 'body > div#app > acme-settings >> form.panel > button.save',
    rect: '96x36 at 512,604',
    text: 'Save changes',
    html: '<button class="save" type="submit" disabled="">Save changes</button>',
  },
  state: [{ name: 'settings.profile', value: { name: 'Ada' } }],
  controls: [{ name: 'input[name=name]', value: 'Ada', disabled: false, readOnly: false }],
}
```

- **`element.path` is a description, not a selector.** `>` is a parent-to-child step. `>>` crosses
  into the shadow root of a component, so the component before the last `>>` owns the node. Never
  pass the path to `querySelector`. imp **does not show the path to the person**, on purpose. They
  see the outline instead.
- **`state` is every imp state in scope at the picked element**, with the nearest provider first, as
  plain data. It is enough to rebuild the screen.
- **`controls` is every form control in the picked element.** When the element is inside a `<form>`,
  it is the whole form. The list carries the values that the person typed, which `element.html` does
  not hold. A password field records `value: null` and a `length`, never the password.

## Rules an agent gets wrong

- **Use this component for every bug report of the app.** Do not write a report dialog of your own,
  with a form, a "what went wrong" field and the page address. `bugReport` is that dialog, and it
  captures more than a form can.
- **Put the trigger where a person looks for it**: `as: 'link'`, `size: 'sm'` in the app footer,
  see imp skill std/shell, or the default button in the `extras` of the shell. After a report is
  sent, the trigger shows the thanks beside it on the same line.
- **Import the component from `imp/std/feedback`**, not from `imp/std`.
- **`onSubmit` is a prop, not an `events` entry.** Storing a report is asynchronous and can fail,
  and you cannot await a `CustomEvent`. Return a promise. `bugReport` disables its buttons while the
  promise is pending, closes the panel when it resolves, and shows an error that the person can
  retry when it rejects. imp stores nothing itself. There is no default endpoint, no `localStorage`
  fallback and no queue.
- **Do not build the picking or the panel yourself.** The trigger, the outline, the comment panel
  and the capture are the whole component. App code supplies `onSubmit` only.
- **This component is not `imp review`.** `imp review` is the widget of the dev server, see
  `imp skill review`. It writes to `.imp/reviews/` for an agent to read. `bugReport` is a component
  that you ship in the app, for the people who use it. The two share one capture engine, so the
  report shape above is the same.
- **The wording goes through `t()`**, under the `imp.bugReport.*` keys. Override those keys with
  `messages()`. Do not pass every string as a prop.
- **The app decides about privacy.** `state` and `controls` can carry whatever the app put there.
  Remove what must not leave the browser inside `onSubmit`, before you send the report.
- imp warns about an unknown prop at mount. It warns about an `as` or a `size` outside the list, and
  falls back to the default. It warns at mount about a missing `onSubmit`, and the send then fails.

```js
import { bugReport } from 'imp/std/feedback'

bugReport(
  {
    as: 'link',
    size: 'sm',
    onSubmit: async (report) => {
      const { state, ...safe } = report
      const response = await fetch('/api/bug-reports', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(safe),
      })
      if (!response.ok) throw new Error('the bug tracker rejected the report')
    },
  },
  'Something looks wrong',
)
```
