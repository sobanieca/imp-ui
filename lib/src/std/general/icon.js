import { defineComponent } from '../shared/define.js'
import { bindValue, oneOf } from '../shared/args.js'
import { impLogger } from '../../logger.js'
import { isPlainObject } from '../../render.js'
import { paletteNames } from '../../theme_colors.js'
import { SIZES, token } from '../shared/css.js'

const NAME = 'icon'

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
  SIZES.map((size) =>
    `  .size-${size} { inline-size: ${SIZE_LENGTHS[size]}; block-size: ${SIZE_LENGTHS[size]} }`
  ).join('\n')

const styles = () => `
  svg {
    display: block;
    flex: none;
    color: currentColor;
  }

${sizeRules()}

${colorRules()}
`

const isDrawing = (value) =>
  Array.isArray(value) && value.length > 0 &&
  value.every((node) =>
    Array.isArray(node) && node.length === 2 && typeof node[0] === 'string' &&
    node[1] !== null && typeof node[1] === 'object'
  )

const applySize = (svg, size) => {
  if (size === undefined || size === null) return svg.classList.add('size-md')
  if (SIZES.includes(size)) return svg.classList.add(`size-${size}`)
  svg.style.inlineSize = String(size)
  svg.style.blockSize = String(size)
  if (svg.style.blockSize) return
  impLogger.warn(
    `${NAME}: 'size' must be one of 'sm', 'md', 'lg' or a CSS length like '2rem' - got '${size}', using 'md'`,
  )
  svg.classList.add('size-md')
}

const draw = (svg, drawing) => {
  for (const [element, attributes] of drawing) {
    const node = document.createElementNS(SVG_NAMESPACE, element)
    for (const [attribute, value] of Object.entries(attributes)) {
      node.setAttribute(attribute, value)
    }
    svg.append(node)
  }
}

const definition = {
  styles,
  props: KNOWN_PROPS,
  setup: (self, props, children) => {
    if (children.length > 0) {
      impLogger.warn(`${NAME}: takes no content - pass an icon from 'imp/icons' as 'icon'`)
    }
    const svg = document.createElementNS(SVG_NAMESPACE, 'svg')
    applySize(svg, props.size)
    const color = oneOf(NAME, 'color', props.color, colorNames(), CURRENT)
    if (color !== CURRENT) svg.classList.add(`color-${color}`)
    svg.setAttribute('viewBox', '0 0 24 24')
    svg.setAttribute('fill', 'none')
    svg.setAttribute('stroke', 'currentColor')
    svg.setAttribute('stroke-width', '2')
    svg.setAttribute('stroke-linecap', 'round')
    svg.setAttribute('stroke-linejoin', 'round')
    if (isDrawing(props.icon)) draw(svg, props.icon)
    else {
      impLogger.warn(
        `${NAME}: 'icon' must be an icon from 'imp/icons' like luUser - run 'imp skill icons'`,
      )
    }
    if (props.label === undefined) svg.setAttribute('aria-hidden', 'true')
    else {
      svg.setAttribute('role', 'img')
      bindValue(self, props.label, (value) => svg.setAttribute('aria-label', String(value)))
    }
    return svg
  },
}

const withIconArgument = (args) => {
  const drawing = args.find(isDrawing)
  if (!drawing) return args
  const rest = args.filter((arg) => arg !== drawing)
  const propsIndex = rest.findIndex(isPlainObject)
  if (propsIndex === -1) return [{ icon: drawing }, ...rest]
  return rest.with(propsIndex, { icon: drawing, ...rest[propsIndex] })
}

export const icon = (...args) => defineComponent(NAME, () => definition)(...withIconArgument(args))
