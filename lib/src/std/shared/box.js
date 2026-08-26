import { impLogger } from '../../logger.js'
import { token } from './css.js'
import { spaceSteps, spaceToken, toGrow } from './layout.js'
import {
  applyResponsive,
  displayDeclaration,
  resolveResponsive,
  resolveVisibility,
  responsiveStyles,
  VISIBILITY_PROPS,
} from './responsive.js'

const quoted = (values) => values.map((value) => `'${value}'`).join(', ')

export const RADIUS_SIZES = ['none', 'sm', 'md', 'lg', 'xl', 'full']

export const SHADOW_SIZES = ['none', 'sm', 'md', 'lg']

export const BACKGROUNDS = ['none', 'surface', 'sunken']

const SPACING_PROPS = ['padding', 'paddingX', 'paddingY']

const SIZE_PROPS = ['width', 'minWidth', 'maxWidth', 'height', 'minHeight', 'maxHeight']

export const BOX_PROPS = [
  ...SPACING_PROPS,
  ...SIZE_PROPS,
  'radius',
  'shadow',
  'background',
  'border',
  'ratio',
  'grow',
  'scroll',
  ...VISIBILITY_PROPS,
]

const toSpaceStep = (name, prop) => (value) => {
  if (spaceSteps().includes(value)) return spaceToken(value)
  impLogger.warn(
    `${name}: '${prop}' must be a spacing step ${
      quoted(spaceSteps())
    } from the theme scale - got '${value}', ignoring it`,
  )
  return null
}

const toLength = (name, prop) => (value) => {
  if (typeof value === 'string' && value.trim() !== '') return value
  impLogger.warn(
    `${name}: '${prop}' must be a CSS length like '20rem' or 'auto' - got '${value}', ignoring it`,
  )
  return null
}

const toRadius = (name) => (value) => {
  if (value === 'none') return '0px'
  if (RADIUS_SIZES.includes(value)) return token(`radius-${value}`)
  impLogger.warn(
    `${name}: 'radius' must be one of ${quoted(RADIUS_SIZES)} - got '${value}', ignoring it`,
  )
  return null
}

const toShadow = (name) => (value) => {
  if (value === 'none') return 'none'
  if (SHADOW_SIZES.includes(value)) return token(`shadow-${value}`)
  impLogger.warn(
    `${name}: 'shadow' must be one of ${quoted(SHADOW_SIZES)} - got '${value}', ignoring it`,
  )
  return null
}

const toBackground = (name) => (value) => {
  if (value === 'none') return 'transparent'
  if (value === 'surface') return token('color-surface')
  if (value === 'sunken') return token('color-surface-sunken')
  impLogger.warn(
    `${name}: 'background' must be one of ${quoted(BACKGROUNDS)} - got '${value}', ignoring it`,
  )
  return null
}

const toBorder = (name) => (value) => {
  if (typeof value === 'boolean') {
    return value ? `${token('border-width')} solid ${token('color-border')}` : 'none'
  }
  impLogger.warn(`${name}: 'border' must be true or false - got '${value}', ignoring it`)
  return null
}

const toRatio = (name) => (value) => {
  if (typeof value === 'string' && value.trim() !== '') return value
  impLogger.warn(
    `${name}: 'ratio' must be an aspect ratio like '16/9' - got '${value}', ignoring it`,
  )
  return null
}

export const boxDeclarations = (naturalDisplay) => [
  displayDeclaration(naturalDisplay),
  { property: 'padding-block', variable: 'padding-block', fallback: '0px' },
  { property: 'padding-inline', variable: 'padding-inline', fallback: '0px' },
  { property: 'inline-size', variable: 'width', fallback: 'auto' },
  { property: 'min-inline-size', variable: 'min-width', fallback: '0' },
  { property: 'max-inline-size', variable: 'max-width', fallback: 'none' },
  { property: 'block-size', variable: 'height', fallback: 'auto' },
  { property: 'min-block-size', variable: 'min-height', fallback: '0' },
  { property: 'max-block-size', variable: 'max-height', fallback: 'none' },
  { property: 'border-radius', variable: 'radius', fallback: '0px' },
  { property: 'box-shadow', variable: 'shadow', fallback: 'none' },
  { property: 'background-color', variable: 'background', fallback: 'transparent' },
  { property: 'border', variable: 'border', fallback: 'none' },
  { property: 'aspect-ratio', variable: 'ratio', fallback: 'auto' },
  { property: 'flex', variable: 'grow', fallback: '0 1 auto' },
]

const mergedDeclarations = (naturalDisplay, declarations) => {
  const byVariable = new Map()
  for (const declaration of [...boxDeclarations(naturalDisplay), ...declarations]) {
    byVariable.set(declaration.variable, declaration)
  }
  return [...byVariable.values()]
}

export const boxStyles = (naturalDisplay, declarations = [], extra = '') => `
  .root {
    box-sizing: border-box;
  }

  .scroll {
    overflow: auto;
    overscroll-behavior: contain;
    scrollbar-width: thin;
  }

  ${extra}

  ${responsiveStyles('.root', mergedDeclarations(naturalDisplay, declarations))}
`

export const boxResponsive = (name, props) => {
  const padding = resolveResponsive(name, 'padding', props.padding, toSpaceStep(name, 'padding'))
  const paddingX = resolveResponsive(
    name,
    'paddingX',
    props.paddingX,
    toSpaceStep(name, 'paddingX'),
  )
  const paddingY = resolveResponsive(
    name,
    'paddingY',
    props.paddingY,
    toSpaceStep(name, 'paddingY'),
  )
  const size = (prop, variable) => [
    variable,
    resolveResponsive(name, prop, props[prop], toLength(name, prop)),
  ]
  return [
    ['display', resolveVisibility(name, props)],
    ['padding-block', { ...padding, ...paddingY }],
    ['padding-inline', { ...padding, ...paddingX }],
    size('width', 'width'),
    size('minWidth', 'min-width'),
    size('maxWidth', 'max-width'),
    size('height', 'height'),
    size('minHeight', 'min-height'),
    size('maxHeight', 'max-height'),
    ['radius', resolveResponsive(name, 'radius', props.radius, toRadius(name))],
    ['shadow', resolveResponsive(name, 'shadow', props.shadow, toShadow(name))],
    ['background', resolveResponsive(name, 'background', props.background, toBackground(name))],
    ['border', resolveResponsive(name, 'border', props.border, toBorder(name))],
    ['ratio', resolveResponsive(name, 'ratio', props.ratio, toRatio(name))],
    ['grow', resolveResponsive(name, 'grow', props.grow, toGrow(name))],
  ]
}

export const applyBox = (name, root, props, extra = []) => {
  for (const [variable, resolved] of [...boxResponsive(name, props), ...extra]) {
    applyResponsive(root, variable, resolved)
  }
  return root
}

export const boxClass = (props) => ['root', props.scroll ? 'scroll' : null]
