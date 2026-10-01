# reactions - a reaction bar under any content, with an emoji panel to add one

```js
import { card } from 'imp/std/display'
import { reactions } from 'imp/std/feedback'

reactions({ items, onReact: send }, card(text('We shipped it.')))
```

The call shape is `reactions(props?, ...content)`. It renders the content, then a bar under it. The
bar holds one toggle button per emoji, with its count, and a button that opens an emoji panel. With
no content, it renders the bar alone.

| Prop        | Values                                                | Notes                                           |
| ----------- | ----------------------------------------------------- | ----------------------------------------------- |
| `items`     | array of `{ emoji, count, reacted }`, or a state      | The reactions. `reacted` marks the person's own |
| `onReact`   | `(emoji, reacted) => void \| Promise`                 | Sends the change to the server                  |
| `emojis`    | array of emoji strings or `{ emoji, name, keywords }` | The allowed set. Default: the built-in set      |
| `disabled`  | boolean, or a state holding one - **live**            | Shows the counts and hides the add button       |
| `ariaLabel` | string, or a state holding one                        | Names the bar. Default `imp.reactions.label`    |

Rules an agent gets wrong:

- **imp changes the count at once, then calls `onReact`.** `reacted` is `true` when the person added
  a reaction, and `false` when the person took it back. Send that to the server in `onReact`. Do not
  change `items` yourself in `onReact`.
- **Return the promise from `onReact`.** When it rejects, imp takes the change back and logs a
  warning. A function that returns nothing cannot report a failure.
- **A writable state in `items` receives every change.** imp writes the new array into it, and any
  change that you write shows at once. A plain array is a start value that the component keeps.
- **An item with a `count` of 0 does not show.** A count must be a whole number. Other fields of an
  item, such as an `id`, stay on the item.
- **A pick from the panel adds a reaction.** It never takes one back. When the emoji is already in
  the bar, the pick marks it as the person's own. Only a click on a pressed chip takes it back.
- **The person reacts once per emoji.** The chip is a toggle button with `aria-pressed`. A count of
  1000 or more shows short, such as `1.2K`, in the language of the page.
- **The content moves into a shadow root.** Your `styles` do not reach it. Pass a standard component
  such as `card`, or a component of your own.
- **`emojis` is the allowed set.** The panel offers only these. A chip with an emoji outside the set
  shows its count, and nobody can add to it. The person can still take their own reaction back. See
  `imp skill std/emojiPicker` for the built-in set, the search and the keys.
- **Write an emoji in source as an escape**, `'\u{1F44D}'`, not as the glyph.

```js
const items = initState(self, 'post.reactions', post.reactions)

reactions(
  {
    items,
    onReact: (emoji, reacted) =>
      reacted
        ? api.post(`/posts/${post.id}/reactions`, { body: { emoji } })
        : api.delete(`/posts/${post.id}/reactions/${encodeURIComponent(emoji)}`),
  },
  card(markdown(post.body)),
)
```

Related: imp skill std/emojiPicker - the panel and its set; imp skill std/card - the usual content;
imp skill http - the client that `onReact` calls; imp skill i18n - how to translate the
`imp.reactions.*` keys.
