import { impLogger } from './logger.js'
import { createState } from './state.js'
import {
  colorSchemeOf,
  colorTokens,
  contrastProblems,
  isLoaderShape,
  loaderShapes,
  loaderTokens,
  radiusTokens,
  shadowTokens,
} from './theme-colors.js'

export { colorSchemeOf, contrastProblems }

const TOKEN_PREFIX = '--imp-'

export const DESKTOP_MIN_WIDTH = '48rem'

const TOKEN_NAME = /^[a-z][a-z0-9]*(-[a-z0-9]+)*$/

const THEME_TOKEN_KEYS = [
  'font-family',
  'font-family-mono',
  'font-family-heading',
  'font-size-sm',
  'font-size-md',
  'font-size-lg',
  'font-size-xl',
  'font-size-2xl',
  'font-weight-normal',
  'font-weight-bold',
  'line-height-tight',
  'line-height-normal',
  'space-1',
  'space-2',
  'space-3',
  'space-4',
  'space-5',
  'space-6',
  'space-page',
  'breakpoint-desktop',
  'border-width',
  'focus-ring-width',
  'icon-stroke-width',
  'duration-fast',
  'duration-medium',
  'disabled-opacity',
  'color-gray',
  'color-brown',
  'color-red',
  'color-orange',
  'color-amber',
  'color-yellow',
  'color-lime',
  'color-green',
  'color-teal',
  'color-cyan',
  'color-sky',
  'color-blue',
  'color-indigo',
  'color-violet',
  'color-purple',
  'color-pink',
  'color-danger',
  'color-success',
  'color-warning',
  'color-info',
  'color-primary',
  'color-on-primary',
  'color-on-danger',
  'color-secondary',
  'color-text',
  'color-surface',
  'color-surface-sunken',
  'color-surface-hover',
  'color-border',
  'color-shadow',
  'radius-item',
  'radius-container',
  'shadow-sm',
  'shadow-md',
  'shadow-lg',
  'loader',
  'background-app',
]

const THEME_STATE = 'imp.theme'

let themeState = null

const ensureThemeState = () => {
  themeState ??= createState(THEME_STATE, null)
  return themeState
}

export const theme = {
  name: THEME_STATE,
  get: () => ensureThemeState().get(),
  watch: (...args) => ensureThemeState().watch(...args),
  text: (select) => ensureThemeState().text(select),
  view: (render) => ensureThemeState().view(render),
  each: (renderItem, keyOf) => ensureThemeState().each(renderItem, keyOf),
}

const warnSuspiciousTokenName = (name) => {
  if (!TOKEN_NAME.test(name)) {
    impLogger.warn(
      `applyTheme: token name '${name}' is suspicious - use a bare dash-separated lowercase name like 'color-primary'; imp adds the '${TOKEN_PREFIX}' prefix. Applying it anyway`,
    )
  }
}

const writeTokens = (root, tokens) => {
  for (const [name, value] of Object.entries(tokens)) {
    warnSuspiciousTokenName(name)
    const property = TOKEN_PREFIX + name
    const cssValue = String(value)
    root.style.setProperty(property, cssValue)
    if (cssValue !== '' && root.style.getPropertyValue(property) === '') {
      impLogger.warn(
        `applyTheme: the browser ignored token '${name}' with value '${cssValue}' - check it is a valid CSS value`,
      )
    }
  }
}

const themeLabel = (themeDefinition) =>
  themeDefinition.name ? `theme '${themeDefinition.name}'` : 'the theme'

const reportedUnreadableSurfaces = new Set()

const warnUnreadableSurface = (themeDefinition) => {
  const label = themeLabel(themeDefinition)
  if (reportedUnreadableSurfaces.has(label)) return
  reportedUnreadableSurfaces.add(label)
  impLogger.warn(
    `applyTheme: 'color-surface' of ${label} is '${
      themeDefinition.tokens['color-surface'] ?? ''
    }' - imp reads light or dark from the lightness of that token, so it must be an opaque CSS colour like '#1f2028' or 'oklch(0.25 0.01 270)'; leaving color-scheme unset`,
  )
}

const writeColorScheme = (root, themeDefinition) => {
  const colorScheme = colorSchemeOf(themeDefinition.tokens)
  if (colorScheme === undefined) {
    warnUnreadableSurface(themeDefinition)
    root.style.removeProperty('color-scheme')
    return
  }
  root.style.setProperty('color-scheme', colorScheme)
}

const MISSING_TOKENS_LISTED = 6

const reportedMissingTokens = new Set()

const warnMissingTokens = (themeDefinition) => {
  const label = themeLabel(themeDefinition)
  const missing = THEME_TOKEN_KEYS.filter((key) =>
    !Object.hasOwn(themeDefinition.tokens, key) && !reportedMissingTokens.has(`${label} ${key}`)
  )
  if (missing.length === 0) return
  for (const key of missing) reportedMissingTokens.add(`${label} ${key}`)
  const listed = missing.slice(0, MISSING_TOKENS_LISTED).join(', ')
  const rest = missing.length - MISSING_TOKENS_LISTED
  impLogger.warn(
    `applyTheme: ${label} has no value for ${missing.length} token(s) - ${listed}${
      rest > 0 ? ` and ${rest} more` : ''
    }; a component falls back to the built-in value, and a previous theme can show through. Give every token a value, or start from a built-in theme with base: 'imp-light'`,
  )
}

const warnUnknownLoaderShape = (tokens) => {
  const shape = tokens.loader
  if (shape === undefined || isLoaderShape(shape)) return
  const known = loaderShapes().map((name) => `'${name}'`).join(', ')
  impLogger.warn(
    `applyTheme: token 'loader' is '${shape}' - the shapes are ${known}; every loading state draws the spinner`,
  )
}

const sharedMetricTokens = {
  'font-family': `system-ui, -apple-system, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif`,
  'font-family-mono': `ui-monospace, SFMono-Regular, Menlo, Consolas, 'Liberation Mono', monospace`,
  'font-family-heading': 'var(--imp-font-family)',
  'font-size-sm': '0.875rem',
  'font-size-md': '1rem',
  'font-size-lg': '1.125rem',
  'font-size-xl': '1.5rem',
  'font-size-2xl': '2rem',
  'font-weight-normal': '400',
  'font-weight-bold': '600',
  'line-height-tight': '1.25',
  'line-height-normal': '1.6',
  'space-1': '4px',
  'space-2': '8px',
  'space-3': 'clamp(0.625rem, 0.573rem + 0.221vw, 0.75rem)',
  'space-4': 'clamp(0.75rem, 0.646rem + 0.442vw, 1rem)',
  'space-5': 'clamp(1rem, 0.793rem + 0.884vw, 1.5rem)',
  'space-6': 'clamp(1.25rem, 0.939rem + 1.326vw, 2rem)',
  'space-page': 'clamp(1rem, 0.171rem + 3.536vw, 3rem)',
  'breakpoint-desktop': DESKTOP_MIN_WIDTH,
  'border-width': '1px',
  'focus-ring-width': '2px',
  'icon-stroke-width': '2',
  'duration-fast': '120ms',
  'duration-medium': '220ms',
  'disabled-opacity': '0.55',
}

export const THEME_DEFAULTS = {
  primary: '#2563eb',
  secondary: '#64748b',
  radius: 'medium',
  shadow: 'soft',
  loader: 'spinner',
}

export const buildTokens = ({ primary, secondary, radius, shadow, loader, mode, overrides }) => {
  const tokens = {
    ...sharedMetricTokens,
    ...colorTokens({ primary, secondary, mode }),
    ...radiusTokens(radius),
    ...shadowTokens(shadow),
    ...loaderTokens(loader),
    ...overrides,
  }
  return { ...tokens, 'background-app': tokens['background-app'] ?? tokens['color-surface'] }
}

let lightTokens = null

export const defaultTokens = () => (lightTokens ??= buildTokens({
  ...THEME_DEFAULTS,
  mode: 'light',
}))

const HIGH_CONTRAST_OVERRIDES = {
  'border-width': '2px',
  'focus-ring-width': '3px',
  'disabled-opacity': '0.7',
}

const themeDefinitions = () => ({
  'imp-light': {
    name: 'imp-light',
    tokens: defaultTokens(),
  },
  'imp-dark': {
    name: 'imp-dark',
    tokens: buildTokens({
      primary: '#7c9cff',
      secondary: '#94a3b8',
      radius: 'medium',
      shadow: 'soft',
      loader: 'spinner',
      mode: 'dark',
    }),
  },
  'imp-high-contrast-light': {
    name: 'imp-high-contrast-light',
    tokens: buildTokens({
      primary: '#000080',
      secondary: '#3d3d3d',
      radius: 'medium',
      shadow: 'none',
      loader: 'spinner',
      mode: 'light',
      overrides: {
        ...HIGH_CONTRAST_OVERRIDES,
        'color-text': '#000000',
        'color-surface': '#ffffff',
        'color-surface-sunken': '#eeeeee',
        'color-surface-hover': '#dcdcdc',
        'color-border': '#000000',
        'color-danger': '#a30000',
        'color-on-danger': '#ffffff',
      },
    }),
  },
  'imp-high-contrast-dark': {
    name: 'imp-high-contrast-dark',
    tokens: buildTokens({
      primary: '#6fd2ff',
      secondary: '#d0d0d0',
      radius: 'medium',
      shadow: 'none',
      loader: 'spinner',
      mode: 'dark',
      overrides: {
        ...HIGH_CONTRAST_OVERRIDES,
        'color-text': '#ffffff',
        'color-surface': '#000000',
        'color-surface-sunken': '#0d0d0d',
        'color-surface-hover': '#333333',
        'color-border': '#ffffff',
        'color-danger': '#ff8a8a',
        'color-on-danger': '#000000',
      },
    }),
  },
})

let builtInThemes = null

const allBuiltInThemes = () => (builtInThemes ??= themeDefinitions())

const listBuiltInThemeNames = () => {
  const quoted = Object.keys(allBuiltInThemes()).map((name) => `'${name}'`)
  return `${quoted.slice(0, -1).join(', ')} or ${quoted.at(-1)}`
}

const resolveBuiltInTheme = (name) => {
  if (!Object.hasOwn(allBuiltInThemes(), name)) {
    throw new Error(
      `imp: applyTheme does not know a built-in theme named '${name}' - pass ${listBuiltInThemeNames()}, or a theme object`,
    )
  }
  return allBuiltInThemes()[name]
}

const isThemeObject = (value) => !!value && typeof value === 'object' && !Array.isArray(value)

const THEME_SHAPE =
  "a theme object like { name, tokens: { 'color-surface': '#...' } }, or { base: 'imp-light', tokens: { 'font-family': '...' } }"

const resolveThemeDefinition = (themeOrBuiltInName) => {
  if (typeof themeOrBuiltInName === 'string') return resolveBuiltInTheme(themeOrBuiltInName)
  if (!isThemeObject(themeOrBuiltInName)) {
    throw new Error(`imp: applyTheme needs ${listBuiltInThemeNames()}, or ${THEME_SHAPE}`)
  }
  const { base, tokens, ...metadata } = themeOrBuiltInName
  if (!isThemeObject(tokens)) {
    throw new Error(
      "imp: applyTheme needs a theme with a 'tokens' object mapping token names to CSS values",
    )
  }
  if (base === undefined) return themeOrBuiltInName
  if (typeof base !== 'string') {
    throw new Error(
      `imp: applyTheme needs 'base' to name a built-in theme, ${listBuiltInThemeNames()}`,
    )
  }
  const baseTheme = resolveBuiltInTheme(base)
  return {
    name: baseTheme.name,
    ...metadata,
    tokens: { ...baseTheme.tokens, ...tokens },
  }
}

export function applyTheme(themeOrBuiltInName) {
  const themeDefinition = resolveThemeDefinition(themeOrBuiltInName)
  if (typeof document !== 'undefined') {
    const root = document.documentElement
    writeTokens(root, themeDefinition.tokens)
    writeColorScheme(root, themeDefinition)
  }
  warnMissingTokens(themeDefinition)
  warnUnknownLoaderShape(themeDefinition.tokens)
  ensureThemeState().set(themeDefinition)
  impLogger.debug(`applied theme '${themeDefinition.name ?? '(unnamed)'}'`)
  return themeDefinition
}
