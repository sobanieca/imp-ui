import { breadcrumbs } from 'imp/std/shell'
import { icon } from 'imp/std'
import { luHouse } from 'imp/icons'

export const name = 'Breadcrumbs'
export const group = 'Shell'
export const description =
  "Run 'imp skill std/breadcrumbs' to learn what breadcrumbs can do before using it."

const trail = [
  { id: 'home', label: 'Home', href: '/' },
  { id: 'orders', label: 'Orders', href: '/orders' },
  { id: 'order', label: 'Order 8f3a' },
]

export const aTrail = breadcrumbs({ items: trail })

export const withAnIconOnTheRoot = breadcrumbs({
  items: [
    { ...trail[0], label: 'Home', icon: icon(luHouse, { size: 'sm' }) },
    ...trail.slice(1),
  ],
})

export const oneLevel = breadcrumbs({ items: [{ id: 'home', label: 'Home' }] })

export const anotherSeparator = breadcrumbs({ items: trail, separator: '>' })

export const inertMiddleLevel = breadcrumbs({
  items: [
    { id: 'home', label: 'Home', href: '/' },
    { id: 'archive', label: 'Archive' },
    { id: 'order', label: 'Order 8f3a' },
  ],
})

export const reportingTheChoice = breadcrumbs({
  items: trail,
  events: { select: (event) => console.log('crumb:', event.detail.id) },
})

export const withAPicker = breadcrumbs({
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
})
