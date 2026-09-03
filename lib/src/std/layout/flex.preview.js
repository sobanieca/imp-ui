import { flex } from 'imp/std/layout'
import { button, text } from 'imp/std'
import { div } from 'imp/html'

export const name = 'Flex'
export const group = 'Layout'
export const description = "Run 'imp skill std/flex' to learn what flex can do before using it."

const block = (label, height) =>
  div({
    style: `display: grid; place-items: center; block-size: ${height}; padding-inline: 1rem;
      background: var(--imp-color-surface-sunken, #f1f5f9);
      border: 1px solid var(--imp-color-border, #e2e8f0);
      border-radius: var(--imp-radius-item, 8px)`,
  }, label)

const tallAndShort =
  () => [block('tall', '5rem'), block('short', '2rem'), block('medium', '3.5rem')]

const framed = (row) =>
  div({
    style: `block-size: 7rem; padding: 0.5rem;
      border: 1px dashed var(--imp-color-border, #e2e8f0)`,
  }, row)

export const defaults = flex(button('Cancel'), button({ variant: 'primary' }, 'Save'))

export const alignedStart = framed(flex({ horizontalAlign: 'start' }, ...tallAndShort()))
export const alignedEnd = framed(flex({ horizontalAlign: 'end' }, ...tallAndShort()))
export const alignedCenter = framed(flex({ horizontalAlign: 'center' }, ...tallAndShort()))
export const justified = framed(flex({ horizontalAlign: 'justify' }, ...tallAndShort()))

export const alignedTop = framed(flex({ verticalAlign: 'top' }, ...tallAndShort()))
export const alignedBottom = framed(flex({ verticalAlign: 'bottom' }, ...tallAndShort()))
export const alignedMiddle = framed(flex({ verticalAlign: 'center' }, ...tallAndShort()))
export const stretched = framed(
  flex({ verticalAlign: 'stretch' }, block('a', 'auto'), block('b', 'auto')),
)

export const noGap = flex({ gap: 0 }, ...tallAndShort())
export const wideGap = flex({ gap: 6 }, ...tallAndShort())

export const wrapping = flex(
  { wrap: true, gap: 2 },
  ...['design', 'billing', 'onboarding', 'analytics', 'notifications', 'permissions', 'exports']
    .map((tag) => block(tag, '2rem')),
)

export const rowOfText = flex(
  { verticalAlign: 'center', gap: 4 },
  text({ weight: 'bold' }, 'Invoices'),
  text({ tone: 'secondary', size: 'sm' }, '12 unpaid'),
)
