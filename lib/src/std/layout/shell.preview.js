import { flex, shell, stack } from 'imp/std/layout'
import { button, heading, icon, text } from 'imp/std'
import { navMenu } from 'imp/std/navigation'
import { appLogo, breadcrumbs, langSelect, themeSelect, userCard } from 'imp/std/shell'
import { checkbox, form } from 'imp/std/inputs'
import { div } from 'imp/html'

export const name = 'Shell'
export const category = 'Layout'
export const description = "Run 'imp skill std/shell' to learn what shell can do before using it."

const sections = () => [
  { id: 'overview', label: 'Overview', href: '#overview' },
  { id: 'reports', label: 'Reports', href: '#reports', tag: { text: 4 } },
  { id: 'tasks', label: 'Tasks', href: '#tasks', tag: { text: 'new', color: 'green' } },
  { id: 'team', label: 'Team', href: '#team' },
]

const menu = (direction) =>
  navMenu({ label: 'Sections', direction, selected: 'reports', items: sections() })

const bar = () =>
  div(
    { style: 'display: flex; align-items: center; justify-content: space-between; gap: 1rem' },
    text({ weight: 'bold' }, 'Acme'),
    button({ size: 'sm' }, 'Ada Lovelace'),
  )

const page = () =>
  stack(
    { gap: 3 },
    heading({ level: 1 }, 'Reports'),
    text({ tone: 'secondary' }, 'Everything the team shipped this quarter.'),
  )

const rail = () =>
  stack(
    { gap: 2, horizontalAlign: 'center' },
    ...['A', 'B', 'C'].map((letter) => button({ size: 'sm', label: letter }, letter)),
  )

const details = () =>
  stack(
    { gap: 2 },
    text({ weight: 'medium', size: 'sm' }, 'Filters'),
    text({ tone: 'secondary', size: 'sm' }, 'Contextual panel on the right.'),
  )

const embedded = (host) => {
  host.style.blockSize = '26rem'
  return host
}

export const sidebarAndTopNavbar = embedded(
  shell({ header: bar(), sidebar: menu() }, page()),
)

export const fullHeightSidebar = embedded(
  shell({ header: bar(), sidebar: menu(), headerSpan: 'content' }, page()),
)

export const railAndSecondarySidebar = embedded(
  shell({ header: bar(), rail: rail(), sidebar: menu(), headerSpan: 'content' }, page()),
)

export const withRightAside = embedded(
  shell({ header: bar(), sidebar: menu(), aside: details() }, page()),
)

export const withBottomNavigation = embedded(
  shell(
    { header: bar(), sidebar: menu(), bottomNav: menu('row') },
    page(),
  ),
)

export const contentOnly = embedded(shell(page()))

export const settingsUnderTheNav = embedded(
  shell(
    {
      header: bar(),
      sidebar: stack(
        { gap: 3 },
        menu(),
        form(
          { initialValues: { compact: false } },
          checkbox({ field: 'compact', label: 'Compact rows' }),
        ),
      ),
    },
    page(),
  ),
)

export const reportingTheDrawer = embedded(
  shell(
    {
      header: bar(),
      sidebar: menu(),
      events: { navToggle: (event) => console.log('drawer open:', event.detail.open) },
    },
    page(),
  ),
)

const furnishedSections = () => [
  { id: 'overview', label: 'Overview', href: '#overview', icon: icon({ name: 'home' }) },
  {
    id: 'reports',
    label: 'Reports',
    href: '#reports',
    icon: icon({ name: 'chart' }),
    tag: { text: 4 },
  },
  {
    id: 'orders',
    label: 'Orders',
    href: '#orders',
    icon: icon({ name: 'box' }),
    tag: { text: 12 },
  },
  { id: 'team', label: 'Team', href: '#team', icon: icon({ name: 'users' }) },
  {
    id: 'help',
    label: 'Send feedback',
    icon: icon({ name: 'help' }),
    onClick: ({ id }) => console.log('action row:', id),
  },
]

export const everythingTheShellShipsWith = embedded(
  shell(
    {
      headerSpan: 'content',
      header: flex(
        { horizontalAlign: 'justify', verticalAlign: 'center' },
        breadcrumbs({
          items: [
            { id: 'home', label: 'Home', href: '#home', icon: icon({ name: 'home', size: 'sm' }) },
            { id: 'reports', label: 'Reports', href: '#reports' },
            { id: 'q3', label: 'Q3 revenue' },
          ],
        }),
        flex(
          { verticalAlign: 'center', gap: 2 },
          themeSelect({ remember: false }),
          langSelect({ remember: false, languages: ['en', 'pl'] }),
          userCard({
            signedIn: true,
            name: 'Ada Lovelace',
            description: 'ada@example.com',
            onSignOut: () => console.log('sign out'),
          }),
        ),
      ),
      sidebar: stack(
        { gap: 4 },
        appLogo({
          label: 'Acme',
          tagline: 'Operations',
          icon: icon({ name: 'box', size: 'lg' }),
          href: '#home',
        }),
        navMenu({ label: 'Sections', selected: 'reports', items: furnishedSections() }),
      ),
    },
    page(),
  ),
)
