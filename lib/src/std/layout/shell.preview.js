import { shell, stack } from 'imp/std/layout'
import { heading, icon, text } from 'imp/std'
import { appLogo, breadcrumbs, langSelect, themeSelect } from 'imp/std/shell'

export const name = 'Shell'
export const category = 'Layout'
export const description = "Run 'imp skill std/shell' to learn what shell can do before using it."

const reports = () => ({
  id: 'reports',
  label: 'Reports',
  icon: icon({ name: 'chart' }),
  groups: [
    {
      label: 'Money',
      items: [
        { id: 'revenue', label: 'Revenue', href: '#revenue', icon: icon({ name: 'chart' }) },
        {
          id: 'costs',
          label: 'Costs',
          href: '#costs',
          icon: icon({ name: 'credit-card' }),
          children: [
            { id: 'costs-fixed', label: 'Fixed', href: '#fixed', icon: icon({ name: 'tag' }) },
            { id: 'costs-usage', label: 'Usage', href: '#usage', icon: icon({ name: 'clock' }) },
          ],
        },
        { id: 'forecast', label: 'Forecast', href: '#forecast', icon: icon({ name: 'clock' }) },
      ],
    },
    {
      label: 'People',
      items: [
        {
          id: 'churn',
          label: 'Churn',
          href: '#churn',
          icon: icon({ name: 'users' }),
          tag: { text: 'new', color: 'green' },
        },
        { id: 'headcount', label: 'Headcount', href: '#headcount', icon: icon({ name: 'user' }) },
        { id: 'exports', label: 'Exports', href: '#exports', icon: icon({ name: 'download' }) },
      ],
    },
  ],
})

const orders = () => ({
  id: 'orders',
  label: 'Orders',
  icon: icon({ name: 'box' }),
  items: [
    { id: 'open', label: 'Open', href: '#open', icon: icon({ name: 'mail' }), tag: { text: 12 } },
    { id: 'shipped', label: 'Shipped', href: '#shipped', icon: icon({ name: 'check' }) },
  ],
})

const directory = () => ({
  id: 'directory',
  label: 'Directory',
  href: '#directory',
  icon: icon({ name: 'users' }),
})

const top = (selected = 'reports') => ({
  label: 'Sections',
  selected,
  items: [reports(), orders(), directory()],
})

const side = (selected = 'revenue') => ({ label: 'Reports', selected })

const standalone = () => ({
  label: 'Reports',
  selected: 'revenue',
  groups: [
    {
      label: 'Money',
      items: [
        { id: 'overview', label: 'Overview', href: '#overview', icon: icon({ name: 'grid' }) },
        { id: 'revenue', label: 'Revenue', href: '#revenue', icon: icon({ name: 'chart' }) },
      ],
    },
    {
      label: 'People',
      items: [
        { id: 'churn', label: 'Churn', href: '#churn', icon: icon({ name: 'users' }) },
      ],
    },
  ],
  footer: [
    { id: 'settings', label: 'Settings', href: '#settings', icon: icon({ name: 'settings' }) },
    { id: 'help', label: 'Help & docs', href: '#help', icon: icon({ name: 'help' }) },
  ],
})

const brand = () =>
  appLogo({ label: 'Acme', tagline: 'Operations', icon: icon({ name: 'box', size: 'lg' }) })

const ada = {
  name: 'Ada Lovelace',
  description: 'ada@example.com',
  onSignIn: () => console.log('sign in'),
  onSignOut: () => console.log('sign out'),
}

const page = () =>
  stack(
    { gap: 3 },
    breadcrumbs({
      items: [
        { id: 'reports', label: 'Reports', href: '#reports' },
        { id: 'revenue', label: 'Revenue' },
      ],
    }),
    heading({ level: 1 }, 'Revenue'),
    text({ tone: 'secondary' }, 'Everything the team shipped this quarter.'),
  )

const details = () =>
  stack(
    { gap: 2 },
    text({ weight: 'medium', size: 'sm' }, 'Filters'),
    text({ tone: 'secondary', size: 'sm' }, 'Contextual panel on the right.'),
  )

const embedded = (host) => {
  host.style.blockSize = '30rem'
  return host
}

const extras =
  () => [themeSelect({ remember: false }), langSelect({ remember: false, languages: ['en', 'pl'] })]

export const navbarAndSidebar = embedded(
  shell(
    { logo: brand(), navbar: top(), sidebar: side(), extras: extras(), account: ada },
    page(),
  ),
)

export const sectionWithoutASidebar = embedded(
  shell(
    { logo: brand(), navbar: top('directory'), sidebar: side(null), account: ada },
    page(),
  ),
)

export const sidebarOnly = embedded(
  shell({ logo: brand(), sidebar: standalone(), extras: extras(), account: ada }, page()),
)

export const withRightAside = embedded(
  shell({ logo: brand(), navbar: top(), sidebar: side(), account: ada, aside: details() }, page()),
)

export const signedOut = embedded(
  shell(
    { logo: brand(), navbar: top(), sidebar: side(), account: ada, signedIn: false },
    stack({ gap: 3 }, heading({ level: 1 }, 'Welcome'), text('Sign in to see your reports.')),
  ),
)

export const contentOnly = embedded(shell(page()))

export const reportingTheDrawer = embedded(
  shell(
    {
      logo: brand(),
      navbar: top(),
      sidebar: side(),
      account: ada,
      events: { navToggle: (event) => console.log('drawer open:', event.detail.open) },
    },
    page(),
  ),
)
