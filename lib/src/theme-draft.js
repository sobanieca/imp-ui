import { applyTheme, buildTokens, defaultTokens, theme, THEME_DEFAULTS } from './theme.js'
import {
  colorSchemeOf,
  colorTokens,
  isHexColor,
  paletteNames,
  radiusLevelOf,
  radiusTokens,
  SEMANTIC_SOURCES,
  shadowLevelOf,
  shadowTokens,
} from './theme-colors.js'

const TOKEN_PREFIX = '--imp-'

const DRAFT_STORAGE_PREFIX = 'imp.theme-draft.'

const UNNAMED_THEME = 'imp'

export const MODES = ['light', 'dark']

const MODE_DEFAULTS = {
  light: { primary: THEME_DEFAULTS.primary, secondary: THEME_DEFAULTS.secondary },
  dark: { primary: '#7c9cff', secondary: '#94a3b8' },
}

const FONT_TOKENS = ['font-family', 'font-family-mono']

const KNOB_TOKEN_PREFIXES = ['color-', 'radius-', 'shadow-', 'font-family', 'background-app']

const PRIMARY_DRIVEN = [
  'color-primary',
  'color-primary-hover',
  'color-primary-active',
  'color-on-primary',
  'color-focus-ring',
  'color-link',
  'color-link-hover',
]

const SECONDARY_DRIVEN = [
  'color-secondary',
  'color-text',
  'color-surface',
  'color-surface-sunken',
  'color-surface-hover',
  'color-border',
]

let baseTokens = {}

let applyingDraft = false

const readAppliedTokens = () => {
  const { style } = document.documentElement
  const tokens = {}
  for (const property of style) {
    if (property.startsWith(TOKEN_PREFIX)) {
      tokens[property.slice(TOKEN_PREFIX.length)] = style.getPropertyValue(property).trim()
    }
  }
  return tokens
}

const snapshotBaseTokens = () => {
  baseTokens = readAppliedTokens()
  return baseTokens
}

export const appliedThemeName = () => theme.get()?.name ?? UNNAMED_THEME

const draftKey = (themeName) => `${DRAFT_STORAGE_PREFIX}${themeName}`

const otherMode = (mode) => (mode === 'light' ? 'dark' : 'light')

const pick = (tokens, names) => Object.fromEntries(names.map((name) => [name, tokens[name]]))

const keptTokens = (tokens) =>
  Object.fromEntries(
    Object.entries(tokens).filter(([name]) =>
      !KNOB_TOKEN_PREFIXES.some((prefix) => name.startsWith(prefix))
    ),
  )

export const seedDraft = () => {
  const applied = { ...defaultTokens(), ...baseTokens }
  const scheme = colorSchemeOf(applied) ?? 'light'
  const other = otherMode(scheme)
  const otherTokens = buildTokens({
    ...MODE_DEFAULTS[other],
    radius: radiusLevelOf(applied),
    shadow: shadowLevelOf(applied, scheme),
    mode: other,
    overrides: { ...keptTokens(applied), ...pick(applied, FONT_TOKENS) },
  })
  return {
    mode: scheme,
    [scheme]: { tokens: applied },
    [other]: { tokens: otherTokens },
  }
}

export const isFontStack = (value) => typeof value === 'string' && value.trim() !== ''

const isTokenMap = (value) =>
  !!value && typeof value === 'object' && !Array.isArray(value) &&
  Object.keys(value).length > 0 &&
  Object.values(value).every((entry) => typeof entry === 'string')

const validDraft = (value) =>
  !!value && typeof value === 'object' && !Array.isArray(value) && MODES.includes(value.mode) &&
  MODES.every((mode) => isTokenMap(value[mode]?.tokens))

export const readDraft = (themeName) => {
  try {
    const stored = JSON.parse(localStorage.getItem(draftKey(themeName)) ?? 'null')
    return validDraft(stored) ? stored : null
  } catch {
    return null
  }
}

const writeDraft = (themeName, draft) => {
  try {
    localStorage.setItem(draftKey(themeName), JSON.stringify(draft))
  } catch { /* storage is unavailable - the tweak just does not survive a reload */ }
}

export const clearDraft = (themeName) => {
  try {
    localStorage.removeItem(draftKey(themeName))
  } catch { /* storage is unavailable - nothing was stored to clear */ }
}

export const tokensOf = (draft) => draft[draft.mode].tokens

export const knobsOf = (draft) => {
  const tokens = tokensOf(draft)
  const defaults = MODE_DEFAULTS[draft.mode]
  const fonts = defaultTokens()
  return {
    primary: isHexColor(tokens['color-primary']) ? tokens['color-primary'] : defaults.primary,
    secondary: isHexColor(tokens['color-secondary'])
      ? tokens['color-secondary']
      : defaults.secondary,
    font: isFontStack(tokens['font-family']) ? tokens['font-family'] : fonts['font-family'],
    fontMono: isFontStack(tokens['font-family-mono'])
      ? tokens['font-family-mono']
      : fonts['font-family-mono'],
    radius: radiusLevelOf(tokens),
    shadow: shadowLevelOf(tokens, draft.mode),
  }
}

const assign = (draft, mode, tokens) => {
  draft[mode] = { tokens: { ...draft[mode].tokens, ...tokens } }
}

export const setBaseColor = (draft, key, value) => {
  const derived = colorTokens({ ...knobsOf(draft), [key]: value, mode: draft.mode })
  assign(draft, draft.mode, pick(derived, key === 'primary' ? PRIMARY_DRIVEN : SECONDARY_DRIVEN))
}

export const setFont = (draft, name, value) => {
  for (const mode of MODES) assign(draft, mode, { [name]: value })
}

export const setRadius = (draft, level) => {
  for (const mode of MODES) assign(draft, mode, radiusTokens(level))
}

export const setShadow = (draft, level) => {
  for (const mode of MODES) assign(draft, mode, shadowTokens(level, mode))
}

export const setTokens = (draft, tokens) => {
  draft[draft.mode] = { tokens: { ...tokens } }
}

export const parseTokens = (text) => {
  try {
    const parsed = JSON.parse(text)
    return isTokenMap(parsed) ? parsed : null
  } catch {
    return null
  }
}

export const tokensJson = (tokens) => JSON.stringify(tokens, null, 2)

export const sameTokens = (left, right) => {
  const names = Object.keys(left)
  return names.length === Object.keys(right).length &&
    names.every((name) => left[name] === right[name])
}

export const applyDraft = (themeName, draft) => {
  writeDraft(themeName, draft)
  applyingDraft = true
  try {
    applyTheme({ name: themeName, tokens: tokensOf(draft) })
  } finally {
    applyingDraft = false
  }
}

const applyStoredDraft = (themeName) => {
  const draft = readDraft(themeName)
  if (draft) applyDraft(themeName, draft)
}

export const followAppliedTheme = () =>
  theme.watch((definition) => {
    if (!definition || applyingDraft) return
    snapshotBaseTokens()
    applyStoredDraft(definition.name ?? UNNAMED_THEME)
  })

const quote = (value) => {
  const text = String(value)
  return text.includes("'") ? `"${text.replaceAll('"', '\\"')}"` : `'${text}'`
}

const entries = (tokens, indent) =>
  Object.entries(tokens)
    .map(([name, value]) => `${indent}${quote(name)}: ${quote(value)},`)
    .join('\n')

const sharedTokens = (draft, names) =>
  Object.fromEntries(
    names
      .filter((name) =>
        typeof draft.light.tokens[name] === 'string' &&
        draft.light.tokens[name] === draft.dark.tokens[name]
      )
      .map((name) => [name, draft.light.tokens[name]]),
  )

const themeSource = (themeName, draft, mode, fonts, palette) => {
  const tokens = draft[mode].tokens
  const aliased = (name) => {
    const source = SEMANTIC_SOURCES[name]
    return source !== undefined && tokens[name] === palette[`color-${source}`]
  }
  const own = Object.fromEntries(
    Object.entries(tokens).filter(([name]) =>
      !Object.hasOwn(fonts, name) && !Object.hasOwn(palette, name) && !aliased(name)
    ),
  )
  const aliases = Object.keys(SEMANTIC_SOURCES)
    .filter(aliased)
    .map((name) => `    ${quote(name)}: palette[${quote(`color-${SEMANTIC_SOURCES[name]}`)}],`)
    .join('\n')
  return `export const ${mode} = {
  name: ${quote(`${themeName}-${mode}`)},
  tokens: {
    ...fonts,
    ...palette,
${aliases}
${entries(own, '    ')}
  },
}`
}

export const themeFileSource = (themeName, draft) => {
  const fonts = sharedTokens(draft, FONT_TOKENS)
  const palette = sharedTokens(draft, paletteNames().map((name) => `color-${name}`))
  return `// Generated by the imp theme editor.
// Every value below is a plain CSS value - edit any of them by hand.
// The fonts and the palette are shared by both themes.
// Load a web font named here with a <link> in index.html, at the weights of font-weight-normal
// and font-weight-bold.
const fonts = {
${entries(fonts, '  ')}
}

const palette = {
${entries(palette, '  ')}
}

${themeSource(themeName, draft, 'light', fonts, palette)}

${themeSource(themeName, draft, 'dark', fonts, palette)}

export default light
`
}
