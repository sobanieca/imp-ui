import { grid, item, row } from 'imp/std/layout'
import { button, text } from 'imp/std'

export const growingChild = row(
  item({ grow: true }, text('I take the leftover space')),
  button('Go'),
)
export const weightedGrowth = row(
  item({ grow: 2 }, text('Twice as wide')),
  item({ grow: 1 }, text('Half as wide')),
)
export const gridSpan = grid(
  { columns: 12, gap: 3 },
  item({ span: 9 }, text('9')),
  item({ span: 3 }, text('3')),
)
export const pinnedToAColumn = grid(
  { columns: 4, gap: 3 },
  item({ start: 3, span: 2 }, text('Starts at column 3')),
)
export const reorderedOnPhones = row(
  { direction: { xs: 'column', md: 'row' } },
  item({ order: { xs: 1, md: 0 } }, text('Second on phones, first on desktop')),
  item({ order: { xs: 0, md: 1 } }, text('First on phones, second on desktop')),
)
export const selfAligned = row(
  { align: 'stretch' },
  text('Stretched'),
  item({ align: 'center' }, text('Centered')),
)
