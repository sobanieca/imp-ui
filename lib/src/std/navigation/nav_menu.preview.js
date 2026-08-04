import { navMenu } from 'imp/std/navigation'

const sections = () => [
  { id: 'overview', label: 'Overview', href: '#overview' },
  { id: 'reports', group: 'work', label: 'Reports', href: '#reports', badge: 4 },
  { id: 'tasks', group: 'work', label: 'Tasks', href: '#tasks', badge: 12 },
  { id: 'team', group: 'admin', label: 'Team', href: '#team' },
  { id: 'billing', group: 'admin', label: 'Billing', href: '#billing' },
]

export const flat = navMenu({
  label: 'Sections',
  selected: 'tasks',
  items: sections().filter((item) => item.group === undefined || item.group === 'work'),
})

export const grouped = navMenu({
  label: 'Sections',
  selected: 'reports',
  groups: [{ id: 'work', label: 'Work', badge: 2 }, { id: 'admin', label: 'Admin' }],
  items: sections(),
})

export const asNavbar = navMenu({
  label: 'Sections',
  direction: 'row',
  selected: 'overview',
  items: sections().map(({ group: _group, badge: _badge, ...item }) => item),
})

export const withDisabledItem = navMenu({
  label: 'Sections',
  selected: 'overview',
  items: [
    { id: 'overview', label: 'Overview', href: '#overview' },
    { id: 'audit', label: 'Audit log', href: '#audit', disabled: true },
  ],
})

export const columnThenRow = navMenu({
  label: 'Sections',
  direction: { xs: 'row', md: 'column' },
  selected: 'overview',
  items: sections().map(({ group: _group, ...item }) => item),
})

export const reportingSelection = navMenu({
  label: 'Sections',
  items: sections(),
  events: { select: (event) => console.log('selected', event.detail.id) },
})
