import { impLogger } from './logger.js'
import { createState } from './state.js'
import { colorSchemeOf } from './theme-colors.js'
import { applyTheme, resolveTheme } from './theme.js'
import { followPreference, readPreference, writePreference } from './preference.js'

const THEME_STATE = 'imp.theme'

const STORAGE_KEY = 'imp.theme'

const SYSTEM = 'system'

const DEFAULT_CHOICES = [SYSTEM, 'imp-light', 'imp-dark']

const DARK_QUERY = '(prefers-color-scheme: dark)'

const THEMES_SHAPE = "'system', a built-in theme name, or a theme object with a name"

let choiceState = null

let declared = null

let remembering = false

let followingDevice = false

let followingStorage = false

const ensureChoiceState = () => {
  choiceState ??= createState(THEME_STATE, null)
  return choiceState
}

const entryOf = (choice) => {
  if (choice === SYSTEM) return { name: SYSTEM, label: undefined, theme: null }
  if (typeof choice !== 'string' && (!choice || typeof choice !== 'object')) {
    throw new Error(`imp: init({ themes }) - every choice must be ${THEMES_SHAPE}`)
  }
  const resolved = resolveTheme(choice)
  if (typeof resolved.name !== 'string' || resolved.name === '') {
    throw new Error(
      "imp: init({ themes }) - a theme in the list has no name; give it one, like { name: 'brand-dark', label: 'Dark', tokens: { ... } }",
    )
  }
  if (resolved.name === SYSTEM) {
    throw new Error(
      "imp: init({ themes }) - 'system' is the choice that follows the device, so a theme cannot take that name",
    )
  }
  return {
    name: resolved.name,
    label: typeof resolved.label === 'string' ? resolved.label : undefined,
    theme: resolved,
  }
}

const entryWithScheme = (entries, scheme) =>
  entries.find((entry) => entry.theme !== null && colorSchemeOf(entry.theme.tokens) === scheme)

const catalogOf = (choices) => {
  if (!Array.isArray(choices) || choices.length === 0) {
    throw new Error(
      `imp: init({ themes }) needs a non-empty array - each choice is ${THEMES_SHAPE}`,
    )
  }
  const entries = choices.map(entryOf)
  const names = new Set()
  for (const { name } of entries) {
    if (names.has(name)) {
      throw new Error(`imp: init({ themes }) lists '${name}' twice - give each theme its own name`)
    }
    names.add(name)
  }
  const followsDevice = names.has(SYSTEM)
  if (
    followsDevice
    && (entryWithScheme(entries, 'light') === undefined
      || entryWithScheme(entries, 'dark') === undefined)
  ) {
    throw new Error(
      "imp: init({ themes }) lists 'system', so it needs a theme with 'color-scheme' 'light' and a theme with 'color-scheme' 'dark' to follow the device",
    )
  }
  return entries
}

export const themeChoices = () => {
  declared ??= catalogOf(DEFAULT_CHOICES)
  return declared
}

const listNames = () =>
  themeChoices()
    .map(({ name }) => `'${name}'`)
    .join(', ')

const isChoice = (name) => themeChoices().some((entry) => entry.name === name)

const deviceIsDark = () => globalThis.matchMedia?.(DARK_QUERY).matches === true

const themeFor = (name) => {
  const entries = themeChoices()
  const entry = entries.find((candidate) => candidate.name === name)
  if (entry === undefined) return null
  if (entry.theme !== null) return entry.theme
  return entryWithScheme(entries, deviceIsDark() ? 'dark' : 'light').theme
}

const followDevice = () => {
  if (followingDevice || typeof globalThis.matchMedia !== 'function') return
  followingDevice = true
  globalThis.matchMedia(DARK_QUERY).addEventListener('change', () => {
    if (ensureChoiceState().get() === SYSTEM) applyTheme(themeFor(SYSTEM))
  })
}

const choose = (name, { store }) => {
  const resolved = themeFor(name)
  if (resolved === null) {
    impLogger.warn(
      `theme.set: '${name}' is not a theme of the app - the choices are ${listNames()}`,
    )
    return
  }
  if (name === SYSTEM) followDevice()
  applyTheme(resolved)
  ensureChoiceState().set(name)
  if (store && remembering) writePreference(STORAGE_KEY, name)
}

const followStorage = () => {
  if (followingStorage) return
  followingStorage = true
  followPreference(STORAGE_KEY, (name) => {
    if (isChoice(name)) choose(name, { store: false })
  })
}

export const theme = {
  name: THEME_STATE,
  get: () => ensureChoiceState().get(),
  set: (name) => choose(name, { store: true }),
  watch: (...args) => ensureChoiceState().watch(...args),
  text: (select) => ensureChoiceState().text(select),
  view: (render) => ensureChoiceState().view(render),
  each: (renderItem, keyOf) => ensureChoiceState().each(renderItem, keyOf),
}

const nameOf = (choice) => (typeof choice === 'string' ? choice : resolveTheme(choice).name)

const choicesFor = (themes, initial) => {
  if (themes !== undefined) return themes
  if (typeof initial === 'string' && DEFAULT_CHOICES.includes(initial)) return DEFAULT_CHOICES
  return [initial]
}

export const declareThemes = ({ themes, initial, remember }) => {
  if (themes !== undefined || initial !== undefined)
    declared = catalogOf(choicesFor(themes, initial))
  remembering = remember
  if (remember) followStorage()
  const stored = remember ? readPreference(STORAGE_KEY) : null
  if (stored !== null && isChoice(stored)) {
    choose(stored, { store: false })
    return
  }
  if (initial !== undefined) {
    const name = nameOf(initial)
    if (!isChoice(name)) {
      throw new Error(
        `imp: init({ theme }) is '${name}', which init({ themes }) does not list - the choices are ${listNames()}`,
      )
    }
    choose(name, { store: false })
    return
  }
  if (themes !== undefined) choose(themeChoices()[0].name, { store: false })
}
