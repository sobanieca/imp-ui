import { toolbar } from 'imp/std/layout'
import { button, text } from 'imp/std'
import { select } from 'imp/std/inputs'

const actions = () => [
  button({ variant: 'ghost', size: 'sm' }, 'Undo'),
  button({ variant: 'ghost', size: 'sm' }, 'Redo'),
  button({ size: 'sm' }, 'Save'),
]

export const plain = toolbar({ label: 'Document actions' }, ...actions())

export const surface = toolbar({ label: 'Document actions', variant: 'surface' }, ...actions())

export const vertical = toolbar(
  { label: 'Document actions', orientation: 'vertical', variant: 'surface', align: 'stretch' },
  ...actions(),
)

export const spreadApart = toolbar(
  { label: 'Editor', variant: 'surface', justify: 'between' },
  text({ weight: 'medium' }, 'report.md'),
  select({ ariaLabel: 'Zoom', options: ['100%', '150%', '200%'] }),
)

export const wrapping = toolbar(
  { label: 'Formatting', variant: 'surface', wrap: true },
  ...Array.from({ length: 10 }, (_unused, index) => button({ size: 'sm' }, `Tool ${index + 1}`)),
)
