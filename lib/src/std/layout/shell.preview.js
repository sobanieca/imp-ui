import { shell, stack } from 'imp/std/layout'
import { button, heading, text } from 'imp/std'
import { navMenu } from 'imp/std/navigation'
import { checkbox, form } from 'imp/std/inputs'
import { div } from 'imp/html'

export const name = 'Shell'
export const category = 'Layout'
export const description = "Run 'imp skill std/shell' to learn what shell can do before using it."

const sections = () => [
  { id: 'overview', label: 'Overview', href: '#overview' },
  { id: 'reports', label: 'Reports', href: '#reports', badge: 4 },
  { id: 'tasks', label: 'Tasks', href: '#tasks', badge: 12 },
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
