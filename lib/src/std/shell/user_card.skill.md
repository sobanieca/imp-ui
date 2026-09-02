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

The call shape is `userCard(props)`. It takes no content.

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

- **This is one component with two states, not two components.** Signed out, it is a single sign-in
  button and no card. Signed in, it is the card with a sign-out button beside it. Do not render a
  separate button for the other state.
- **The sign-out button appears only when you pass `onSignOut`.** Leave the prop out for a card that
  only displays a person, such as a person in a comment list or an owner in a table. imp then
  renders the card alone.
- **`signedIn` defaults to `false`.** So a `userCard` with a `name` only shows a sign-in button.
  Pass `signedIn: true`, or a state, to show the person.
- **`onSignIn` and `onSignOut` are function props, not `events` entries**, because a sign-in is
  asynchronous and can fail. **Return the promise.** The button shows its spinner until the promise
  settles, and imp logs a rejection instead of hiding it.
- **Do not call this component inside `shell`.** Pass
  `account: { name, description, picture, href, onSignIn, onSignOut }` and `signedIn`. The frame
  then builds the card and places it, beside the navbar on a wide screen and inside the hamburger
  drawer on a phone. Call `userCard` directly in a frame of your own, or anywhere that shows a
  person.
- **imp holds no session.** The component reads `signedIn` and calls your handler. It never talks to
  an identity provider, stores a token, or redirects. Change `signedIn` yourself when the handler
  finishes.
- **imp owns the wording of the button**, under `imp.auth.signIn` and `imp.auth.signOut`. To say
  "Log out", translate those keys. There is no label prop.
- **The card displays. It does not act.** There is no menu and no drop-down inside it. `href` sends
  the person to an account page, and the sign-out is the button beside the card.
- **The avatar falls back to initials.** imp takes them from the first and the last word of `name`,
  and draws them on the primary colour. A `picture` that fails to load shows the broken-image mark
  of the browser, not the initials.
- **The avatar is `aria-hidden`**, and the name is the accessible text. So a screen reader reads the
  person once.
- **`name` is app data, and imp does not translate it.** Do not pass it through `t()`.

Related: imp skill std/button - the control it composes; imp skill std/shell - the frame that builds
one from its `account` prop.
