import { row, spacer, stack } from 'imp/std/layout'
import { button, text } from 'imp/std'

export const name = 'Spacer'
export const category = 'Layout'
export const description = "Run 'imp skill std/spacer' to learn what spacer can do before using it."

export const pushesToTheEnd = row(text('Left'), spacer(), text('Right'))
export const fixedGap = row(button('One'), spacer({ size: 6 }), button('Two'))
export const inAColumn = stack(text('Above'), spacer({ size: 6 }), text('Below'))
export const growsOnlyOnDesktop = row(text('Left'), spacer({ hideBelow: 'md' }), text('Right'))
