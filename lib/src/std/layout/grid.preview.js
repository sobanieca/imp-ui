import { grid } from 'imp/std/layout'
import { text } from 'imp/std'

export const name = 'Grid'
export const category = 'Layout'
export const description = "Run 'imp skill std/grid' to learn what grid can do before using it."

const cell = (label) => text({ align: 'center' }, label)

export const twoColumns = grid({ columns: 2 }, cell('A'), cell('B'), cell('C'), cell('D'))
export const threeColumns = grid({ columns: 3 }, cell('A'), cell('B'), cell('C'))
export const responsiveColumns = grid(
  { columns: { xs: 1, sm: 2, lg: 4 }, gap: 4 },
  cell('A'),
  cell('B'),
  cell('C'),
  cell('D'),
)
export const fitAsManyAsFit = grid(
  { minItemWidth: '12rem', gap: 4 },
  cell('A'),
  cell('B'),
  cell('C'),
  cell('D'),
  cell('E'),
)
export const centeredCells = grid(
  { columns: 3, gap: 4, align: 'center', justify: 'center' },
  cell('A'),
  cell('B'),
  cell('C'),
)
