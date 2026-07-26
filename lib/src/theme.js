import { createLogger } from './logger.js'
import { createState } from './state.js'

const log = createLogger('imp')

const TOKEN_PREFIX = '--imp-'

const TOKEN_NAME = /^[a-z][a-z0-9]*(-[a-z0-9]+)*$/

const themeState = createState('imp.theme', null)

export const theme = {
  name: themeState.name,
  get: themeState.get,
  watch: themeState.watch,
  text: themeState.text,
  view: themeState.view,
  each: themeState.each,
}

const warnSuspiciousTokenName = (name) => {
  if (!TOKEN_NAME.test(name)) {
    log.warn(
      `applyTheme: token name '${name}' is suspicious — use a bare dash-separated lowercase name like 'color-primary'; imp adds the '${TOKEN_PREFIX}' prefix. Applying it anyway`,
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
      log.warn(
        `applyTheme: the browser ignored token '${name}' with value '${cssValue}' — check it is a valid CSS value`,
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
    log.warn(
      `applyTheme: colorScheme '${colorScheme}' is neither 'light' nor 'dark' — leaving color-scheme unset`,
    )
    root.style.removeProperty('color-scheme')
    return
  }
  root.style.setProperty('color-scheme', colorScheme)
}

const sharedMetricTokens = {
  'font-family': `system-ui, -apple-system, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif`,
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
  'space-3': '12px',
  'space-4': '16px',
  'space-5': '24px',
  'space-6': '32px',
  'radius-sm': '4px',
  'radius-md': '6px',
  'radius-lg': '10px',
  'duration-fast': '120ms',
  'disabled-opacity': '0.55',
}

const builtInThemes = {
  'imp-light': {
    name: 'imp-light',
    colorScheme: 'light',
    tokens: {
      ...sharedMetricTokens,
      'color-primary': '#2563eb',
      'color-primary-hover': '#1d4ed8',
      'color-primary-active': '#1e40af',
      'color-on-primary': '#ffffff',
      'color-secondary': '#64748b',
      'color-danger': '#dc2626',
      'color-danger-hover': '#b91c1c',
      'color-danger-active': '#991b1b',
      'color-on-danger': '#ffffff',
      'color-text': '#0f172a',
      'color-link': '#2563eb',
      'color-link-hover': '#1d4ed8',
      'color-surface': '#ffffff',
      'color-surface-hover': '#f1f5f9',
      'color-border': '#cbd5e1',
      'color-focus-ring': '#2563eb',
    },
  },
  'imp-dark': {
    name: 'imp-dark',
    colorScheme: 'dark',
    tokens: {
      ...sharedMetricTokens,
      'color-primary': '#7c9cff',
      'color-primary-hover': '#93aaff',
      'color-primary-active': '#6b8bf5',
      'color-on-primary': '#0b1220',
      'color-secondary': '#94a3b8',
      'color-danger': '#f87171',
      'color-danger-hover': '#fca5a5',
      'color-danger-active': '#ef4444',
      'color-on-danger': '#1f0a0a',
      'color-text': '#e2e8f0',
      'color-link': '#7c9cff',
      'color-link-hover': '#a5b8ff',
      'color-surface': '#0f172a',
      'color-surface-hover': '#1e293b',
      'color-border': '#334155',
      'color-focus-ring': '#7c9cff',
    },
  },
}

const builtInThemeNames = Object.keys(builtInThemes)

const listBuiltInThemeNames = () => builtInThemeNames.map((name) => `'${name}'`).join(' or ')

const resolveBuiltInTheme = (name) => {
  if (!Object.hasOwn(builtInThemes, name)) {
    throw new Error(
      `imp: applyTheme does not know a built-in theme named '${name}' — pass ${listBuiltInThemeNames()}, or a theme object`,
    )
  }
  return builtInThemes[name]
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
  themeState.set(themeDefinition)
  log.debug(`applied theme '${themeDefinition.name ?? '(unnamed)'}'`)
  return themeDefinition
}
