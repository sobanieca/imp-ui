import { impLogger } from '../../logger.js'

export const BREAKPOINTS = ['xs', 'sm', 'md', 'lg', 'xl']

export const WIDER_BREAKPOINTS = ['sm', 'md', 'lg', 'xl']

export const BREAKPOINT_MIN_WIDTHS = {
  sm: '40rem',
  md: '48rem',
  lg: '64rem',
  xl: '80rem',
}

const quoted = (values) => values.map((value) => `'${value}'`).join(', ')

const isBreakpointMap = (value) =>
  value !== null && typeof value === 'object' && !Array.isArray(value)

const warnUnknownBreakpoints = (name, prop, value) => {
  for (const key of Object.keys(value)) {
    if (!BREAKPOINTS.includes(key)) {
      impLogger.warn(
        `${name}: '${prop}' has no breakpoint '${key}' - use ${quoted(BREAKPOINTS)}`,
      )
    }
  }
}

export const resolveResponsive = (name, prop, value, toCssValue) => {
  if (value === undefined || value === null) return {}
  const perBreakpoint = isBreakpointMap(value) ? value : { xs: value }
  if (isBreakpointMap(value)) warnUnknownBreakpoints(name, prop, value)
  const resolved = {}
  let carried = null
  for (const breakpoint of BREAKPOINTS) {
    if (Object.hasOwn(perBreakpoint, breakpoint)) {
      const converted = toCssValue(perBreakpoint[breakpoint], breakpoint)
      if (converted !== null) carried = converted
    }
    if (carried !== null) resolved[breakpoint] = carried
  }
  return resolved
}

export const applyResponsive = (element, variable, resolved) => {
  for (const [breakpoint, cssValue] of Object.entries(resolved)) {
    element.style.setProperty(`--${variable}-${breakpoint}`, cssValue)
  }
}

export const responsiveStyles = (selector, declarations, defaultsSelector = selector) => {
  const defaults = declarations
    .flatMap(({ variable, fallback }) =>
      BREAKPOINTS.map((breakpoint) => `--${variable}-${breakpoint}: ${fallback};`)
    )
    .join(' ')
  const block = (breakpoint) =>
    declarations
      .map(({ property, variable, fallback }) =>
        `${property}: var(--${variable}-${breakpoint}, ${fallback});`
      )
      .join(' ')
  const widerRules = WIDER_BREAKPOINTS.map((breakpoint) =>
    `@media (min-width: ${BREAKPOINT_MIN_WIDTHS[breakpoint]}) {
    ${selector} { ${block(breakpoint)} }
  }`
  )
  return [
    `${defaultsSelector} { ${defaults} }`,
    `${selector} { ${block('xs')} }`,
    ...widerRules,
  ].join('\n\n  ')
}

export const displayDeclaration = (naturalDisplay) => ({
  property: 'display',
  variable: 'display',
  fallback: naturalDisplay,
})

const breakpointRank = (breakpoint) => BREAKPOINTS.indexOf(breakpoint)

const validBreakpoint = (name, prop, value) => {
  if (value === undefined || value === null) return null
  if (BREAKPOINTS.includes(value)) return value
  impLogger.warn(
    `${name}: '${prop}' must be one of ${quoted(BREAKPOINTS)} - got '${value}', ignoring it`,
  )
  return null
}

export const resolveVisibility = (name, { hideBelow, hideAbove }) => {
  const below = validBreakpoint(name, 'hideBelow', hideBelow)
  const above = validBreakpoint(name, 'hideAbove', hideAbove)
  if (below === null && above === null) return {}
  if (below !== null && above !== null && breakpointRank(above) < breakpointRank(below)) {
    impLogger.warn(
      `${name}: 'hideAbove' ('${above}') is narrower than 'hideBelow' ('${below}') - nothing will ever show`,
    )
  }
  const hidden = {}
  for (const breakpoint of BREAKPOINTS) {
    const rank = breakpointRank(breakpoint)
    const hiddenBelow = below !== null && rank < breakpointRank(below)
    const hiddenAbove = above !== null && rank >= breakpointRank(above)
    if (hiddenBelow || hiddenAbove) hidden[breakpoint] = 'none'
  }
  return hidden
}

export const VISIBILITY_PROPS = ['hideBelow', 'hideAbove']
