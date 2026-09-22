import { tag } from 'imp/std/display'
import { text } from 'imp/std'
import { flex } from 'imp/std/layout'
import { groups } from '../preview-groups.js'

export const name = 'Tag'
export const group = groups.display

export const neutral = { scenario: 'Neutral', component: tag('Draft') }

export const colored = {
  scenario: 'Colored',
  component: flex(
    { gap: 2, wrap: true, verticalAlign: 'center' },
    tag({ color: 'green' }, 'Shipped'),
    tag({ color: 'amber' }, 'Trial'),
    tag({ color: 'red' }, 'Overdue'),
    tag({ color: 'blue' }, 'Beta'),
    tag({ color: 'purple' }, 'Internal'),
  ),
}

export const sizes = {
  scenario: 'Sizes',
  component: flex(
    { gap: 2, verticalAlign: 'center' },
    tag({ color: 'teal', size: 'sm' }, 'Small'),
    tag({ color: 'teal' }, 'Default'),
    tag({ color: 'teal', size: 'lg' }, 'Large'),
  ),
}

export const withDot = {
  scenario: 'With a dot',
  component: flex(
    { gap: 2, wrap: true, verticalAlign: 'center' },
    tag({ color: 'green', dot: true }, 'Online'),
    tag({ color: 'amber', dot: true }, 'Away'),
    tag({ color: 'red', dot: true, size: 'sm' }, 'Offline'),
    tag({ dot: true, size: 'lg' }, 'Unknown'),
  ),
}

export const bareDot = {
  scenario: 'Bare status dot',
  component: flex(
    { gap: 2, verticalAlign: 'center' },
    tag({ color: 'green', dot: true, label: 'Online' }),
    text('api.example.com'),
    tag({ color: 'red', dot: true, label: 'Offline' }),
    text('mail.example.com'),
  ),
}

export const countBubble = {
  scenario: 'Count beside a label',
  component: flex(
    { gap: 1, verticalAlign: 'center' },
    text('Inbox'),
    tag({ color: 'red', size: 'sm' }, 12),
  ),
}

export const wholePalette = {
  scenario: 'Whole palette',
  component: flex(
    { gap: 1, wrap: true },
    ...[
      'gray',
      'brown',
      'red',
      'orange',
      'amber',
      'yellow',
      'lime',
      'green',
      'teal',
      'cyan',
      'sky',
      'blue',
      'indigo',
      'violet',
      'purple',
      'pink',
    ].map((color) => tag({ color }, color)),
  ),
}
