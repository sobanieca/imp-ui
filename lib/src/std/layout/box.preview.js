import { box, flex } from 'imp/std/layout'
import { text } from 'imp/std'

export const name = 'Box'
export const category = 'Layout'
export const description = "Run 'imp skill std/box' to learn what box can do before using it."

export const plainBox = box({ padding: 3 }, text('A box with padding and nothing else'))

export const panel = box(
  { padding: 4, background: 'surface', border: true, radius: 'lg', shadow: 'sm' },
  text({ weight: 'bold' }, 'Panel'),
  text({ tone: 'secondary' }, 'Background, border, radius and shadow all come from the theme.'),
)

export const shadowSteps = flex(
  { gap: 4, wrap: true },
  ...['none', 'sm', 'md', 'lg'].map((step) =>
    box(
      { padding: 4, background: 'surface', radius: 'md', shadow: step },
      text({ size: 'sm' }, `shadow: ${step}`),
    )
  ),
)

export const radiusSteps = flex(
  { gap: 4, wrap: true },
  ...['none', 'sm', 'md', 'lg', 'xl'].map((step) =>
    box(
      { padding: 4, background: 'sunken', border: true, radius: step },
      text({ size: 'sm' }, `radius: ${step}`),
    )
  ),
)

export const keepsItsShape = box(
  { ratio: '16/9', maxWidth: '24rem', background: 'sunken', radius: 'md', padding: 3 },
  text({ size: 'sm', tone: 'secondary' }, "ratio: '16/9'"),
)

export const paddingPerBreakpoint = box(
  { padding: { xs: 2, md: 6 }, background: 'surface', border: true, radius: 'md' },
  text('Tight on a phone, roomy on a desktop'),
)
