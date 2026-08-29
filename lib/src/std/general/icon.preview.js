import { icon } from 'imp/std'
import { flex } from 'imp/std/layout'
import { div, span } from 'imp/html'

export const name = 'Icon'
export const category = 'General'
export const description = "Run 'imp skill std/icon' to learn what icon can do before using it."

const NAMES = [
  'home',
  'search',
  'settings',
  'grid',
  'chart',
  'folder',
  'file',
  'box',
  'tag',
  'user',
  'users',
  'bell',
  'mail',
  'credit-card',
  'plus',
  'edit',
  'trash',
  'check',
  'close',
  'menu',
  'filter',
  'refresh',
  'chevron-right',
  'chevron-left',
  'chevron-down',
  'chevron-up',
  'more',
  'link',
  'external-link',
  'download',
  'upload',
  'log-in',
  'log-out',
  'lock',
  'eye',
  'sun',
  'moon',
  'globe',
  'calendar',
  'clock',
  'info',
  'help',
  'warning',
  'star',
  'heart',
]

const labelled = (glyph) =>
  div(
    { style: 'display: grid; justify-items: center; gap: 4px; inline-size: 6rem' },
    icon({ name: glyph }),
    span({ style: 'font-size: 0.75rem; opacity: 0.7' }, glyph),
  )

export const everyGlyph = flex({ wrap: true, gap: 3 }, ...NAMES.map(labelled))

export const sizes = flex(
  { verticalAlign: 'center', gap: 3 },
  icon({ name: 'star', size: 'sm' }),
  icon({ name: 'star', size: 'md' }),
  icon({ name: 'star', size: 'lg' }),
)

export const inheritsTheTextColor = div(
  { style: 'color: crimson; display: flex; gap: 8px; align-items: center' },
  icon({ name: 'heart' }),
  span('colored by the box around it'),
)

export const named = icon({ name: 'trash', label: 'Delete invoice' })

export const unknownGlyphWarns = icon({ name: 'rocket' })
