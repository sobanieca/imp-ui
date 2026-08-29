# userCard - the signed-in person: picture, name and one line under it

```js
import { userCard } from 'imp/std/shell'

userCard({ name: 'Ada Lovelace', description: 'ada@example.com', picture: user.avatarUrl })
userCard({ name: session.text((s) => s.name), href: '/account' })
```

Call shape: `userCard(props)` - it takes no content.

| Prop          | Values                        | Default | Notes                                          |
| ------------- | ----------------------------- | ------- | ---------------------------------------------- |
| `name`        | string, or a state - **live** | -       | The display name; also the avatar's initials   |
| `description` | string, or a state - **live** | -       | Email, role or tenant, muted under the name    |
| `picture`     | string, or a state - **live** | -       | Image URL; without one the initials are drawn  |
| `href`        | string                        | -       | Makes the whole card a link (an account page)  |
| `compact`     | boolean                       | `false` | Avatar only; the words stay for screen readers |
| `events`      | event map                     | -       | Handlers, as on any element                    |

Rules an agent gets wrong:

- **It displays, it does not act.** There is no menu, no dropdown and no sign-out inside it - put
  `authButton` beside it, or wrap it in your own control.
- **The avatar falls back to initials** taken from `name` (first and last word), on the primary
  color. A `picture` that fails to load shows the browser's broken-image mark, not the initials.
- **The avatar is `aria-hidden`** and the name is the accessible text, so a screen reader reads the
  person once.
- **`name` is app data and is not translated** - do not route it through `t()`.

Related: imp skill std/authButton - the sign-in / sign-out control beside it.
