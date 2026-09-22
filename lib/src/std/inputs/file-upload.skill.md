# fileUpload - pick files or drop them, with the list as plain data and the File objects in onFiles

```js
import { fileUpload } from 'imp/std/inputs'

fileUpload({
  field: 'attachments',
  label: 'Attachments',
  multiple: true,
  accept: 'image/*,.pdf',
  maxSize: 5_000_000,
  onFiles: (files) => {
    chosen = files
  },
})
```

The call shape is `fileUpload(props?)`. It renders a native `<input type="file">`, a drop zone, and
the list of the chosen files with a remove button for each file.

| Prop        | Values                                     | Notes                                      |
| ----------- | ------------------------------------------ | ------------------------------------------ |
| `field`     | dot path, e.g. `'user.email'`              | Binds to that path of the surrounding form |
| `value`     | a state, or a plain array                  | Standalone use, when there is no form      |
| `label`     | string, or a state holding one             | Rendered as a real `<label>` for the input |
| `ariaLabel` | string                                     | Names it when there is no visible label    |
| `help`      | string, or a state holding one             | Hint under the control                     |
| `required`  | boolean                                    | Fails while the list is empty              |
| `disabled`  | boolean, or a state holding one - **live** | Blocks the input, the drop and the removal |

| Prop       | Values                               | Default | Notes                                       |
| ---------- | ------------------------------------ | ------- | ------------------------------------------- |
| `multiple` | boolean                              | `false` | `false`: a new file replaces the old file   |
| `accept`   | string, e.g. `'image/*,.pdf'`        | -       | MIME types, `type/*` and `.extension` rules |
| `maxSize`  | number of bytes                      | -       | The limit for each file                     |
| `onFiles`  | `(files: File[]) => void \| Promise` | -       | Every `File` that the control holds now     |
| `validate` | `(entries) => message \| null`       | -       | `validateAsync` is the promise form         |

## The contract

A state value must be plain data, and a `File` is not plain data. So the control splits the two:

- **The bound value is always an array of `{ id, name, size, type }`.** That is what `required`,
  `validate` and the values of the form see. It is an array also when `multiple` is `false`.
- **`onFiles` receives the `File` objects.** imp calls it each time the set of files changes: after
  a pick, a drop, a removal, and a reset of the form. The argument is the complete current list, in
  the order of the entries. Keep it in a variable, and read it in `onSubmit`.
- **An entry with no `File` is a stored file.** Put the files that the server already has in
  `initialValues`, with your own `id`. They show in the list. A person can remove them. They never
  appear in `onFiles`.

Rules an agent gets wrong:

- **`field` and `value` are alternatives.** Inside a form, use `field`. With both, imp warns and
  `field` wins. A `field` with no form around it is an error.
- **Do not put a `File` in a state or in `initialValues`.** Seed the field with `[]`.
- **The values of the form hold no file content.** Send the files from `onFiles`, for example in a
  `FormData`. Send the entries when the server must know which stored files remain.
- **`onFiles` replaces your list. It does not add to it.** Write `chosen = files`, not
  `chosen.push(...files)`.
- **imp refuses a file above `maxSize`, or outside `accept`, and does not add it.** The field shows
  `imp.fileUpload.tooLarge` or `imp.fileUpload.wrongType`. The message goes away at the next pick,
  removal or submit. It does not block the submit.
- **`maxSize` is in bytes, with decimal units.** `5_000_000` shows as `5 MB`.
- **`accept` is checked for a dropped file too**, not only in the file dialog.
- **imp logs a rejected `onFiles` promise.** Show your own message for a failed upload.
- **Do not build your own drop zone around the control.** The zone is part of it.
- **Pass the state itself to `disabled`, not `disabled.get()`.**

The words are the keys `imp.fileUpload.prompt`, `imp.fileUpload.accepts` with `{types}`,
`imp.fileUpload.maxSize` with `{size}`, `imp.fileUpload.remove` with `{name}`,
`imp.fileUpload.tooLarge` with `{name}` and `{size}`, and `imp.fileUpload.wrongType` with `{name}`.

```js
const ticketForm = () => {
  let chosen = []
  return form(
    {
      initialValues: { title: '', attachments: [] },
      onSubmit: async (values) => {
        const body = new FormData()
        body.append('title', values.title)
        for (const file of chosen) body.append('attachments', file)
        await fetch('/tickets', { method: 'POST', body })
      },
    },
    textField({ field: 'title', label: 'Title', required: true }),
    fileUpload({
      field: 'attachments',
      label: 'Attachments',
      multiple: true,
      accept: 'image/*,.pdf',
      maxSize: 5_000_000,
      onFiles: (files) => {
        chosen = files
      },
    }),
    submitButton('Send'),
  )
}
```

Related: imp skill std/form - the state that `field` writes to; imp skill state - why a state value
is plain data; imp skill i18n - how to translate the `imp.fileUpload.*` keys.
