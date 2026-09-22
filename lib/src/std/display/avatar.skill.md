# avatar - a round picture of a person or a team, with the initials as the fallback

```js
import { avatar } from 'imp/std/display'

avatar({ name: 'Ada Lovelace' })
avatar({ name: 'Ada Lovelace', picture: '/ada.jpg' })
avatar({ name: team, size: 'lg', color: 'violet' })
```

The call shape is `avatar(props)`. The component takes **no children**. imp warns about a child and
drops it.

| Prop         | Values                                    | Default     | Notes                                         |
| ------------ | ----------------------------------------- | ----------- | --------------------------------------------- |
| `name`       | string, or a state holding one - **live** | required    | Gives the initials and the accessible name    |
| `picture`    | URL, or a state holding one - **live**    | -           | The image; the initials show when it is unset |
| `size`       | `'sm'`, `'md'`, `'lg'`                    | `'md'`      | 1.5rem, 2rem, 3rem                            |
| `color`      | `'primary'`, or any theme palette name    | `'primary'` | The colour behind the initials                |
| `decorative` | boolean                                   | `false`     | Hides the avatar from a screen reader         |

`color` accepts these 16 palette names, in palette order:

`gray`, `brown`, `red`, `orange`, `amber`, `yellow`, `lime`, `green`, `teal`, `cyan`, `sky`, `blue`,
`indigo`, `violet`, `purple`, `pink`.

Rules an agent gets wrong:

- **Import the component from `imp/std/display`**, not from `imp/std`.
- **`name` is required, also with a `picture`.** The avatar is `role="img"`, and `name` is its
  `aria-label`. One word gives one letter. Two or more words give the first and the last initial.
- **A picture that fails to load shows the initials.** Do not write an `error` handler. A new value
  in a `picture` state loads again. A `null` or an empty value shows the initials.
- **Set `decorative: true` when the name is printed next to the avatar.** A screen reader then reads
  the name one time. Without the printed name, keep the default.
- **`color` is a palette name, not a CSS colour.** Write `color: 'violet'`, never `'#7c3aed'`. imp
  warns about an unknown name and falls back to `'primary'`. A palette colour draws a tint of the
  colour with darker initials, so all 16 stay readable in a light theme and in a dark theme.
- **imp does not derive a colour from the name.** Pass the `color` that you want for each person.
- **There is no avatar group and no overlap.** `flex` has no negative gap. A row of people is
  `flex({ gap: 1 }, avatar(...), avatar(...))`. For "and 4 more", add `tag({ size: 'sm' }, '+4')`.
- **The avatar is not interactive.** There is no click and no focus. For a link to a profile, put
  the avatar inside `link`. For the signed-in person with a sign-out button, use `userCard`.

```js
import { avatar, tag } from 'imp/std/display'
import { text } from 'imp/std'
import { flex } from 'imp/std/layout'

flex(
  { gap: 2, verticalAlign: 'center' },
  avatar({ name: 'Grace Hopper', picture: '/grace.jpg', decorative: true }),
  text('Grace Hopper'),
)

flex(
  { gap: 1, verticalAlign: 'center' },
  avatar({ name: 'Ada Lovelace', picture: '/ada.jpg' }),
  avatar({ name: 'Grace Hopper', color: 'green' }),
  tag({ size: 'sm' }, '+4'),
)
```

Related: imp skill std/userCard - the signed-in person, with the same avatar; imp skill std/flex -
the row that holds several avatars; imp skill theming - the palette the `color` names come from.
