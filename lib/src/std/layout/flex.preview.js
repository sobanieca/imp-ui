import { flex } from 'imp/std/layout'
import { button, text } from 'imp/std'

export const name = 'Flex'
export const category = 'Layout'
export const description = "Run 'imp skill std/flex' to learn what flex can do before using it."

const cell = (label) => text(label)

export const rowOfItems = flex(cell('A'), cell('B'), cell('C'))

export const columnOfItems = flex({ direction: 'column' }, cell('A'), cell('B'), cell('C'))

export const columnOnPhoneRowOnDesktop = flex(
  { direction: { xs: 'column', md: 'row' }, gap: { xs: 2, md: 5 } },
  cell('First'),
  cell('Second'),
  cell('Third'),
)

export const spacedApart = flex(
  { justify: 'between', align: 'center' },
  text({ weight: 'bold' }, 'Total'),
  button({ variant: 'primary' }, 'Checkout'),
)

export const oneItemTakesTheRest = flex(
  { gap: 3 },
  flex({ grow: true }, text('This one grows')),
  button({ variant: 'ghost' }, 'Fixed'),
)

export const wrapping = flex(
  { wrap: true, gap: 2 },
  ...Array.from({ length: 12 }, (_unused, index) => button({ size: 'sm' }, `Tag ${index + 1}`)),
)

export const scrollingColumn = flex(
  { direction: 'column', gap: 2, scroll: true },
  ...Array.from({ length: 20 }, (_unused, index) => text(`Row ${index + 1}`)),
)
