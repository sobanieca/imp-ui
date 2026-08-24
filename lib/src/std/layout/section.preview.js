import { grid, section } from 'imp/std/layout'
import { heading, text } from 'imp/std'

export const name = 'Section'
export const category = 'Layout'
export const description =
  "Run 'imp skill std/section' to learn what section can do before using it."

export const band = section(
  { label: 'Features' },
  heading({ level: 2 }, 'Features'),
  grid({ minItemWidth: '12rem', gap: 3 }, text('Fast'), text('Small'), text('Themable')),
)

export const sizes = grid(
  { columns: 1 },
  ...['sm', 'md', 'lg'].map((size) =>
    section(
      { size, background: 'sunken', paddingX: 4, radius: 'md' },
      text({ weight: 'bold' }, `size: ${size}`),
      text({ tone: 'secondary', size: 'sm' }, 'Block padding grows with the size'),
    )
  ),
)

export const tighterOnPhones = section(
  { size: { xs: 'sm', md: 'lg' }, background: 'sunken', paddingX: 4, radius: 'md' },
  text('Padding follows the breakpoint'),
)
