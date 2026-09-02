import { shell, stack } from 'imp/std/layout'
import { button, heading, icon, text } from 'imp/std'
import { div, el } from 'imp/html'
import {
  luBox,
  luChartColumn,
  luCheck,
  luCircleQuestionMark,
  luClock,
  luCreditCard,
  luDownload,
  luLayoutGrid,
  luLifeBuoy,
  luMail,
  luSettings,
  luTag,
  luUser,
  luUsers,
} from 'imp/icons'
import { appLogo, breadcrumbs, langSelect, themeSelect } from 'imp/std/shell'

export const name = 'Shell'
export const group = 'Shell'
export const description = "Run 'imp skill std/shell' to learn what shell can do before using it."

const reports = () => ({
  id: 'reports',
  label: 'Reports',
  icon: icon(luChartColumn),
  groups: [
    {
      label: 'Money',
      items: [
        { id: 'revenue', label: 'Revenue', href: '#revenue', icon: icon(luChartColumn) },
        {
          id: 'costs',
          label: 'Costs',
          href: '#costs',
          icon: icon(luCreditCard),
          children: [
            { id: 'costs-fixed', label: 'Fixed', href: '#fixed', icon: icon(luTag) },
            { id: 'costs-usage', label: 'Usage', href: '#usage', icon: icon(luClock) },
          ],
        },
        { id: 'forecast', label: 'Forecast', href: '#forecast', icon: icon(luClock) },
      ],
    },
    {
      label: 'People',
      items: [
        {
          id: 'churn',
          label: 'Churn',
          href: '#churn',
          icon: icon(luUsers),
          tag: { text: 'new', color: 'green' },
        },
        { id: 'headcount', label: 'Headcount', href: '#headcount', icon: icon(luUser) },
        { id: 'exports', label: 'Exports', href: '#exports', icon: icon(luDownload) },
      ],
    },
  ],
})

const orders = () => ({
  id: 'orders',
  label: 'Orders',
  icon: icon(luBox),
  items: [
    { id: 'open', label: 'Open', href: '#open', icon: icon(luMail), tag: { text: 12 } },
    { id: 'shipped', label: 'Shipped', href: '#shipped', icon: icon(luCheck) },
  ],
})

const directory = () => ({
  id: 'directory',
  label: 'Directory',
  href: '#directory',
  icon: icon(luUsers),
})

const top = (selected = 'reports') => ({
  label: 'Sections',
  selected,
  items: [reports(), orders(), directory()],
})

const side = (selected = 'revenue') => ({ label: 'Reports', selected })

const support = () =>
  stack(
    { gap: 1 },
    text({ weight: 'medium', size: 'sm' }, 'Need a hand?'),
    text({ tone: 'secondary', size: 'sm' }, 'Support answers within a day.'),
    button({ size: 'sm' }, icon(luLifeBuoy), 'Contact support'),
  )

const standalone = () => ({
  label: 'Reports',
  selected: 'revenue',
  groups: [
    {
      label: 'Money',
      items: [
        { id: 'overview', label: 'Overview', href: '#overview', icon: icon(luLayoutGrid) },
        { id: 'revenue', label: 'Revenue', href: '#revenue', icon: icon(luChartColumn) },
      ],
    },
    {
      label: 'People',
      items: [
        { id: 'churn', label: 'Churn', href: '#churn', icon: icon(luUsers) },
      ],
    },
  ],
  footer: [
    { id: 'settings', label: 'Settings', href: '#settings', icon: icon(luSettings) },
    { id: 'help', label: 'Help & docs', href: '#help', icon: icon(luCircleQuestionMark) },
  ],
})

const brand = () =>
  appLogo({ label: 'Acme', tagline: 'Operations', icon: icon(luBox, { size: 'lg' }) })

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

const embedded = (host) => {
  host.style.blockSize = '30rem'
  return host
}

const painted = (host, background) => {
  host.style.setProperty('--imp-background-app', background)
  return embedded(host)
}

const extras =
  () => [themeSelect({ remember: false }), langSelect({ remember: false, languages: ['en', 'pl'] })]

const drift = (color, size, x, y, seconds) =>
  div({
    style: `position: absolute; inset-inline-start: ${x}; inset-block-start: ${y};
      inline-size: ${size}; block-size: ${size}; border-radius: 50%; opacity: 0.35;
      background: ${color}; filter: blur(40px);
      animation: shell-preview-drift ${seconds}s ease-in-out infinite alternate`,
  })

const animated = () =>
  div(
    { style: 'position: relative; overflow: hidden' },
    el(
      'style',
      `@keyframes shell-preview-drift { to { translate: 12% 18% } }
       @media (prefers-reduced-motion: reduce) { * { animation: none !important } }`,
    ),
    drift('var(--imp-color-sky, #7dd3fc)', '18rem', '-4rem', '-6rem', 9),
    drift('var(--imp-color-plum, #c084fc)', '22rem', '55%', '30%', 12),
    drift('var(--imp-color-mint, #6ee7b7)', '14rem', '25%', '70%', 7),
  )

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

export const sidebarExtrasStayInEverySection = embedded(
  shell(
    {
      logo: brand(),
      navbar: top('directory'),
      sidebar: { ...side(null), extras: support() },
      extras: extras(),
      account: ada,
    },
    page(),
  ),
)

export const gappedAndRounded = embedded(
  shell(
    {
      logo: brand(),
      navbar: top(),
      sidebar: side(),
      extras: extras(),
      account: ada,
      gap: 3,
    },
    page(),
  ),
)

export const gradientFromTheTheme = painted(
  shell(
    { logo: brand(), navbar: top(), sidebar: side(), extras: extras(), account: ada, gap: 3 },
    page(),
  ),
  'linear-gradient(135deg, var(--imp-color-sky, #7dd3fc) 0%, var(--imp-color-surface, #fff) 55%)',
)

export const animatedBackground = embedded(
  shell(
    {
      logo: brand(),
      navbar: top(),
      sidebar: side(),
      extras: extras(),
      account: ada,
      gap: 4,
      background: animated(),
    },
    page(),
  ),
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
