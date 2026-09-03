import { defineComponent } from '../shared/define.js'
import { span } from '../../api/html.js'
import { oneOf } from '../shared/args.js'
import { paletteNames } from '../../theme_colors.js'
import { fontFamily, SIZES, token } from '../shared/css.js'

const NAME = 'tag'

const KNOWN_PROPS = ['color', 'size']

const NEUTRAL = 'neutral'

let names = null

const colorNames = () => (names ??= [NEUTRAL, ...paletteNames()])

const colorToken = (name) => token(name === NEUTRAL ? 'color-secondary' : `color-${name}`)

const colorRules = () =>
  colorNames()
    .map((name) => `  .color-${name} { --tag-color: ${colorToken(name)} }`)
    .join('\n')

const styles = () => `
  .tag {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: ${token('space-1')};
    box-sizing: border-box;
    min-inline-size: var(--tag-size);
    block-size: var(--tag-size);
    padding-inline: var(--tag-padding);
    border: ${token('border-width')} solid color-mix(in oklab, var(--tag-color) 30%, transparent);
    border-radius: ${token('radius-item')};
    background-color: color-mix(in oklab, var(--tag-color) 14%, transparent);
    ${fontFamily()}
    color: color-mix(in oklab, var(--tag-color) 62%, ${token('color-text')});
    font-weight: ${token('font-weight-medium')};
    font-variant-numeric: tabular-nums;
    letter-spacing: 0.01em;
    line-height: 1;
    white-space: nowrap;
  }

  .size-sm {
    --tag-size: 1.25rem;
    --tag-padding: ${token('space-1')};
    font-size: 0.75rem;
  }

  .size-md {
    --tag-size: 1.5rem;
    --tag-padding: ${token('space-2')};
    font-size: ${token('font-size-sm')};
  }

  .size-lg {
    --tag-size: 1.75rem;
    --tag-padding: ${token('space-3')};
    font-size: ${token('font-size-md')};
  }

${colorRules()}

  @media (forced-colors: active) {
    .tag {
      border-color: CanvasText;
      color: CanvasText;
    }
  }
`

const definition = {
  styles,
  props: KNOWN_PROPS,
  setup: (_self, props, children) => {
    const color = oneOf(NAME, 'color', props.color, colorNames(), NEUTRAL)
    const size = oneOf(NAME, 'size', props.size, SIZES, 'md')
    return span({ class: ['tag', `color-${color}`, `size-${size}`] }, ...children)
  },
}

export const tag = (...args) => defineComponent(NAME, () => definition)(...args)
