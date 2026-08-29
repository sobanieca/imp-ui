import { authButton } from 'imp/std/shell'

export const name = 'AuthButton'
export const category = 'Shell'
export const description =
  "Run 'imp skill std/authButton' to learn what authButton can do before using it."

export const signedOut = authButton({
  onSignIn: () => console.log('sign in'),
})

export const signedIn = authButton({
  signedIn: true,
  onSignOut: () => console.log('sign out'),
})

export const primaryAndLarge = authButton({
  variant: 'primary',
  size: 'lg',
  onSignIn: () => console.log('sign in'),
})

export const asALink = authButton({ variant: 'link', onSignIn: () => console.log('sign in') })

export const slowSignIn = authButton({
  variant: 'primary',
  onSignIn: () => new Promise((resolve) => setTimeout(resolve, 1500)),
})

export const failingSignIn = authButton({
  onSignIn: () => Promise.reject(new Error('the identity provider is down')),
})

export const noHandlerWarns = authButton({})
