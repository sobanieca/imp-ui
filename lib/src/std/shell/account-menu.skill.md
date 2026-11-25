# accountMenu - the avatar button of the signed-in person, with a popover panel

```js
import { accountMenu, langSelect, shell, themeSelect } from 'imp/std/shell'

accountMenu({ name: user.name, description: user.email, onSignOut: signOut })
accountMenu({ name, description, onSignOut }, themeSelect(), langSelect())
shell({ map: app, navbarExtras: [notifications(), accountMenu({ name, onSignOut })] })
```

The call shape is `accountMenu(props?, ...children)`. The children go into the panel, between the
person and the sign-out button. Pickers such as `themeSelect` and `langSelect` go there.

| Prop          | Values                        | Default                | Notes                                     |
| ------------- | ----------------------------- | ---------------------- | ----------------------------------------- |
| `name`        | string, or a state - **live** | required               | The person, on the avatar and in the card |
| `description` | string, or a state - **live** | -                      | The muted line under the name             |
| `picture`     | URL, or a state - **live**    | -                      | The picture of the avatar                 |
| `color`       | as on `avatar`                | `'primary'`            | The colour of the initials                |
| `label`       | string, or a state            | "Account and settings" | The name of the trigger                   |
| `onSignOut`   | `() => void`                  | -                      | Adds a "Sign out" button that calls it    |

The trigger is an avatar button on every width, and the panel is a popover under it. The panel
flips to fit the screen, so it works in the phone bar too.

Rules an agent gets wrong:

- **Put it in `navbarExtras` of `shell`**, and render it only for a signed-in person, through
  `session.view(...)`. It then stays in the top bar on a phone, so the person is one tap away.
- **Do not write the popover yourself.** The panel opens and closes through the platform: Escape, a
  click outside, and a Tab out of the panel close it.
- **The sign-out is yours.** `onSignOut` runs your code. imp holds no session.
- **A picker in the panel stays a menu of its own.** Escape in the theme menu closes that menu only.
- The words are `imp.account.open`, `imp.account.panel` and `imp.account.signOut`.

```js
import { accountMenu, notifications, shell, themeSelect } from 'imp/std/shell'
import { computed } from 'imp/state'

session.view((user) =>
  user
    ? [
        notifications({ variant: 'ghost' }),
        accountMenu(
          { name: user.name, description: user.email, color: 'auto', onSignOut },
          themeSelect(),
        ),
      ]
    : button({ events: { click: signIn } }, 'Log in'),
)
```

Related: imp skill std/userCard - the card inside the panel; imp skill std/shell - the `navbarExtras`
that hold it; imp skill std/themeSelect - a picker for the panel.
