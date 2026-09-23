import { applyTheme, defaultTokens, theme, THEME_DEFAULTS } from './theme.js'
import {
  colorSchemeOf,
  colorTokens,
  isHexColor,
  loaderShapeOf,
  loaderTokens,
  radiusLevelOf,
  radiusTokens,
  shadowColor,
  shadowLevelOf,
  shadowTokens,
} from './theme-colors.js'

const TOKEN_PREFIX = '--imp-'

const DRAFT_STORAGE_PREFIX = 'imp.theme-draft.'

const UNNAMED_THEME = 'imp'

const PRIMARY_DRIVEN = ['color-primary', 'color-on-primary']

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

const pick = (tokens, names) => Object.fromEntries(names.map((name) => [name, tokens[name]]))

export const seedDraft = () => {
  const base = Object.keys(baseTokens).length > 0 ? baseTokens : readAppliedTokens()
  return { tokens: { ...defaultTokens(), ...base }, base: { ...base } }
}

export const isFontStack = (value) => typeof value === 'string' && value.trim() !== ''

const isTokenMap = (value) =>
  !!value && typeof value === 'object' && !Array.isArray(value) &&
  Object.keys(value).length > 0 &&
  Object.values(value).every((entry) => typeof entry === 'string')

const validDraft = (value) =>
  !!value && typeof value === 'object' && !Array.isArray(value) && isTokenMap(value.tokens) &&
  isTokenMap(value.base)

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

const schemeOf = (draft) => colorSchemeOf(draft.tokens) ?? 'light'

export const knobsOf = (draft) => {
  const { tokens } = draft
  const fonts = defaultTokens()
  return {
    primary: isHexColor(tokens['color-primary']) ? tokens['color-primary'] : THEME_DEFAULTS.primary,
    secondary: isHexColor(tokens['color-secondary'])
      ? tokens['color-secondary']
      : THEME_DEFAULTS.secondary,
    font: isFontStack(tokens['font-family']) ? tokens['font-family'] : fonts['font-family'],
    fontMono: isFontStack(tokens['font-family-mono'])
      ? tokens['font-family-mono']
      : fonts['font-family-mono'],
    radius: radiusLevelOf(tokens),
    shadow: shadowLevelOf(tokens),
    loader: loaderShapeOf(tokens),
    shadowColor: isHexColor(tokens['color-shadow'])
      ? tokens['color-shadow']
      : shadowColor(schemeOf(draft)),
  }
}

const assign = (draft, tokens) => {
  draft.tokens = { ...draft.tokens, ...tokens }
}

export const setBaseColor = (draft, key, value) => {
  const derived = colorTokens({ ...knobsOf(draft), [key]: value, mode: schemeOf(draft) })
  assign(draft, pick(derived, key === 'primary' ? PRIMARY_DRIVEN : SECONDARY_DRIVEN))
}

export const setFont = (draft, name, value) => assign(draft, { [name]: value })

export const setRadius = (draft, level) => assign(draft, radiusTokens(level))

export const setShadow = (draft, level) => assign(draft, shadowTokens(level))

export const setLoader = (draft, shape) => assign(draft, loaderTokens(shape))

export const setShadowColor = (draft, value) => assign(draft, { 'color-shadow': value })

export const setTokens = (draft, tokens) => {
  draft.tokens = { ...tokens }
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
    applyTheme({ name: themeName, tokens: draft.tokens })
  } finally {
    applyingDraft = false
  }
}

const applyStoredDraft = (themeName) => {
  const draft = readDraft(themeName)
  if (draft && sameTokens(draft.base, baseTokens)) {
    applyDraft(themeName, draft)
    return
  }
  clearDraft(themeName)
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

export const themeFileSource = (themeName, draft) =>
  `// Generated by the imp theme editor.
// Every value below is a plain CSS value - edit any of them by hand.
// A role such as color-danger points at a palette colour with var(), so a change to that
// colour moves the role.
// Load a web font named here with a <link> in index.html, at the weights of font-weight-normal
// and font-weight-bold.
const theme = {
  name: ${quote(themeName)},
  tokens: {
${entries(draft.tokens, '    ')}
  },
}

export default theme
`
