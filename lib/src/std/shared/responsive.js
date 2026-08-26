import { impLogger } from '../../logger.js'

export const BREAKPOINTS = ['mobile', 'desktop']

export const DESKTOP_MIN_WIDTH = '48rem'

export const BREAKPOINT_MIN_WIDTHS = { desktop: DESKTOP_MIN_WIDTH }

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
  const perBreakpoint = isBreakpointMap(value) ? value : { mobile: value }
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
  return [
    `${defaultsSelector} { ${defaults} }`,
    `${selector} { ${block('mobile')} }`,
    `@media (min-width: ${DESKTOP_MIN_WIDTH}) {
    ${selector} { ${block('desktop')} }
  }`,
  ].join('\n\n  ')
}

export const displayDeclaration = (naturalDisplay) => ({
  property: 'display',
  variable: 'display',
  fallback: naturalDisplay,
})

export const VISIBILITY_PROPS = ['hideOnMobile', 'hideOnDesktop']

const flag = (name, prop, value) => {
  if (value === undefined || value === null || value === false) return false
  if (value === true) return true
  impLogger.warn(`${name}: '${prop}' must be true or false - got '${value}', ignoring it`)
  return false
}

export const resolveVisibility = (name, { hideOnMobile, hideOnDesktop }) => {
  const mobile = flag(name, 'hideOnMobile', hideOnMobile)
  const desktop = flag(name, 'hideOnDesktop', hideOnDesktop)
  if (mobile && desktop) {
    impLogger.warn(`${name}: 'hideOnMobile' and 'hideOnDesktop' are both set - it will never show`)
  }
  const hidden = {}
  if (mobile) hidden.mobile = 'none'
  if (desktop) hidden.desktop = 'none'
  return hidden
}
