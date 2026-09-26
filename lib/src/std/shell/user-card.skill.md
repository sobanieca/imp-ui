# userCard - the signed-in person: avatar, name and a muted line, and nothing else

```js
import { userCard } from 'imp/std/shell'

userCard({ name: 'Ada Lovelace', description: 'ada@example.com', picture: user.avatarUrl })
userCard({ name: user.name, href: '/account' })
```

The call shape is `userCard(props)`. It takes no content.

| Prop          | Values                        | Default | Notes                                          |
| ------------- | ----------------------------- | ------- | ---------------------------------------------- |
| `name`        | string, or a state - **live** | -       | The display name; also the avatar's initials   |
| `description` | string, or a state - **live** | -       | Email, role or tenant, muted under the name    |
| `picture`     | string, or a state - **live** | -       | Image URL; without one the initials are drawn  |
| `href`        | string                        | -       | Makes the card a link (an account page)        |
| `compact`     | boolean                       | `false` | Avatar only; the words stay for screen readers |
| `events`      | event map                     | -       | Handlers on the card, as on any element        |

Rules an agent gets wrong:

- **The card displays. It does not act.** It has no sign-in button, no sign-out button and no menu.
  The app renders those controls itself, beside the card, and decides what a sign-in and a sign-out
  do. Write `flex(userCard(person), button({ events: { click: signOut } }, 'Sign out'))`, or a
  `menuButton` with the account actions.
- **Render the card only for a signed-in person.** Whether somebody is signed in is the `signedIn`
  prop of `shell`, see imp skill std/shell. A signed-out visitor sees the `signIn` content of the
  frame, and the frame does not show the `extras` that hold this card.
- **Inside `shell`, put it in `extras`.** The frame places `extras` at the end of the bar on a
  desktop, at the foot of the column in the sidebar-only layout, and in the drawer on a phone.
- **imp holds no session.** The component reads `name`, `description` and `picture`, and nothing
  else. It never talks to an identity provider, stores a token, or redirects.
- **The avatar falls back to initials.** imp takes them from the first and the last word of `name`,
  and draws them on the primary colour. A `picture` that fails to load shows the initials too. The
  same avatar is a component of its own, see imp skill std/avatar.
- **The avatar is `aria-hidden`**, and the name is the accessible text. So a screen reader reads the
  person once.
- **`name` is app data, and imp does not translate it.** Do not pass it through `t()`. imp warns
  when `name` is missing.

```js
import { button, menuButton } from 'imp/std'
import { flex } from 'imp/std/layout'
import { userCard } from 'imp/std/shell'

flex(
  { gap: 1, verticalAlign: 'center' },
  userCard({ name: user.name, description: user.email, picture: user.avatarUrl }),
  menuButton({
    size: 'sm',
    variant: 'ghost',
    label: 'Account',
    items: [
      { id: 'account', label: 'Account settings', onClick: () => navigate('/account') },
      { id: 'sign-out', label: 'Sign out', onClick: () => auth.signOut() },
    ],
  }),
)
```

Related: imp skill std/shell - the frame whose `extras` usually hold one, and its `signedIn` gate;
imp skill std/avatar - the same avatar, as a component of its own; imp skill std/menuButton - the
account actions beside the card.
