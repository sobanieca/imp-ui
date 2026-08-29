import { breadcrumbs } from 'imp/std/shell'
import { icon } from 'imp/std'

export const name = 'Breadcrumbs'
export const category = 'Shell'
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
    { ...trail[0], label: 'Home', icon: icon({ name: 'home', size: 'sm' }) },
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
