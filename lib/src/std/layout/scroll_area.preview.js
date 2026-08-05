import { row, scrollArea, stack } from 'imp/std/layout'
import { text } from 'imp/std'

export const name = 'Scroll area'
export const category = 'Layout'
export const description =
  "Run 'imp skill std/scrollArea' to learn what scrollArea can do before using it."

const lines = (count) => Array.from({ length: count }, (_, index) => text(`Line ${index + 1}`))

export const verticalScroll = scrollArea(
  { maxHeight: '10rem', label: 'Activity' },
  stack(...lines(30)),
)
export const horizontalScroll = scrollArea(
  { axis: 'horizontal', maxWidth: '20rem', label: 'Columns' },
  row({ gap: 4 }, ...lines(20)),
)
export const bothAxes = scrollArea(
  { axis: 'both', maxHeight: '10rem', maxWidth: '20rem', label: 'Grid' },
  stack(...lines(30)),
)
export const tallerOnDesktop = scrollArea(
  { maxHeight: { xs: '8rem', lg: '20rem' }, label: 'Log' },
  stack(...lines(30)),
)
