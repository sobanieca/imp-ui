import { impLogger } from './logger.js'
import { createState } from './state.js'
import { colorTokens, radiusTokens, shadowTokens } from './theme_colors.js'

const TOKEN_PREFIX = '--imp-'

export const DESKTOP_MIN_WIDTH = '48rem'

const TOKEN_NAME = /^[a-z][a-z0-9]*(-[a-z0-9]+)*$/

const THEME_STATE = 'imp.theme'

let themeState = null

const ensureThemeState = () => {
  themeState ??= createState(THEME_STATE, null)
  return themeState
}

export const theme = {
  name: THEME_STATE,
  get: () => ensureThemeState().get(),
  watch: (subscriber) => ensureThemeState().watch(subscriber),
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

const writeColorScheme = (root, colorScheme) => {
  if (colorScheme === undefined) {
    root.style.removeProperty('color-scheme')
    return
  }
  if (colorScheme !== 'light' && colorScheme !== 'dark') {
    impLogger.warn(
      `applyTheme: colorScheme '${colorScheme}' is neither 'light' nor 'dark' - leaving color-scheme unset`,
    )
    root.style.removeProperty('color-scheme')
    return
  }
  root.style.setProperty('color-scheme', colorScheme)
}

const sharedMetricTokens = {
  'font-family': `system-ui, -apple-system, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif`,
  'font-family-mono': `ui-monospace, SFMono-Regular, Menlo, Consolas, 'Liberation Mono', monospace`,
  'font-size-sm': '0.875rem',
  'font-size-md': '1rem',
  'font-size-lg': '1.125rem',
  'font-size-xl': '1.5rem',
  'font-size-2xl': '2rem',
  'font-weight-normal': '400',
  'font-weight-medium': '500',
  'font-weight-bold': '700',
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
  'duration-fast': '120ms',
  'duration-medium': '220ms',
  'disabled-opacity': '0.55',
}

export const THEME_DEFAULTS = {
  primary: '#2563eb',
  secondary: '#64748b',
  radius: 'medium',
  shadow: 'soft',
}

export const buildTokens = ({ primary, secondary, radius, shadow, colorScheme, overrides }) => {
  const tokens = {
    ...sharedMetricTokens,
    ...colorTokens({ primary, secondary, colorScheme }),
    ...radiusTokens(radius),
    ...shadowTokens(shadow, colorScheme),
    ...overrides,
  }
  return { ...tokens, 'background-app': tokens['background-app'] ?? tokens['color-surface'] }
}

let lightTokens = null

export const defaultTokens = () => (lightTokens ??= buildTokens({
  ...THEME_DEFAULTS,
  colorScheme: 'light',
}))

const HIGH_CONTRAST_OVERRIDES = {
  'border-width': '2px',
  'focus-ring-width': '3px',
  'disabled-opacity': '0.7',
}

const themeDefinitions = () => ({
  'imp-light': {
    name: 'imp-light',
    colorScheme: 'light',
    tokens: defaultTokens(),
  },
  'imp-dark': {
    name: 'imp-dark',
    colorScheme: 'dark',
    tokens: buildTokens({
      primary: '#7c9cff',
      secondary: '#94a3b8',
      radius: 'medium',
      shadow: 'soft',
      colorScheme: 'dark',
    }),
  },
  'imp-high-contrast-light': {
    name: 'imp-high-contrast-light',
    colorScheme: 'light',
    tokens: buildTokens({
      primary: '#000080',
      secondary: '#3d3d3d',
      radius: 'medium',
      shadow: 'none',
      colorScheme: 'light',
      overrides: {
        ...HIGH_CONTRAST_OVERRIDES,
        'color-text': '#000000',
        'color-surface': '#ffffff',
        'color-surface-sunken': '#eeeeee',
        'color-surface-hover': '#dcdcdc',
        'color-border': '#000000',
        'color-focus-ring': '#000000',
        'color-danger': '#a30000',
        'color-danger-hover': '#c40000',
        'color-danger-active': '#800000',
        'color-on-danger': '#ffffff',
      },
    }),
  },
  'imp-high-contrast-dark': {
    name: 'imp-high-contrast-dark',
    colorScheme: 'dark',
    tokens: buildTokens({
      primary: '#6fd2ff',
      secondary: '#d0d0d0',
      radius: 'medium',
      shadow: 'none',
      colorScheme: 'dark',
      overrides: {
        ...HIGH_CONTRAST_OVERRIDES,
        'color-text': '#ffffff',
        'color-surface': '#000000',
        'color-surface-sunken': '#0d0d0d',
        'color-surface-hover': '#333333',
        'color-border': '#ffffff',
        'color-focus-ring': '#ffffff',
        'color-danger': '#ff8a8a',
        'color-danger-hover': '#ffb3b3',
        'color-danger-active': '#ff6b6b',
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

export function applyTheme(themeOrBuiltInName) {
  const themeDefinition = typeof themeOrBuiltInName === 'string'
    ? resolveBuiltInTheme(themeOrBuiltInName)
    : themeOrBuiltInName
  if (!themeDefinition || typeof themeDefinition !== 'object' || Array.isArray(themeDefinition)) {
    throw new Error(
      `imp: applyTheme needs ${listBuiltInThemeNames()}, or a theme object like { name, colorScheme, tokens: { 'color-primary': '#...' } }`,
    )
  }
  const { tokens } = themeDefinition
  if (!tokens || typeof tokens !== 'object' || Array.isArray(tokens)) {
    throw new Error(
      "imp: applyTheme needs a theme with a 'tokens' object mapping token names to CSS values",
    )
  }
  if (typeof document !== 'undefined') {
    const root = document.documentElement
    writeTokens(root, tokens)
    writeColorScheme(root, themeDefinition.colorScheme)
  }
  ensureThemeState().set(themeDefinition)
  impLogger.debug(`applied theme '${themeDefinition.name ?? '(unnamed)'}'`)
  return themeDefinition
}
