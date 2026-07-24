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

const builtInThemes = {
  'default-light': {
    name: 'default-light',
    colorScheme: 'light',
    tokens: {
      'color-primary': '#2563eb',
      'color-secondary': '#64748b',
    },
  },
  'default-dark': {
    name: 'default-dark',
    colorScheme: 'dark',
    tokens: {
      'color-primary': '#7c9cff',
      'color-secondary': '#94a3b8',
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
