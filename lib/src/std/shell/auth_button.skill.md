# authButton - one button that signs in or out, following a signed-in state

```js
import { authButton } from 'imp/std/shell'

authButton({ signedIn: session, onSignIn: () => auth.login(), onSignOut: () => auth.logout() })
```

Call shape: `authButton(props)` - it takes no content; its wording is imp's own.

| Prop        | Values                         | Default     | Notes                                     |
| ----------- | ------------------------------ | ----------- | ----------------------------------------- |
| `signedIn`  | boolean, or a state - **live** | `false`     | Which of the two labels and handlers wins |
| `onSignIn`  | function                       | -           | Run when signed out; may return a promise |
| `onSignOut` | function                       | -           | Run when signed in; may return a promise  |
| `variant`   | `button`'s variants            | `'default'` | Passed through to the button              |
| `size`      | `'sm'`, `'md'`, `'lg'`         | `'md'`      | Passed through to the button              |
| `block`     | boolean                        | `false`     | Fills its container's width               |
| `events`    | event map                      | -           | Handlers, as on any element               |

Rules an agent gets wrong:

- **`onSignIn` / `onSignOut` are function props, not `events` entries**, because signing in is
  asynchronous and can fail. **Return the promise**: the button shows its spinner until it settles,
  and a rejection is logged rather than swallowed.
- **imp holds no session.** The component reads `signedIn` and calls your handler - it never talks
  to an identity provider, stores a token or redirects. Flip `signedIn` yourself when the handler
  finishes.
- **The wording is imp's**, under `imp.auth.signIn` and `imp.auth.signOut`; translate those keys to
  say "Log out". There is no label prop.
- **It is one button, not two.** Do not render a second one for the other state.

Related: imp skill std/userCard - who is signed in · imp skill std/button - the control it composes.
