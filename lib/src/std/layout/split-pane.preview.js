import { splitPane, stack } from 'imp/std/layout'
import { heading, text } from 'imp/std'
import { div } from 'imp/html'
import { groups } from '../preview-groups.js'

export const name = 'Split pane'
export const group = groups.layout

const pane = (title, body) =>
  div(
    { style: 'padding: var(--imp-space-4, 1rem)' },
    stack({ gap: 2 }, heading({ level: 3 }, title), text({ tone: 'secondary' }, body)),
  )

const framed = (content, height = '16rem') =>
  div({
    style: `block-size: ${height};
      border: 1px solid var(--imp-color-border, #e2e8f0);
      border-radius: var(--imp-radius-container, 12px);
      overflow: hidden`,
  }, content)

export const horizontal = {
  scenario: 'Side by side',
  component: framed(
    splitPane(
      { label: 'Resize the folder list' },
      pane('Folders', 'Drag the handle, or focus it and press the arrow keys.'),
      pane('Messages', 'The end pane takes the rest of the width.'),
    ),
  ),
}

export const vertical = {
  scenario: 'Stacked',
  component: framed(
    splitPane(
      { orientation: 'vertical', size: 60, min: 25, max: 75 },
      pane('Editor', 'Up and Down move the handle. Home and End jump to the limits.'),
      pane('Output', 'The share of the start pane stays between 25 and 75.'),
    ),
  ),
}

export const nested = {
  scenario: 'Three panes',
  component: framed(
    splitPane(
      { size: 25, label: 'Resize the navigation' },
      pane('Navigation', 'A splitPane in a pane makes a third pane.'),
      splitPane(
        { size: 60, label: 'Resize the details' },
        pane('List', 'Each handle has its own name.'),
        pane('Details', 'Each split keeps its own share.'),
      ),
    ),
  ),
}

export const rightToLeft = {
  scenario: 'Right to left',
  component: div(
    { dir: 'rtl' },
    framed(
      splitPane(
        { size: 30 },
        pane('Start pane', 'In a right-to-left page, the start pane is on the right.'),
        pane('End pane', 'ArrowLeft moves the handle to the left.'),
      ),
    ),
  ),
}
