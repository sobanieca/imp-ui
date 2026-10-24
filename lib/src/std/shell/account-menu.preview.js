import { accountMenu, themeSelect } from 'imp/std/shell'
import { groups } from '../preview-groups.js'

export const name = 'AccountMenu'
export const group = groups.shell

export const signedIn = {
  scenario: 'Signed in, with a theme picker',
  component: accountMenu(
    { name: 'Ada Lovelace', description: 'ada@example.com', onSignOut: () => {} },
    themeSelect(),
  ),
}

export const autoColor = {
  scenario: 'A colour taken from the name',
  component: accountMenu({ name: 'Grace Hopper', color: 'auto', onSignOut: () => {} }),
}
