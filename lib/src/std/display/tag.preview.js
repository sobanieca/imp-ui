import { tag } from 'imp/std/display'
import { flex } from 'imp/std/layout'

export const name = 'Tag'
export const group = 'Display'
export const description = "Run 'imp skill std/tag' to learn what tag can do before using it."

export const neutral = tag('Draft')

export const colored = flex(
  { gap: 2, wrap: true, verticalAlign: 'center' },
  tag({ color: 'green' }, 'Shipped'),
  tag({ color: 'amber' }, 'Trial'),
  tag({ color: 'red' }, 'Overdue'),
  tag({ color: 'blue' }, 'Beta'),
  tag({ color: 'purple' }, 'Internal'),
)

export const sizes = flex(
  { gap: 2, verticalAlign: 'center' },
  tag({ color: 'teal', size: 'sm' }, 'Small'),
  tag({ color: 'teal' }, 'Default'),
  tag({ color: 'teal', size: 'lg' }, 'Large'),
)

export const wholePalette = flex(
  { gap: 1, wrap: true },
  ...[
    'gray',
    'mauve',
    'slate',
    'sage',
    'olive',
    'sand',
    'tomato',
    'red',
    'ruby',
    'crimson',
    'pink',
    'plum',
    'purple',
    'violet',
    'iris',
    'indigo',
    'blue',
    'cyan',
    'teal',
    'jade',
    'green',
    'grass',
    'bronze',
    'gold',
    'brown',
    'orange',
    'amber',
    'yellow',
    'lime',
    'mint',
    'sky',
  ].map((color) => tag({ color }, color)),
)
