import { tag } from 'imp/std/display'
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
