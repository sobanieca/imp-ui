import { box, container } from 'imp/std/layout'
import { heading, text } from 'imp/std'

export const name = 'Container'
export const category = 'Layout'
export const description =
  "Run 'imp skill std/container' to learn what container can do before using it."

const body = () => [
  heading({ level: 3 }, 'Centred column'),
  text(
    'A container caps its content at a themed width and centres what is left over, so a line of ' +
      'text never runs the full width of a wide monitor.',
  ),
]

export const defaultWidth = box({ background: 'sunken', paddingY: 4 }, container(...body()))

export const narrow = box(
  { background: 'sunken', paddingY: 4 },
  container({ size: 'sm', paddingX: 4 }, ...body()),
)

export const sizes = box(
  { background: 'sunken', paddingY: 4 },
  ...['sm', 'md', 'lg', 'xl'].map((size) =>
    container(
      { size, paddingX: 3, paddingY: 2 },
      box(
        { background: 'surface', border: true, radius: 'md', padding: 3 },
        text({ size: 'sm' }, `size: ${size}`),
      ),
    )
  ),
)

export const widerOnLargeScreens = box(
  { background: 'sunken', paddingY: 4 },
  container({ size: { xs: 'sm', lg: 'xl' }, paddingX: 4 }, ...body()),
)
