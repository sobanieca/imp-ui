import { app, footer, navbar, page, sidebar, stack } from 'imp/std/layout'
import { heading, text } from 'imp/std'
import { navMenu } from 'imp/std/navigation'

export const name = 'App'
export const category = 'Layout'
export const description = "Run 'imp skill std/app' to learn what app can do before using it."

const sections = (label) =>
  navMenu({
    label,
    selected: 'overview',
    items: [
      { id: 'overview', label: 'Overview' },
      { id: 'reports', label: 'Reports' },
      { id: 'settings', label: 'Settings' },
    ],
  })

const page = (title) =>
  stack(
    { gap: 3 },
    heading({ level: 1 }, title),
    text(
      'The app frame fills the viewport. Everything that is not a navbar, a sidebar or a footer ' +
        'is the main region, and that is the only part that scrolls.',
    ),
    ...Array.from(
      { length: 8 },
      (_unused, index) => text({ tone: 'secondary' }, `Paragraph ${index + 1} of the page body.`),
    ),
  )

export const full = app(
  navbar({ label: 'Top bar' }, text({ weight: 'bold' }, 'Acme'), text({ tone: 'secondary' }, 'v2')),
  sidebar({ side: 'left', label: 'Sections' }, sections('Sections')),
  sidebar({ side: 'right', label: 'Filters', width: 'sm' }, text('Filters live here.')),
  footer({ label: 'Page footer' }, text({ size: 'sm', tone: 'secondary' }, 'Acme Inc.')),
  page('Dashboard'),
)

export const contentOnly = app(page('No chrome at all'))

export const centered = app(
  { maxWidth: 'sm', padding: 5 },
  navbar({ label: 'Top bar' }, text({ weight: 'bold' }, 'Reader')),
  page('Centered content'),
)
