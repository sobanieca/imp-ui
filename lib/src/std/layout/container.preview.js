import { container, stack } from 'imp/std/layout'
import { heading, text } from 'imp/std'

export const name = 'Container'
export const category = 'Layout'
export const description =
  "Run 'imp skill std/container' to learn what container can do before using it."

const article = () => stack(heading('Billing'), text('Your plan renews on the 1st of every month.'))

export const defaultSize = container(article())
export const small = container({ size: 'sm' }, article())
export const extraLarge = container({ size: 'xl' }, article())
export const full = container({ size: 'full' }, article())
export const noPadding = container({ padding: 0 }, article())
export const responsivePadding = container({ padding: { xs: 2, lg: 6 } }, article())
