import { avatar } from 'imp/std/display'
import { text } from 'imp/std'
import { flex } from 'imp/std/layout'
import { groups } from '../preview-groups.js'

export const name = 'Avatar'
export const group = groups.display

const PORTRAIT = `data:image/svg+xml,${
  encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><rect width="64" height="64" fill="#f4b183"/><circle cx="32" cy="26" r="12" fill="#7f4f24"/><path d="M8 64a24 24 0 0 1 48 0z" fill="#7f4f24"/></svg>',
  )
}`

export const initials = {
  scenario: 'Initials',
  component: flex(
    { gap: 2, verticalAlign: 'center' },
    avatar({ name: 'Ada Lovelace' }),
    avatar({ name: 'Grace Hopper' }),
    avatar({ name: 'Linus' }),
  ),
}

export const picture = {
  scenario: 'Picture',
  component: avatar({ name: 'Ada Lovelace', picture: PORTRAIT, size: 'lg' }),
}

export const brokenPicture = {
  scenario: 'Picture that fails to load',
  component: avatar({ name: 'Ada Lovelace', picture: '/no-such-picture.jpg', size: 'lg' }),
}

export const sizes = {
  scenario: 'Sizes',
  component: flex(
    { gap: 2, verticalAlign: 'center' },
    avatar({ name: 'Ada Lovelace', size: 'sm' }),
    avatar({ name: 'Ada Lovelace' }),
    avatar({ name: 'Ada Lovelace', size: 'lg' }),
  ),
}

export const colors = {
  scenario: 'Colors',
  component: flex(
    { gap: 2, wrap: true, verticalAlign: 'center' },
    avatar({ name: 'Platform Team', color: 'violet' }),
    avatar({ name: 'Design Team', color: 'pink' }),
    avatar({ name: 'Support Team', color: 'teal' }),
    avatar({ name: 'Finance Team', color: 'amber' }),
    avatar({ name: 'Legal Team', color: 'gray' }),
  ),
}

export const team = {
  scenario: 'A row of people',
  component: flex(
    { gap: 1, verticalAlign: 'center' },
    avatar({ name: 'Ada Lovelace', picture: PORTRAIT }),
    avatar({ name: 'Grace Hopper', color: 'green' }),
    avatar({ name: 'Alan Turing', color: 'orange' }),
    avatar({ name: 'Katherine Johnson', color: 'sky' }),
  ),
}

export const besideTheName = {
  scenario: 'Decorative, beside the name',
  component: flex(
    { gap: 2, verticalAlign: 'center' },
    avatar({ name: 'Grace Hopper', color: 'indigo', decorative: true }),
    text('Grace Hopper'),
  ),
}
