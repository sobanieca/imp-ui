import { appShell, stack, toolbar } from 'imp/std/layout'
import { commandPalette, navMenu } from 'imp/std/navigation'
import { button, heading, text } from 'imp/std'

export const name = 'App shell'
export const category = 'Layout'
export const description =
  "Run 'imp skill std/appShell' to learn what appShell can do before using it."

const items = () => [
  { id: 'overview', group: 'work', label: 'Overview', href: '#overview' },
  { id: 'reports', group: 'work', label: 'Reports', href: '#reports', badge: 4 },
  { id: 'team', group: 'admin', label: 'Team', href: '#team' },
  { id: 'billing', group: 'admin', label: 'Billing', href: '#billing' },
]

const sidebar = () =>
  navMenu({
    label: 'Sections',
    selected: 'reports',
    groups: [{ id: 'work', label: 'Work' }, { id: 'admin', label: 'Admin' }],
    items: items(),
  })

const body = () =>
  stack(
    { gap: 3 },
    heading({ level: 2 }, 'Reports'),
    ...Array.from(
      { length: 20 },
      (_unused, index) => text(`Row ${index + 1} - the main region scrolls on its own.`),
    ),
  )

export const full = appShell(
  {
    header: toolbar(
      { label: 'Workspace', justify: 'between' },
      text({ weight: 'bold' }, 'Acme'),
      button({ size: 'sm' }, 'New report'),
    ),
    sidebar: sidebar(),
    footer: text({ tone: 'secondary', size: 'sm' }, 'Signed in as ada@example.com'),
    bottomBar: navMenu({
      label: 'Sections',
      direction: 'row',
      hideAbove: 'md',
      items: items().map(({ group: _group, badge: _badge, ...item }) => item),
    }),
    collapseBelow: 'md',
  },
  body(),
)

export const withSearchInTheHeader = appShell(
  {
    header: commandPalette({
      label: 'Search',
      placeholder: 'Search anything…',
      shortcut: 'ctrl+p',
      items: items().map(({ id, group, label }) => ({ id, group, label })),
    }),
    sidebar: sidebar(),
  },
  body(),
)

export const sidebarOnly = appShell({ sidebar: sidebar(), collapseBelow: null }, body())

export const narrowSidebar = appShell(
  { header: text({ weight: 'bold' }, 'Acme'), sidebar: sidebar(), sidebarWidth: 'sm' },
  body(),
)

export const withoutSidebar = appShell(
  { header: text({ weight: 'bold' }, 'Acme'), footer: text({ size: 'sm' }, 'v1.4.0') },
  body(),
)
