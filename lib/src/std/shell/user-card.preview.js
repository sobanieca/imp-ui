import { userCard } from 'imp/std/shell'
import { groups } from '../preview-groups.js'

export const name = 'UserCard'
export const group = groups.shell

const picture = 'data:image/svg+xml;utf8,' +
  encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><rect width="24" height="24" fill="%237c9cff"/><circle cx="12" cy="9" r="4" fill="white"/><path d="M4 22a8 8 0 0116 0z" fill="white"/></svg>',
  )

export const signedOut = {
  scenario: 'Signed out',
  component: userCard({ onSignIn: () => console.log('sign in') }),
}

export const initialsOnly = {
  scenario: 'Initials only',
  component: userCard({ signedIn: true, name: 'Ada Lovelace' }),
}

export const withAnEmail = {
  scenario: 'With an email',
  component: userCard({
    signedIn: true,
    name: 'Ada Lovelace',
    description: 'ada@example.com',
    onSignOut: () => console.log('sign out'),
  }),
}

export const withAPicture = {
  scenario: 'With a picture',
  component: userCard({
    signedIn: true,
    name: 'Ada Lovelace',
    description: 'Owner',
    picture,
    onSignOut: () => console.log('sign out'),
  }),
}

export const linkedToTheAccountPage = {
  scenario: 'Linked to the account page',
  component: userCard({
    signedIn: true,
    name: 'Ada Lovelace',
    description: 'ada@example.com',
    href: '/account',
  }),
}

export const compactForARail = {
  scenario: 'Compact for a rail',
  component: userCard({
    signedIn: true,
    name: 'Ada Lovelace',
    compact: true,
    picture,
  }),
}

export const aLongName = {
  scenario: 'A long name',
  component: userCard({
    signedIn: true,
    name: 'Augusta Ada King-Noel, Countess of Lovelace',
    description: 'ada.king-noel@a-very-long-domain-name.example.com',
  }),
}

export const primaryAndLarge = {
  scenario: 'Primary and large',
  component: userCard({
    variant: 'primary',
    size: 'lg',
    onSignIn: () => console.log('sign in'),
  }),
}

export const asALink = {
  scenario: 'As a link',
  component: userCard({ variant: 'link', onSignIn: () => console.log('sign in') }),
}

export const slowSignIn = {
  scenario: 'Slow sign-in',
  component: userCard({
    variant: 'primary',
    onSignIn: () => new Promise((resolve) => setTimeout(resolve, 1500)),
  }),
}

export const failingSignIn = {
  scenario: 'Failing sign-in',
  component: userCard({
    onSignIn: () => Promise.reject(new Error('the identity provider is down')),
  }),
}

export const blockAcrossARail = {
  scenario: 'Block across a rail',
  component: userCard({
    signedIn: true,
    name: 'Ada Lovelace',
    description: 'ada@example.com',
    block: true,
    onSignOut: () => console.log('sign out'),
  }),
}

export const noHandlerWarns = { scenario: 'No handler warns', component: userCard({}) }
