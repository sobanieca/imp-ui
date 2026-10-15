import { flex } from 'imp/std/layout'
import { button, icon, menuButton, text } from 'imp/std'
import { textField } from 'imp/std/inputs'
import { luChevronLeft, luChevronRight } from 'imp/icons'
import { div } from 'imp/html'
import { groups } from '../preview-groups.js'

export const name = 'Flex'
export const group = groups.layout

const block = (label, height) =>
  div(
    {
      style: `display: grid; place-items: center; block-size: ${height}; padding-inline: 1rem;
      background: var(--imp-color-surface-sunken, #f1f5f9);
      border: 1px solid var(--imp-color-border, #e2e8f0);
      border-radius: var(--imp-radius-item, 8px)`,
    },
    label,
  )

const tallAndShort = () => [
  block('tall', '5rem'),
  block('short', '2rem'),
  block('medium', '3.5rem'),
]

const framed = (row) =>
  div(
    {
      style: `block-size: 7rem; padding: 0.5rem;
      border: 1px dashed var(--imp-color-border, #e2e8f0)`,
    },
    row,
  )

export const defaults = {
  scenario: 'Defaults',
  component: flex(button('Cancel'), button({ variant: 'primary' }, 'Save')),
}

export const alignedStart = {
  scenario: 'Aligned to the start',
  component: framed(flex({ horizontalAlign: 'start' }, ...tallAndShort())),
}
export const alignedEnd = {
  scenario: 'Aligned to the end',
  component: framed(flex({ horizontalAlign: 'end' }, ...tallAndShort())),
}
export const alignedCenter = {
  scenario: 'Aligned to the center',
  component: framed(flex({ horizontalAlign: 'center' }, ...tallAndShort())),
}
export const justified = {
  scenario: 'Justified',
  component: framed(flex({ horizontalAlign: 'justify' }, ...tallAndShort())),
}

export const alignedTop = {
  scenario: 'Aligned to the top',
  component: framed(flex({ verticalAlign: 'top' }, ...tallAndShort())),
}
export const alignedBottom = {
  scenario: 'Aligned to the bottom',
  component: framed(flex({ verticalAlign: 'bottom' }, ...tallAndShort())),
}
export const alignedMiddle = {
  scenario: 'Aligned to the middle',
  component: framed(flex({ verticalAlign: 'center' }, ...tallAndShort())),
}
export const stretched = {
  scenario: 'Stretched',
  component: framed(flex({ verticalAlign: 'stretch' }, block('a', 'auto'), block('b', 'auto'))),
}

export const noGap = { scenario: 'No gap', component: flex({ gap: 0 }, ...tallAndShort()) }
export const wideGap = { scenario: 'Wide gap', component: flex({ gap: 6 }, ...tallAndShort()) }

export const wrapping = {
  scenario: 'Wrapping',
  component: flex(
    { wrap: true, gap: 2 },
    ...[
      'design',
      'billing',
      'onboarding',
      'analytics',
      'notifications',
      'permissions',
      'exports',
    ].map((tag) => block(tag, '2rem')),
  ),
}

export const joined = {
  scenario: 'Joined - a split button',
  component: flex(
    { joined: true },
    button({ variant: 'primary' }, 'Save'),
    menuButton({ variant: 'primary', items: [{ id: 'draft', label: 'Save as draft' }] }),
  ),
}
export const joinedMixed = {
  scenario: 'Joined - mixed variants',
  component: flex(
    { joined: true },
    button({ variant: 'primary' }, 'Approve'),
    button('Comment'),
    button({ variant: 'danger' }, 'Reject'),
  ),
}
export const joinedPager = {
  scenario: 'Joined - a pager with a text field',
  component: flex(
    { joined: true },
    button({ label: 'Previous page', square: true }, icon(luChevronLeft)),
    textField({ value: '12', ariaLabel: 'Page number' }),
    button({ label: 'Next page', square: true }, icon(luChevronRight)),
  ),
}

export const rowOfText = {
  scenario: 'Row of text',
  component: flex(
    { verticalAlign: 'center', gap: 4 },
    text({ weight: 'bold' }, 'Invoices'),
    text({ tone: 'secondary', size: 'sm' }, '12 unpaid'),
  ),
}
