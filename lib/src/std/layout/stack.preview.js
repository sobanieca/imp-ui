import { stack } from 'imp/std/layout'
import { button, heading, text } from 'imp/std'
import { div } from 'imp/html'

export const name = 'Stack'
export const group = 'Layout'
export const description = "Run 'imp skill std/stack' to learn what stack can do before using it."

const block = (label) =>
  div({
    style: `display: grid; place-items: center; padding-block: 0.75rem; padding-inline: 1rem;
      background: var(--imp-color-surface-sunken, #f1f5f9);
      border: 1px solid var(--imp-color-border, #e2e8f0);
      border-radius: var(--imp-radius-item, 8px)`,
  }, label)

const uneven =
  () => [block('Short'), block('A wider block'), block('The widest block of the three')]

const framed = (content) =>
  div({ style: 'border: 1px dashed var(--imp-color-border, #e2e8f0); padding: 0.5rem' }, content)

export const defaults = stack(
  heading({ level: 2 }, 'Billing'),
  text({ tone: 'secondary' }, 'Your plan renews on the 1st.'),
  button({ variant: 'primary' }, 'Upgrade'),
)

export const stretched = framed(stack(...uneven()))
export const alignedStart = framed(stack({ horizontalAlign: 'start' }, ...uneven()))
export const alignedEnd = framed(stack({ horizontalAlign: 'end' }, ...uneven()))
export const alignedCenter = framed(stack({ horizontalAlign: 'center' }, ...uneven()))

export const noGap = stack({ gap: 0 }, block('flush'), block('together'))
export const wideGap = stack({ gap: 6 }, block('far'), block('apart'))

export const centeredEmptyState = stack(
  { horizontalAlign: 'center', gap: 2 },
  heading({ level: 3 }, 'No invoices yet'),
  text({ tone: 'secondary' }, 'They appear here once you send one.'),
  button('Create an invoice'),
)
