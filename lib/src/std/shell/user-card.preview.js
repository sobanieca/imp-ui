import { userCard } from 'imp/std/shell'
import { button, menuButton } from 'imp/std'
import { flex } from 'imp/std/layout'
import { groups } from '../preview-groups.js'

export const name = 'UserCard'
export const group = groups.shell

const picture =
  'data:image/svg+xml;utf8,'
  + encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><rect width="24" height="24" fill="%237c9cff"/><circle cx="12" cy="9" r="4" fill="white"/><path d="M4 22a8 8 0 0116 0z" fill="white"/></svg>',
  )

export const initialsOnly = {
  scenario: 'Initials only',
  component: userCard({ name: 'Ada Lovelace' }),
}

export const withAnEmail = {
  scenario: 'With an email',
  component: userCard({ name: 'Ada Lovelace', description: 'ada@example.com' }),
}

export const withAPicture = {
  scenario: 'With a picture',
  component: userCard({ name: 'Ada Lovelace', description: 'Owner', picture }),
}

export const linkedToTheAccountPage = {
  scenario: 'Linked to the account page',
  component: userCard({ name: 'Ada Lovelace', description: 'ada@example.com', href: '/account' }),
}

export const compactForARail = {
  scenario: 'Compact for a rail',
  component: userCard({ name: 'Ada Lovelace', compact: true, picture }),
}

export const aLongName = {
  scenario: 'A long name',
  component: userCard({
    name: 'Augusta Ada King-Noel, Countess of Lovelace',
    description: 'ada.king-noel@a-very-long-domain-name.example.com',
  }),
}

export const withASignOutButton = {
  scenario: 'With a sign-out button of the app',
  component: flex(
    { gap: 2, verticalAlign: 'center' },
    userCard({ name: 'Ada Lovelace', description: 'ada@example.com' }),
    button(
      { variant: 'ghost', size: 'sm', events: { click: () => console.log('sign out') } },
      'Sign out',
    ),
  ),
}

export const withAnAccountMenu = {
  scenario: 'With an account menu of the app',
  component: flex(
    { gap: 1, verticalAlign: 'center' },
    userCard({ name: 'Ada Lovelace', description: 'Owner', picture }),
    menuButton({
      size: 'sm',
      variant: 'ghost',
      label: 'Account',
      items: [
        { id: 'account', label: 'Account settings', onClick: () => console.log('account') },
        { id: 'sign-out', label: 'Sign out', onClick: () => console.log('sign out') },
      ],
    }),
  ),
}

export const noNameWarns = { scenario: 'No name warns', component: userCard({}) }
