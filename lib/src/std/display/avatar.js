import { defineComponent } from '../shared/define.js'
import { impLogger } from '../../logger.js'
import { paletteNames } from '../../theme-colors.js'
import { bindValue, oneOf } from '../shared/args.js'
import { avatarNode, avatarStyles } from '../shared/avatar.js'
import { fontFamily, SIZES, token } from '../shared/css.js'

const NAME = 'avatar'

const KNOWN_PROPS = ['name', 'picture', 'size', 'color', 'decorative']

const PRIMARY = 'primary'

const AUTO = 'auto'

let names = null

const colorNames = () => (names ??= [PRIMARY, AUTO, ...paletteNames()])

const NEUTRAL = new Set(['gray', 'brown'])

const colorOfName = (name) => {
  const choices = paletteNames().filter((color) => !NEUTRAL.has(color))
  let hash = 0
  for (const unit of String(name ?? '')
    .trim()
    .toLowerCase()) {
    hash = (hash * 31 + unit.codePointAt(0)) >>> 0
  }
  return choices[hash % choices.length]
}

const colorRules = () =>
  paletteNames()
    .map((name) => {
      const color = token(`color-${name}`)
      return `  .color-${name} {
    --avatar-fill: color-mix(in oklab, ${color} 24%, ${token('color-surface')});
    --avatar-ink: color-mix(in oklab, ${color} 45%, ${token('color-text')});
  }`
    })
    .join('\n')

const styles = () => `
  ${avatarStyles()}

  .avatar {
    ${fontFamily()}
    font-weight: ${token('font-weight-bold')};
    vertical-align: middle;
  }

  .size-sm {
    --avatar-size: 1.5rem;
    --avatar-font-size: 0.75rem;
  }

  .size-lg {
    --avatar-size: 3rem;
    --avatar-font-size: ${token('font-size-lg')};
  }

${colorRules()}
`

const definition = {
  styles,
  props: KNOWN_PROPS,
  setup: (self, props, children) => {
    if (children.length > 0) {
      impLogger.warn(`${NAME}: takes no content - pass the person as 'name' and 'picture'`)
    }
    if (props.name === undefined) {
      impLogger.warn(`${NAME}: needs a 'name' - it gives the initials and the accessible name`)
    }
    const size = oneOf(NAME, 'size', props.size, SIZES, 'md')
    const color = oneOf(NAME, 'color', props.color, colorNames(), PRIMARY)
    const node = avatarNode(self, {
      name: props.name,
      picture: props.picture,
      decorative: Boolean(props.decorative),
      classes: [`size-${size}`, color === AUTO ? null : `color-${color}`].filter(Boolean),
    })
    if (color === AUTO) {
      let painted = null
      bindValue(self, props.name, (value) => {
        if (painted) node.classList.remove(painted)
        painted = `color-${colorOfName(value)}`
        node.classList.add(painted)
      })
    }
    return node
  },
}

export const avatar = (...args) => defineComponent(NAME, () => definition)(...args)
