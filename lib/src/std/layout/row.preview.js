import { row, spacer } from 'imp/std/layout'
import { button, heading, text } from 'imp/std'

export const name = 'Row'
export const category = 'Layout'
export const description = "Run 'imp skill std/row' to learn what row can do before using it."

export const defaultRow = row(button('One'), button('Two'), button('Three'))
export const centeredWithSpacer = row(
  { align: 'center' },
  heading('Invoices'),
  spacer(),
  button({ variant: 'primary' }, 'New'),
)
export const spaceBetween = row({ justify: 'between' }, text('Left'), text('Right'))
export const wrapping = row(
  { wrap: true, gap: 2 },
  ...Array.from({ length: 12 }, (_, index) => button(`Tag ${index + 1}`)),
)
export const stacksOnPhones = row(
  { direction: { xs: 'column', sm: 'row' }, gap: 3 },
  button('Cancel'),
  button({ variant: 'primary' }, 'Save'),
)
