import { stack } from 'imp/std/layout'
import { text } from 'imp/std'

export const name = 'Stack'
export const category = 'Layout'
export const description = "Run 'imp skill std/stack' to learn what stack can do before using it."

const items = () => [text('First'), text('Second'), text('Third')]

export const defaultColumn = stack(...items())

export const asRow = stack({ direction: 'row' }, ...items())

export const tightGap = stack({ gap: 1 }, ...items())

export const roomyGap = stack({ gap: 6 }, ...items())

export const spacedRow = stack({ direction: 'row', justify: 'between' }, ...items())

export const panel = stack(
  { padding: 4, gap: 2, background: 'surface', border: true, radius: 'lg', shadow: 'sm' },
  text({ weight: 'bold' }, 'Panel'),
  text({ tone: 'secondary' }, 'A stack with the shared box props is a card.'),
)
