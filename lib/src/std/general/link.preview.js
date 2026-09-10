import { link } from 'imp/std'
import { groups } from '../preview-groups.js'

export const name = 'Link'
export const group = groups.general

export const internal = {
  scenario: 'Internal',
  component: link({ href: '/settings' }, 'Account settings'),
}
export const external = {
  scenario: 'External',
  component: link({ href: 'https://example.com', external: true }, 'Open example.com'),
}
export const secondaryTone = {
  scenario: 'Secondary tone',
  component: link({ href: '/settings', tone: 'secondary' }, 'Muted link'),
}
export const small = {
  scenario: 'Small',
  component: link({ href: '/settings', size: 'sm' }, 'Small link'),
}
export const medium = {
  scenario: 'Medium',
  component: link({ href: '/settings', size: 'md' }, 'Medium link'),
}
export const large = {
  scenario: 'Large',
  component: link({ href: '/settings', size: 'lg' }, 'Large link'),
}
export const boldWeight = {
  scenario: 'Bold weight',
  component: link({ href: '/settings', weight: 'bold' }, 'Bold link'),
}
export const withClickHandler = {
  scenario: 'With a click handler',
  component: link(
    { href: '/settings', events: { click: () => console.log('link clicked') } },
    'Logs on click',
  ),
}
