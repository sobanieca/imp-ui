import { navMenu } from 'imp/std/navigation'

export const name = 'Nav menu'
export const category = 'Navigation'
export const description =
  "Run 'imp skill std/navMenu' to learn what navMenu can do before using it."

const sections = () => [
  { id: 'overview', label: 'Overview', href: '#overview' },
  { id: 'reports', group: 'work', label: 'Reports', href: '#reports', tag: { text: 4 } },
  {
    id: 'tasks',
    group: 'work',
    label: 'Tasks',
    href: '#tasks',
    tag: { text: 'overdue', color: 'red' },
  },
  { id: 'team', group: 'admin', label: 'Team', href: '#team' },
  {
    id: 'billing',
    group: 'admin',
    label: 'Billing',
    href: '#billing',
    tag: { text: 'trial', color: 'amber' },
  },
]

export const flat = navMenu({
  label: 'Sections',
  selected: 'tasks',
  items: sections().filter((item) => item.group === undefined || item.group === 'work'),
})

export const grouped = navMenu({
  label: 'Sections',
  selected: 'reports',
  groups: [{ id: 'work', label: 'Work', tag: { text: 2 } }, { id: 'admin', label: 'Admin' }],
  items: sections(),
})

export const asBar = navMenu({
  label: 'Sections',
  direction: 'row',
  selected: 'overview',
  items: sections().map(({ group: _group, tag: _tag, ...item }) => item),
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
