# comboBox - a text input that completes from a list, one value or many, optionally free text

```js
import { comboBox, submitForm } from 'imp/std/inputs'
import { button } from 'imp/std'

comboBox({ field: 'country', label: 'Country', options: COUNTRIES })
comboBox({ field: 'skills', label: 'Skills', options: SKILLS, multiple: true })
comboBox({ field: 'labels', label: 'Labels', multiple: true, custom: true })
comboBox({ field: 'assignee', label: 'Assignee', onSearch: (text) => findPeople(text) })
comboBox({
  field: 'assignee',
  label: 'Assignee',
  minSearch: 2,
  onSearch: (text, { signal }) => api.get('/people', { query: { q: text }, signal }),
})
```

The call shape is `comboBox(props?)`. The choices are the `options` prop, never children.

| Prop        | Values                                     | Notes                                      |
| ----------- | ------------------------------------------ | ------------------------------------------ |
| `field`     | dot path, e.g. `'user.email'`              | Binds to that path of the surrounding form |
| `value`     | a state, or a plain value                  | Standalone use, when there is no form      |
| `label`     | string, or a state holding one             | Rendered as a real `<label>` for the input |
| `ariaLabel` | string                                     | Names it when there is no visible label    |
| `help`      | string, or a state holding one             | Hint under the control                     |
| `required`  | boolean                                    | Marks it and validates that a value exists |
| `disabled`  | boolean, or a state holding one - **live** | Blocks the input, the list and the chips   |

| Prop          | Values                                     | Default | Notes                                       |
| ------------- | ------------------------------------------ | ------- | ------------------------------------------- |
| `options`     | strings, or `{ value, label, disabled? }`  | `[]`    | The list that the text filters              |
| `multiple`    | boolean                                    | `false` | The value becomes an array, shown as chips  |
| `custom`      | boolean                                    | `false` | Text that matches no option becomes a value |
| `onSearch`    | `(text, { signal }) => options \| Promise` | -       | Remote options, called 250 ms after a key   |
| `minSearch`   | whole number                               | `0`     | Typed characters before `onSearch` runs     |
| `placeholder` | string                                     | -       | Shown while the input is empty              |
| `validate`    | `(value) => message \| null`               | -       | `validateAsync` is the promise form         |

| Mode                 | Value                                          |
| -------------------- | ---------------------------------------------- |
| single               | the option `value`, a string, or `undefined`   |
| `multiple`           | an array of option values, in the order chosen |
| `custom`             | the option `value`, or the text that was typed |
| `multiple`, `custom` | a tag input: an array of values and free texts |

| Key                | Effect                                                              |
| ------------------ | ------------------------------------------------------------------- |
| ArrowDown, ArrowUp | Open the list, and move the active option                           |
| Home, End          | Move to the first or the last option, while an option is active     |
| Enter              | Commit the active option. With `custom`, commit the text            |
| Escape             | Close the list. A second Escape clears the text, and a single value |
| Backspace          | In an empty `multiple` input, remove the last chip                  |
| Tab                | Close the list. The active option is not committed                  |
| `,`                | With `multiple` and `custom`, turn the text before it into a value  |

Rules an agent gets wrong:

- **`field` and `value` are alternatives.** Inside a form, use `field`. With both, imp warns and
  `field` wins. A `field` with no form around it is an error.
- **The value is the option `value`, never the label.** The input shows the label.
- **In `multiple` mode the value is always an array.** Seed it with `[]` in `initialValues`.
- **A tag input is `multiple: true, custom: true`.** There is no `tagInput` component. `options` are
  then optional suggestions.
- **The filter is a case-insensitive "contains" on the label.** There is no fuzzy match. For another
  match, filter in `onSearch`.
- **`onSearch` is the server-backed autocomplete.** imp waits 250 ms after the last key, then calls
  it once with the text. There is nothing to debounce yourself. The second argument carries a
  `signal`. imp aborts it when a newer text starts a search, and when the component unmounts. Pass
  it to the HTTP client, so the older request is cancelled instead of answered late.
- **Fetch with the client of the app, inside `onSearch`.** Resolve it once in `setup` with
  `useHttpClient(self, 'myapp.api')`, then write
  `onSearch: (text, { signal }) => api.get('/people', { query: { q: text }, signal })`. The verb
  returns the parsed body, so return an array of `{ value, label }` from it, see imp skill http.
- **With `onSearch`, imp does not filter.** It shows what the function returns. It ignores a late
  answer to an older text. It logs a rejected promise and shows no matches.
- **`minSearch` holds the search until enough is typed.** Below it, imp calls nothing and shows the
  known `options`. Use `minSearch: 2` or `3` for a large directory, so one letter does not query the
  server.
- **Pass the known options with `onSearch` too.** A stored value such as `'u3'` shows as `u3` until
  an option supplies its label. `options: [{ value: 'u3', label: 'Grace Hopper' }]` fixes that.
- **Text that matches no option does not stay.** Without `custom`, imp restores the label of the
  current value when the person leaves. Text equal to a label selects that option. Empty text clears
  a single value.
- **Enter in an open list does not submit the form.** Enter with a closed list and no typed text
  does.
- **The list is a popover in the same component.** Do not build your own panel or portal. Do not put
  the control in a container to position the list. It opens below the input, and above it when there
  is no room.
- **imp compares the values as strings.**
- **Pass the state itself to `disabled`, not `disabled.get()`.**
- imp warns about an unknown prop, and about a call with no `options`, `onSearch` or `custom`.

The words are the keys `imp.comboBox.noMatches`, `imp.comboBox.searching` and `imp.comboBox.remove`,
which takes `{label}`. Translate those keys.

```js
form(
  { initialValues: { country: undefined, skills: [], labels: [] }, onSubmit: save },
  comboBox({ field: 'country', label: 'Country', options: COUNTRIES, required: true }),
  comboBox({ field: 'skills', label: 'Skills', options: SKILLS, multiple: true }),
  comboBox({ field: 'labels', label: 'Labels', multiple: true, custom: true }),
  comboBox({
    field: 'assignee',
    label: 'Assignee',
    options: knownPeople,
    minSearch: 2,
    onSearch: (text, { signal }) =>
      api
        .get('/people', { query: { q: text }, signal })
        .then((people) => people.map(({ id, name }) => ({ value: id, label: name }))),
  }),
  button({ variant: 'primary', events: { click: submitForm } }, 'Save'),
)
```

Related: imp skill std/form - the state that `field` writes to; imp skill std/select - a short fixed
list with no typing; imp skill http - the client that `onSearch` calls; imp skill i18n - how to
translate the `imp.comboBox.*` keys.
