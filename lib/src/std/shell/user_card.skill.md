# userCard - the signed-in person, or a sign-in button when nobody is

```js
import { userCard } from 'imp/std/shell'

userCard({
  signedIn: session,
  name: 'Ada Lovelace',
  description: 'ada@example.com',
  picture: user.avatarUrl,
  onSignIn: () => auth.login(),
  onSignOut: () => auth.logout(),
})
```

Call shape: `userCard(props)` - it takes no content.

| Prop          | Values                         | Default     | Notes                                            |
| ------------- | ------------------------------ | ----------- | ------------------------------------------------ |
| `signedIn`    | boolean, or a state - **live** | `false`     | Picks which half renders                         |
| `name`        | string, or a state - **live**  | -           | The display name; also the avatar's initials     |
| `description` | string, or a state - **live**  | -           | Email, role or tenant, muted under the name      |
| `picture`     | string, or a state - **live**  | -           | Image URL; without one the initials are drawn    |
| `href`        | string                         | -           | Makes the card a link (an account page)          |
| `compact`     | boolean                        | `false`     | Avatar only; the words stay for screen readers   |
| `onSignIn`    | function                       | -           | Run when signed out; may return a promise        |
| `onSignOut`   | function                       | -           | Adds the sign-out button; may return a promise   |
| `variant`     | `button`'s variants            | `'default'` | Passed through to whichever button shows         |
| `size`        | `'sm'`, `'md'`, `'lg'`         | `'md'`      | Passed through to whichever button shows         |
| `block`       | boolean                        | `false`     | Fills its container's width                      |
| `events`      | event map                      | -           | Handlers on the whole control, as on any element |

Rules an agent gets wrong:

- **It is one component with two states, not two components.** Signed out it is a single sign-in
  button and no card; signed in it is the card with a sign-out button beside it. Do not render a
  separate button for the other state.
- **The sign-out button exists only when `onSignOut` does.** Leave the prop off for a display-only
  card - a person in a comment list or an owner in a table - and only the card renders.
- **`signedIn` defaults to `false`**, so a `userCard` with only a `name` shows a sign-in button.
  Pass `signedIn: true` (or a state) to see the person.
- **`onSignIn` / `onSignOut` are function props, not `events` entries**, because signing in is
  asynchronous and can fail. **Return the promise**: the button shows its spinner until it settles,
  and a rejection is logged rather than swallowed.
- **Inside `shell` you do not call this** - pass
  `account: { name, description, picture, href,
  onSignIn, onSignOut }` and `signedIn`, and the
  frame builds the card and places it for you - beside the navbar on a wide screen, inside the
  hamburger drawer on a phone. Reach for `userCard` directly in a frame of your own, or anywhere a
  person is displayed.
- **imp holds no session.** The component reads `signedIn` and calls your handler - it never talks
  to an identity provider, stores a token or redirects. Flip `signedIn` yourself when the handler
  finishes.
- **The button wording is imp's**, under `imp.auth.signIn` and `imp.auth.signOut`; translate those
  keys to say "Log out". There is no label prop.
- **The card displays, it does not act.** There is no menu and no dropdown inside it - `href` sends
  it to an account page, and signing out is the button beside it.
- **The avatar falls back to initials** taken from `name` (first and last word), on the primary
  color. A `picture` that fails to load shows the browser's broken-image mark, not the initials.
- **The avatar is `aria-hidden`** and the name is the accessible text, so a screen reader reads the
  person once.
- **`name` is app data and is not translated** - do not route it through `t()`.

Related: imp skill std/button - the control it composes; imp skill std/shell - the frame that builds
one from its `account` prop.
