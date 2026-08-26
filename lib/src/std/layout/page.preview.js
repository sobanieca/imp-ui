import { page, stack } from 'imp/std/layout'
import { heading, text } from 'imp/std'

export const name = 'Page'
export const category = 'Layout'
export const description = "Run 'imp skill std/page' to learn what page can do before using it."

const body = () => [
  heading({ level: 2 }, 'A page needs no props'),
  text(
    'Its inline and block padding come from the theme and grow with the viewport, and it caps ' +
      'itself at a readable measure and centres what is left.',
  ),
]

export const zeroConfig = page(...body())

export const narrowMeasure = page({ size: 'sm' }, ...body())

export const fullWidth = page({ size: 'full' }, ...body())

export const surface = page(
  { size: 'md', background: 'surface', border: true, radius: 'lg' },
  stack(...body(), stack({ direction: 'row' }, text('One'), text('Two'), text('Three'))),
)
