import { link } from 'imp/std'

export const name = 'Link'
export const category = 'General'
export const description = "Run 'imp skill std/link' to learn what link can do before using it."

export const internal = link({ href: '/settings' }, 'Account settings')
export const external = link({ href: 'https://example.com', external: true }, 'Open example.com')
export const secondaryTone = link({ href: '/settings', tone: 'secondary' }, 'Muted link')
export const small = link({ href: '/settings', size: 'sm' }, 'Small link')
export const medium = link({ href: '/settings', size: 'md' }, 'Medium link')
export const large = link({ href: '/settings', size: 'lg' }, 'Large link')
export const mediumWeight = link({ href: '/settings', weight: 'medium' }, 'Medium weight link')
export const boldWeight = link({ href: '/settings', weight: 'bold' }, 'Bold link')
export const withClickHandler = link(
  { href: '/settings', events: { click: () => console.log('link clicked') } },
  'Logs on click',
)
