import { userCard } from 'imp/std/shell'

export const name = 'UserCard'
export const category = 'Shell'
export const description =
  "Run 'imp skill std/userCard' to learn what userCard can do before using it."

const picture = 'data:image/svg+xml;utf8,' +
  encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><rect width="24" height="24" fill="%237c9cff"/><circle cx="12" cy="9" r="4" fill="white"/><path d="M4 22a8 8 0 0116 0z" fill="white"/></svg>',
  )

export const signedOut = userCard({ onSignIn: () => console.log('sign in') })

export const initialsOnly = userCard({ signedIn: true, name: 'Ada Lovelace' })

export const withAnEmail = userCard({
  signedIn: true,
  name: 'Ada Lovelace',
  description: 'ada@example.com',
  onSignOut: () => console.log('sign out'),
})

export const withAPicture = userCard({
  signedIn: true,
  name: 'Ada Lovelace',
  description: 'Owner',
  picture,
  onSignOut: () => console.log('sign out'),
})

export const linkedToTheAccountPage = userCard({
  signedIn: true,
  name: 'Ada Lovelace',
  description: 'ada@example.com',
  href: '/account',
})

export const compactForARail = userCard({
  signedIn: true,
  name: 'Ada Lovelace',
  compact: true,
  picture,
})

export const aLongName = userCard({
  signedIn: true,
  name: 'Augusta Ada King-Noel, Countess of Lovelace',
  description: 'ada.king-noel@a-very-long-domain-name.example.com',
})

export const primaryAndLarge = userCard({
  variant: 'primary',
  size: 'lg',
  onSignIn: () => console.log('sign in'),
})

export const asALink = userCard({ variant: 'link', onSignIn: () => console.log('sign in') })

export const slowSignIn = userCard({
  variant: 'primary',
  onSignIn: () => new Promise((resolve) => setTimeout(resolve, 1500)),
})

export const failingSignIn = userCard({
  onSignIn: () => Promise.reject(new Error('the identity provider is down')),
})

export const blockAcrossARail = userCard({
  signedIn: true,
  name: 'Ada Lovelace',
  description: 'ada@example.com',
  block: true,
  onSignOut: () => console.log('sign out'),
})

export const noHandlerWarns = userCard({})
