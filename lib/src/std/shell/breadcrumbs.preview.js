import { breadcrumbs } from 'imp/std/shell'
import { icon } from 'imp/std'
import { luHouse } from 'imp/icons'
import { groups } from '../preview-groups.js'

export const name = 'Breadcrumbs'
export const group = groups.shell

const trail = [
  { id: 'home', label: 'Home', href: '/' },
  { id: 'orders', label: 'Orders', href: '/orders' },
  { id: 'order', label: 'Order 8f3a' },
]

export const aTrail = { scenario: 'A trail', component: breadcrumbs({ items: trail }) }

export const withAnIconOnTheRoot = {
  scenario: 'With an icon on the root',
  component: breadcrumbs({
    items: [{ ...trail[0], label: 'Home', icon: icon(luHouse, { size: 'sm' }) }, ...trail.slice(1)],
  }),
}

export const oneLevel = {
  scenario: 'One level',
  component: breadcrumbs({ items: [{ id: 'home', label: 'Home' }] }),
}

export const anotherSeparator = {
  scenario: 'Another separator',
  component: breadcrumbs({ items: trail, separator: '>' }),
}

export const inertMiddleLevel = {
  scenario: 'Inert middle level',
  component: breadcrumbs({
    items: [
      { id: 'home', label: 'Home', href: '/' },
      { id: 'archive', label: 'Archive' },
      { id: 'order', label: 'Order 8f3a' },
    ],
  }),
}

export const reportingTheChoice = {
  scenario: 'Reporting the choice',
  component: breadcrumbs({
    items: trail,
    events: { select: (event) => console.log('crumb:', event.detail.id) },
  }),
}

export const withAPicker = {
  scenario: 'With a picker',
  component: breadcrumbs({
    items: [
      { id: 'home', label: 'Home', href: '#home' },
      {
        id: 'repo',
        label: 'imp-ui',
        href: '#imp-ui',
        options: [
          { id: 'imp-ui', label: 'imp-ui', href: '#imp-ui' },
          { id: 'imp-site', label: 'imp-site', href: '#imp-site' },
          { id: 'imp-examples', label: 'imp-examples', href: '#imp-examples' },
        ],
      },
      { id: 'file', label: 'README.md' },
    ],
  }),
}
