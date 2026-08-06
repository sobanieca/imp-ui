import { app, flex, sidebar } from 'imp/std/layout'
import { heading, text } from 'imp/std'
import { navMenu } from 'imp/std/navigation'

export const name = 'Sidebar'
export const category = 'Layout'
export const description =
  "Run 'imp skill std/sidebar' to learn what sidebar can do before using it."

const sections = (label) =>
  navMenu({
    label,
    selected: 'inbox',
    items: [
      { id: 'inbox', label: 'Inbox' },
      { id: 'sent', label: 'Sent' },
      { id: 'archive', label: 'Archive' },
    ],
  })

const body = (title) =>
  flex(
    { direction: 'column', gap: 3 },
    heading({ level: 2 }, title),
    text('Narrow the stage below 48rem to see every sidebar turn into an edge tab and a drawer.'),
  )

export const both = app(
  sidebar({ side: 'left', label: 'Sections' }, sections('Sections')),
  sidebar({ side: 'right', label: 'Details', width: 'sm' }, text('Details about the selection.')),
  body('One on each side'),
)

export const stacked = app(
  sidebar({ side: 'left', label: 'Sections', width: 'sm' }, sections('Sections')),
  sidebar({ side: 'left', label: 'Filters', width: 'sm' }, text('Filters.')),
  sidebar({ side: 'right', label: 'Activity', width: 'sm' }, text('Recent activity.')),
  body('Two on the left, one on the right'),
)

export const startsCollapsed = app(
  sidebar({ side: 'left', label: 'Sections', collapsed: true }, sections('Sections')),
  body('Collapsed to its rail until you open it'),
)

export const fixed = app(
  sidebar({ side: 'left', label: 'Sections', collapsible: false }, sections('Sections')),
  body('No rail on a wide screen - narrow the stage and it still has its drawer tab'),
)

export const resizable = app(
  sidebar(
    { side: 'left', label: 'Sections', resizable: true, minWidth: 'xs', maxWidth: 'lg' },
    sections('Sections'),
  ),
  body('Drag the edge, or focus it and use the arrow keys - double click puts it back'),
)
