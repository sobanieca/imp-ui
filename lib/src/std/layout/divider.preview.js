import { divider, row, stack } from 'imp/std/layout'
import { button, text } from 'imp/std'

export const name = 'Divider'
export const category = 'Layout'
export const description =
  "Run 'imp skill std/divider' to learn what divider can do before using it."

export const plain = stack(text('Above'), divider(), text('Below'))
export const labelled = stack(
  button({ block: true }, 'Sign in'),
  divider('or'),
  button({ block: true }, 'Use SSO'),
)
export const tightSpacing = stack(text('Above'), divider({ spacing: 1 }), text('Below'))
export const vertical = row(
  { align: 'center' },
  text('Home'),
  divider({ orientation: 'vertical' }),
  text('Billing'),
)
