import { column } from 'imp/std/layout'
import { button, heading, text } from 'imp/std'
import { div } from 'imp/html'

export const name = 'Column'
export const category = 'Layout'
export const description = "Run 'imp skill std/column' to learn what column can do before using it."

const block = (label) =>
  div({
    style: `display: grid; place-items: center; padding: 0.75rem 1rem;
      background: var(--imp-color-surface-sunken, #f1f5f9);
      border: 1px solid var(--imp-color-border, #e2e8f0);
      border-radius: var(--imp-radius-md, 8px)`,
  }, label)

const framed = (stack) =>
  div({ style: 'border: 1px dashed var(--imp-color-border, #e2e8f0); padding: 0.5rem' }, stack)

export const defaults = column(
  heading({ level: 2 }, 'Billing'),
  text({ tone: 'secondary' }, 'Your plan renews on the 1st.'),
  button({ variant: 'primary' }, 'Upgrade'),
)

export const stretched = framed(column(block('stretch'), block('is the default')))
export const alignedLeft = framed(column({ horizontalAlign: 'left' }, block('left'), block('left')))
export const alignedRight = framed(
  column({ horizontalAlign: 'right' }, block('right'), block('right')),
)
export const alignedCenter = framed(
  column({ horizontalAlign: 'center' }, block('center'), block('center')),
)

export const noGap = column({ gap: 0 }, block('flush'), block('together'))
export const wideGap = column({ gap: 6 }, block('far'), block('apart'))

export const centeredEmptyState = column(
  { horizontalAlign: 'center', gap: 2 },
  heading({ level: 3 }, 'No invoices yet'),
  text({ tone: 'secondary' }, 'They appear here once you send one.'),
  button('Create an invoice'),
)
