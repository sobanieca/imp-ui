import { footer } from 'imp/std/layout'
import { link, text } from 'imp/std'

export const name = 'Footer'
export const category = 'Layout'
export const description = "Run 'imp skill std/footer' to learn what footer can do before using it."

export const plain = footer(
  { label: 'Page footer' },
  text({ size: 'sm', tone: 'secondary' }, 'Acme Inc. - all rights reserved'),
)

export const spread = footer(
  { label: 'Page footer', justify: 'between' },
  text({ size: 'sm', tone: 'secondary' }, 'Acme Inc.'),
  link({ href: '/privacy' }, 'Privacy'),
)
