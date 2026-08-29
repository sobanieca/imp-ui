import { defineComponent } from '../shared/define.js'
import { span } from '../../api/html.js'
import { oneOf } from '../shared/args.js'
import { paletteNames } from '../../theme_colors.js'
import { fontFamily, sizeRules, SIZES, token } from '../shared/css.js'

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
    gap: ${token('space-1')};
    border: ${token('border-width')} solid color-mix(in oklab, var(--tag-color) 45%, transparent);
    border-radius: ${token('radius-sm')};
    background-color: color-mix(in oklab, var(--tag-color) 30%, transparent);
    ${fontFamily()}
    color: ${token('color-text')};
    font-weight: ${token('font-weight-medium')};
    line-height: ${token('line-height-tight')};
    white-space: nowrap;
  }

  ${sizeRules()}

  .size-sm {
    padding-block: 0;
    padding-inline: ${token('space-1')};
  }

  .size-md {
    padding-block: ${token('space-1')};
    padding-inline: ${token('space-2')};
  }

  .size-lg {
    padding-block: ${token('space-1')};
    padding-inline: ${token('space-3')};
  }

${colorRules()}

  @media (forced-colors: active) {
    .tag { border-color: CanvasText }
  }
`

const definition = {
  styles,
  props: KNOWN_PROPS,
  onMount: (_instance, props, children) => {
    const color = oneOf(NAME, 'color', props.color, colorNames(), NEUTRAL)
    const size = oneOf(NAME, 'size', props.size, SIZES, 'md')
    return span({ class: ['tag', `color-${color}`, `size-${size}`] }, ...children)
  },
}

export const tag = (...args) => defineComponent(NAME, () => definition)(...args)
