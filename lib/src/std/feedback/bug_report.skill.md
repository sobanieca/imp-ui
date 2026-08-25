# bugReport - a trigger that lets a person point at an element and describe what is wrong with it

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

Call shape: `bugReport(props?, ...children)`. Children are the trigger's visible content; with none
it says "Report a problem" through `t()`.

Pressing the trigger starts element picking: the element under the pointer is outlined, a click (or
`Enter`) takes it, `Escape` cancels. A comment panel then opens next to the outlined element, and
`onSubmit` gets one plain-data report object.

| Prop       | Values                                    | Default     | Notes                                                           |
| ---------- | ----------------------------------------- | ----------- | --------------------------------------------------------------- |
| `onSubmit` | `(report) => void \| Promise`             | -           | **Required.** Where the report goes. May be async and may throw |
| `as`       | `'button'`, `'link'`                      | `'button'`  | How the trigger looks - both render a native `<button>`         |
| `variant`  | any `button` variant                      | `'default'` | Passed to `button`; only when `as: 'button'`                    |
| `size`     | `'sm'`, `'md'`, `'lg'`                    | `'md'`      | Trigger size                                                    |
| `label`    | string, or a state holding one - **live** | -           | Trigger text; with children it becomes the accessible name      |
| `events`   | any DOM events                            | -           | Bound on the component's root                                   |

## The report `onSubmit` receives

Plain JSON-safe data, captured **at the moment the element was picked** - not when the comment was
finished - so it describes the screen being complained about even if the app moved on:

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

- **`element.path`** is a description, not a selector: `>` is a parent-child step and `>>` crosses
  into a component's shadow root, so the component before the last `>>` owns the node. Never feed it
  to `querySelector`. It is deliberately **not shown to the person** - they see the outline instead.
- **`state`** is every imp state in scope at the picked element, nearest provider first, as plain
  data - enough to rebuild the screen.
- **`controls`** is every form control in the picked element (the whole `<form>` when it is inside
  one), with the values actually typed in, which `element.html` does not carry. A password field
  records `value: null` and a `length`, never the password.

## Rules an agent gets wrong

- **It imports from `imp/std/feedback`**, not from `imp/std`.
- **`onSubmit` is a prop, not an `events` entry.** Storing a report is asynchronous and can fail,
  and a `CustomEvent` cannot be awaited. Return a promise: `bugReport` disables its buttons while it
  is pending, closes on resolve, and shows a retryable error on reject. imp stores nothing itself -
  there is no default endpoint, no `localStorage` fallback and no queue.
- **Do not build the picking or the panel yourself.** The trigger, the outline, the comment panel
  and the capture are the whole component; app code supplies only `onSubmit`.
- **It is not `imp review`.** `imp review` is the dev server's own widget writing `.imp/reviews/`
  for an agent to read (`imp skill review`); `bugReport` is a component you ship in the app for the
  people using it. They share one capture engine, so the report shape above is the same.
- **Wording routes through `t()`** under `imp.bugReport.*` keys - override them with `messages()`
  rather than passing every string as a prop.
- **Privacy is the app's call.** `state` and `controls` can carry whatever the app put there; strip
  what should not leave the browser inside `onSubmit` before sending it.
- Unknown props warn at mount, an out-of-range `as` or `size` warns and falls back, and a missing
  `onSubmit` warns at mount and fails the send.

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
