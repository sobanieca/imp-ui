# markdownNote - renders a todo's notes as Markdown, live as they are typed

```js
import { markdownNote } from './components/markdown_note.js'

markdownNote({ field: 'notes', label: words('todo.form.notesPreview') })
```

Call shape: `markdownNote(props)` - one props object, no children.

| Prop     | Values                           | Notes                                          |
| -------- | -------------------------------- | ---------------------------------------------- |
| `field`  | dot path into the enclosing form | Renders that value and follows every keystroke |
| `source` | string or state                  | Renders that instead - for use outside a form  |
| `label`  | node or string                   | Optional caption above the panel               |

Pass `field` **or** `source`, not both; `field` wins. With neither, the panel shows its empty text.

## How it gets the value

`field` is resolved with `useState('imp.form')` - the state `form` initializes on itself - so the
component only works **inside a form**, and it follows the same field paths the inputs use. Outside
a form, pass `source`.

## Markdown comes from micromark

The rendering is `micromark`, vendored with `imp install micromark` and imported by its bare alias.
It is CommonMark, and it is safe by default: raw HTML in the note is **escaped**, and `javascript:`
URLs are dropped, so the output is passed to `html()` without a sanitizer. Keep it that way - do not
turn on micromark's `allowDangerousHtml`.

Rules an agent gets wrong:

- **Do not read the notes yourself and hand over HTML.** Give it the Markdown source; converting is
  the component's job, and it is the only place the dependency is imported.
- **Import micromark by its bare alias** (`import { micromark } from 'micromark'`), never a path
  into `dependencies/` - that is an `imp/exact-dependency-versions` lint error.
- **It is not a form control.** It has no `field` value of its own to write, takes no label element,
  and never appears in `imp.form.errors`.
- Its content is in a shadow root, so its styles cannot be reached from the page; the Markdown
  elements are styled inside the component from `--imp-*` tokens.

```js
form(
  { initialValues: { notes: '' }, onSubmit: save },
  textArea({ field: 'notes', label: message('todo.form.notes'), rows: 3 }),
  markdownNote({ field: 'notes', label: words('todo.form.notesPreview') }),
)
```
