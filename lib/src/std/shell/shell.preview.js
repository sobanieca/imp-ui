import { appMap } from 'imp'
import { flex, stack } from 'imp/std/layout'
import { button, heading, icon, menuButton, text } from 'imp/std'
import { div, el } from 'imp/html'
import {
  luBox,
  luChartColumn,
  luCheck,
  luCircleQuestionMark,
  luClock,
  luCreditCard,
  luDownload,
  luLifeBuoy,
  luMail,
  luSettings,
  luTag,
  luUser,
  luUsers,
} from 'imp/icons'
import { appLogo, langSelect, shell, themeSelect, userCard } from 'imp/std/shell'
import { router } from 'imp/router'
import { groups } from '../preview-groups.js'

export const name = 'Shell'
export const group = groups.shell

const app = appMap({
  reports: {
    description: 'How the business is doing',
    money: {
      description: 'What came in and what went out',
      revenue: 'Money that came in, per month',
      costs: {
        description: 'Money that went out',
        fixed: 'Rent, salaries and licences',
        usage: 'Cloud and metered services',
      },
      forecast: 'The next two quarters',
    },
    people: {
      description: 'Who joins, who leaves, and what they take',
      churn: 'Customers who left',
      headcount: 'People per team',
      exports: 'A CSV file of every report',
    },
  },
  orders: {
    open: 'Orders that wait to ship',
    shipped: 'Orders on their way',
  },
  directory: 'Everyone in the company',
  settings: 'The account and the team',
  help: 'Guides and answers',
})

const revenue = () =>
  stack(
    { gap: 3 },
    heading({ level: 1 }, 'Revenue'),
    text({ tone: 'secondary' }, 'Everything the team shipped this quarter.'),
  )

const routes = () => router({ map: app, screens: { [app.reports.money.revenue]: revenue } })

const nav = () => ({
  [app.reports]: { icon: luChartColumn },
  [app.reports.money]: { group: true },
  [app.reports.money.revenue]: { icon: luChartColumn },
  [app.reports.money.costs]: { icon: luCreditCard },
  [app.reports.money.costs.fixed]: { icon: luTag },
  [app.reports.money.costs.usage]: { icon: luClock },
  [app.reports.money.forecast]: { icon: luClock },
  [app.reports.people]: { group: true },
  [app.reports.people.churn]: { icon: luUsers, tag: { text: 'new', color: 'green' } },
  [app.reports.people.headcount]: { icon: luUser },
  [app.reports.people.exports]: { icon: luDownload },
  [app.orders]: { icon: luBox },
  [app.orders.open]: { icon: luMail, tag: { text: 12 } },
  [app.orders.shipped]: { icon: luCheck },
  [app.directory]: { icon: luUsers },
  [app.settings]: { icon: luSettings },
  [app.help]: { icon: luCircleQuestionMark },
})

const navbar = () => ({ label: 'Sections' })

const sidebar = () => ({ label: 'Pages' })

const support = () =>
  stack(
    { gap: 1 },
    text({ weight: 'bold', size: 'sm' }, 'Need a hand?'),
    text({ tone: 'secondary', size: 'sm' }, 'Support answers within a day.'),
    button({ size: 'sm' }, icon(luLifeBuoy), 'Contact support'),
  )

const brand = () =>
  appLogo({ label: 'Acme', tagline: 'Operations', icon: icon(luBox, { size: 'lg' }) })

const ada = () =>
  flex(
    { gap: 1, verticalAlign: 'center' },
    userCard({ name: 'Ada Lovelace', description: 'ada@example.com' }),
    menuButton({
      size: 'sm',
      variant: 'ghost',
      label: 'Account',
      items: [{ id: 'sign-out', label: 'Sign out', onClick: () => console.log('sign out') }],
    }),
  )

const painted = (host, background) => {
  host.style.setProperty('--imp-background-app', background)
  return host
}

const extras = (card = ada()) => [
  themeSelect({ remember: false }),
  langSelect({ remember: false, languages: ['en', 'pl'] }),
  card,
]

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
    drift('var(--imp-color-violet, #c084fc)', '22rem', '55%', '30%', 12),
    drift('var(--imp-color-teal, #6ee7b7)', '14rem', '25%', '70%', 7),
  )

const wash = (color, angle) =>
  div({
    style: `background: linear-gradient(${angle}, ${color} 0%, transparent 65%); opacity: 0.6`,
  })

export const navbarAndSidebar = {
  scenario: 'Navbar and sidebar',
  frame: app.reports.money.revenue,
  component: () =>
    shell(
      {
        map: app,
        nav: nav(),
        logo: brand(),
        navbar: navbar(),
        sidebar: sidebar(),
        extras: extras(),
      },
      routes(),
    ),
}

export const sectionWithoutASidebar = {
  scenario: 'Section without a sidebar',
  frame: app.directory,
  component: () =>
    shell(
      { map: app, nav: nav(), logo: brand(), navbar: navbar(), sidebar: sidebar(), extras: ada() },
      routes(),
    ),
}

export const withoutTheBar = {
  scenario: 'Without the bar',
  frame: app.reports.money.revenue,
  component: () =>
    shell(
      {
        map: app,
        nav: nav(),
        logo: brand(),
        navbar: false,
        sidebar: { ...sidebar(), extras: support() },
        extras: extras(),
      },
      routes(),
    ),
}

export const groupHeadingsWithoutTheBar = {
  scenario: 'Group headings without the bar',
  frame: app.reports.money.revenue,
  component: () =>
    shell(
      {
        map: app,
        nav: { ...nav(), [app.reports]: { group: true }, [app.orders]: { group: true } },
        logo: brand(),
        navbar: false,
        sidebar: sidebar(),
        extras: extras(),
      },
      routes(),
    ),
}

export const sidebarExtrasStayInEverySection = {
  scenario: 'Sidebar extras stay in every section',
  frame: app.directory,
  component: () =>
    shell(
      {
        map: app,
        nav: nav(),
        logo: brand(),
        navbar: navbar(),
        sidebar: { ...sidebar(), extras: support() },
        extras: extras(),
      },
      routes(),
    ),
}

export const centredOnAWideScreen = {
  scenario: 'Centred on a wide screen',
  frame: app.reports.money.revenue,
  component: () =>
    shell(
      {
        map: app,
        nav: nav(),
        logo: brand(),
        navbar: navbar(),
        sidebar: sidebar(),
        extras: extras(),
        maxWidth: '64rem',
      },
      routes(),
    ),
}

export const gappedAndRounded = {
  scenario: 'Gapped and rounded',
  frame: app.reports.money.revenue,
  component: () =>
    shell(
      {
        map: app,
        nav: nav(),
        logo: brand(),
        navbar: navbar(),
        sidebar: sidebar(),
        extras: extras(),
        gap: 3,
      },
      routes(),
    ),
}

export const gradientFromTheTheme = {
  scenario: 'Gradient from the theme',
  frame: app.reports.money.revenue,
  component: () =>
    painted(
      shell(
        {
          map: app,
          nav: nav(),
          logo: brand(),
          navbar: navbar(),
          sidebar: sidebar(),
          extras: extras(),
          gap: 3,
        },
        routes(),
      ),
      'linear-gradient(135deg, var(--imp-color-sky, #7dd3fc) 0%, var(--imp-color-surface, #fff) 55%)',
    ),
}

export const animatedBackground = {
  scenario: 'Animated background',
  frame: app.reports.money.revenue,
  component: () =>
    shell(
      {
        map: app,
        nav: nav(),
        logo: brand(),
        navbar: navbar(),
        sidebar: sidebar(),
        extras: extras(),
        gap: 4,
        background: animated(),
      },
      routes(),
    ),
}

export const paintedBarAndColumn = {
  scenario: 'Painted bar and column',
  frame: app.reports.money.revenue,
  component: () =>
    shell(
      {
        map: app,
        nav: nav(),
        logo: brand(),
        navbar: { ...navbar(), background: wash('var(--imp-color-sky, #7dd3fc)', '90deg') },
        sidebar: { ...sidebar(), background: wash('var(--imp-color-teal, #6ee7b7)', '180deg') },
        extras: extras(),
        gap: 3,
      },
      routes(),
    ),
}

export const contentOnly = {
  scenario: 'Content only',
  frame: app.reports.money.revenue,
  component: () => shell(routes()),
}

export const reportingTheDrawer = {
  scenario: 'Reporting the drawer',
  frame: app.reports.money.revenue,
  component: () =>
    shell(
      {
        map: app,
        nav: nav(),
        logo: brand(),
        navbar: navbar(),
        sidebar: sidebar(),
        extras: ada(),
        events: { navToggle: (event) => console.log('drawer open:', event.detail.open) },
      },
      routes(),
    ),
}
