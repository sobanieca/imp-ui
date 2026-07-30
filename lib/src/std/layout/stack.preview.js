import { stack } from 'imp/std/layout'
import { button, text } from 'imp/std'

const box = (label) => text(label)

export const defaultColumn = stack(box('First'), box('Second'), box('Third'))
export const tightGap = stack({ gap: 1 }, box('First'), box('Second'), box('Third'))
export const looseGap = stack({ gap: 6 }, box('First'), box('Second'), box('Third'))
export const centered = stack({ align: 'center' }, box('First'), button('Second'))
export const asRow = stack({ direction: 'row' }, button('One'), button('Two'), button('Three'))
export const columnOnPhonesRowOnDesktop = stack(
  { direction: { xs: 'column', md: 'row' }, gap: 4 },
  button('Narrow: stacked'),
  button('Wide: side by side'),
)
export const hiddenOnPhones = stack({ hideBelow: 'md' }, text('Only from md up'))
