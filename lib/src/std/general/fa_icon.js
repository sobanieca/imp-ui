import { defineComponent } from '../shared/define.js'
import { bindValue, oneOf } from '../shared/args.js'
import { impLogger } from '../../logger.js'
import { paletteNames } from '../../theme_colors.js'
import { SIZES, token } from '../shared/css.js'

const NAME = 'faIcon'

const KNOWN_PROPS = ['icon', 'size', 'color', 'label']

const SVG_NAMESPACE = 'http://www.w3.org/2000/svg'

const SIZE_LENGTHS = { sm: '1rem', md: '1.25rem', lg: '1.5rem' }

const CURRENT = 'current'

const ROLE_TOKENS = {
  primary: 'color-primary',
  secondary: 'color-secondary',
  text: 'color-text',
  link: 'color-link',
  border: 'color-border',
  danger: 'color-danger',
  success: 'color-success',
  warning: 'color-warning',
  info: 'color-info',
}

let names = null

const colorNames = () => (names ??= [CURRENT, ...Object.keys(ROLE_TOKENS), ...paletteNames()])

const colorToken = (name) => token(ROLE_TOKENS[name] ?? `color-${name}`)

const colorRules = () =>
  colorNames()
    .filter((name) => name !== CURRENT)
    .map((name) => `  .color-${name} { color: ${colorToken(name)} }`)
    .join('\n')

const sizeRules = () =>
  SIZES.map((size) => `  .size-${size} { block-size: ${SIZE_LENGTHS[size]} }`).join('\n')

const styles = () => `
  svg {
    display: block;
    flex: none;
    inline-size: auto;
    fill: currentColor;
  }

${sizeRules()}

${colorRules()}
`

const isIconData = (value) =>
  Array.isArray(value) && value.length === 3 && typeof value[2] === 'string'

const applySize = (svg, size) => {
  if (size === undefined || size === null) return svg.setAttribute('class', 'size-md')
  if (SIZES.includes(size)) return svg.setAttribute('class', `size-${size}`)
  svg.style.blockSize = String(size)
  if (svg.style.blockSize) return
  impLogger.warn(
    `${NAME}: 'size' must be one of 'sm', 'md', 'lg' or a CSS length like '2rem' - got '${size}', using 'md'`,
  )
  svg.setAttribute('class', 'size-md')
}

const definition = {
  styles,
  props: KNOWN_PROPS,
  build: (_instance, props, children) => {
    if (children.length > 0) {
      impLogger.warn(`${NAME}: takes no content - pass an icon from 'imp/icons' as 'icon'`)
    }
    const svg = document.createElementNS(SVG_NAMESPACE, 'svg')
    applySize(svg, props.size)
    const color = oneOf(NAME, 'color', props.color, colorNames(), CURRENT)
    if (color !== CURRENT) svg.classList.add(`color-${color}`)
    if (isIconData(props.icon)) {
      const [width, height, path] = props.icon
      svg.setAttribute('viewBox', `0 0 ${width} ${height}`)
      const glyph = document.createElementNS(SVG_NAMESPACE, 'path')
      glyph.setAttribute('d', path)
      svg.append(glyph)
    } else {
      impLogger.warn(
        `${NAME}: 'icon' must be an icon from 'imp/icons' like faUser - run 'imp skill icons'`,
      )
    }
    if (props.label === undefined) svg.setAttribute('aria-hidden', 'true')
    else {
      svg.setAttribute('role', 'img')
      bindValue(props.label, (value) => svg.setAttribute('aria-label', String(value)))
    }
    return svg
  },
}

const withIconArgument = (args) => args.map((arg) => (isIconData(arg) ? { icon: arg } : arg))

export const faIcon = (...args) =>
  defineComponent(NAME, () => definition)(...withIconArgument(args))
