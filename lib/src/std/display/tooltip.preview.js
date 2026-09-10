import { tooltip } from 'imp/std/display'
import { button, icon, text } from 'imp/std'
import { flex } from 'imp/std/layout'
import { luPencil, luRefreshCw, luTrash } from 'imp/icons'
import { groups } from '../preview-groups.js'

export const name = 'Tooltip'
export const group = groups.display

const iconButton = (label, drawing) => button({ label, variant: 'ghost' }, icon(drawing))

export const onAnIconButton = {
  scenario: 'On an icon button',
  component: flex(
    { gap: 2, verticalAlign: 'center' },
    tooltip({ text: 'Edit' }, iconButton('Edit', luPencil)),
    tooltip({ text: 'Refresh' }, iconButton('Refresh', luRefreshCw)),
    tooltip({ text: 'Delete' }, iconButton('Delete', luTrash)),
    text(
      { tone: 'secondary', size: 'sm' },
      'Rest the pointer on one, tab to it, or hold a finger on it.',
    ),
  ),
}

export const sideFollowsTheScreen = {
  scenario: 'Side follows the screen',
  component: flex(
    { gap: 3, wrap: true, verticalAlign: 'center' },
    tooltip({ text: 'Scroll me around the screen' }, button('Hover me')),
    text(
      { tone: 'secondary', size: 'sm' },
      'The side follows where the control sits on the screen: below in the upper half, above in the lower half, beside it near a screen edge.',
    ),
  ),
}
