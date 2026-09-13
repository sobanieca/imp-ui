import { stack } from 'imp/std/layout'
import { button, heading, text } from 'imp/std'
import { div } from 'imp/html'
import { groups } from '../preview-groups.js'

export const name = 'Stack'
export const group = groups.layout

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

export const defaults = {
  scenario: 'Defaults',
  component: stack(
    heading({ level: 2 }, 'Billing'),
    text({ tone: 'secondary' }, 'Your plan renews on the 1st.'),
    button({ variant: 'primary' }, 'Upgrade'),
  ),
}

export const stretched = { scenario: 'Stretched', component: framed(stack(...uneven())) }
export const alignedStart = {
  scenario: 'Aligned to the start',
  component: framed(stack({ horizontalAlign: 'start' }, ...uneven())),
}
export const alignedEnd = {
  scenario: 'Aligned to the end',
  component: framed(stack({ horizontalAlign: 'end' }, ...uneven())),
}
export const alignedCenter = {
  scenario: 'Aligned to the center',
  component: framed(stack({ horizontalAlign: 'center' }, ...uneven())),
}

const tall = (content) => {
  content.style.blockSize = '16rem'
  return framed(content)
}

export const justified = {
  scenario: 'Justified in a tall parent',
  component: tall(stack({ verticalAlign: 'justify' }, block('Top'), block('Bottom'))),
}
export const alignedBottom = {
  scenario: 'Aligned to the bottom',
  component: tall(stack({ verticalAlign: 'bottom' }, ...uneven())),
}

export const noGap = {
  scenario: 'No gap',
  component: stack({ gap: 0 }, block('flush'), block('together')),
}
export const wideGap = {
  scenario: 'Wide gap',
  component: stack({ gap: 6 }, block('far'), block('apart')),
}

export const centeredEmptyState = {
  scenario: 'Centered empty state',
  component: stack(
    { horizontalAlign: 'center', gap: 2 },
    heading({ level: 3 }, 'No invoices yet'),
    text({ tone: 'secondary' }, 'They appear here once you send one.'),
    button('Create an invoice'),
  ),
}
