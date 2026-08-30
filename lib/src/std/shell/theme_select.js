import { defineComponent } from '../shared/define.js'
import { el, option } from '../../api/html.js'
import { defaultMessages, lang, t } from '../../api/i18n.js'
import { applyTheme, theme } from '../../theme.js'
import { impLogger } from '../../logger.js'
import { bindValue } from '../shared/args.js'
import { readPreference, writePreference } from '../shared/preference.js'
import { fontFamily, forcedColors, token } from '../shared/css.js'

const NAME = 'themeSelect'

const KNOWN_PROPS = ['themes', 'remember', 'label', 'events']

const STORAGE_KEY = 'imp.theme'

const SYSTEM = 'system'

const LIGHT = 'imp-light'

const DARK = 'imp-dark'

const DARK_QUERY = '(prefers-color-scheme: dark)'

const LABEL_KEY = 'imp.theme.label'

const BUILT_IN_KEYS = {
  [SYSTEM]: 'imp.theme.system',
  [LIGHT]: 'imp.theme.light',
  [DARK]: 'imp.theme.dark',
}

const messages = {
  [LABEL_KEY]: 'Theme',
  'imp.theme.system': 'System',
  'imp.theme.light': 'Light',
  'imp.theme.dark': 'Dark',
}

const styles = () => `
  select {
    box-sizing: border-box;
    margin: 0;
    padding-block: ${token('space-1')};
    padding-inline: ${token('space-2')};
    border: ${token('border-width')} solid ${token('color-border')};
    border-radius: ${token('radius-md')};
    background-color: ${token('color-surface')};
    color: ${token('color-text')};
    ${fontFamily()}
    font-size: ${token('font-size-sm')};
    line-height: ${token('line-height-tight')};
  }

  select:focus-visible {
    outline: ${token('focus-ring-width')} solid ${token('color-focus-ring')};
    outline-offset: 2px;
  }

  ${forcedColors}
`

const DEFAULT_THEMES = [SYSTEM, LIGHT, DARK]

const normalizeThemes = (value) => {
  if (value === undefined) return DEFAULT_THEMES.map((name) => ({ value: name, theme: name }))
  if (!Array.isArray(value) || value.length === 0) {
    impLogger.warn(
      `${NAME}: 'themes' must be a non-empty array of theme names or { value, label, theme } - using the built-in ones`,
    )
    return DEFAULT_THEMES.map((name) => ({ value: name, theme: name }))
  }
  return value.flatMap((entry) => {
    if (typeof entry === 'string') return [{ value: entry, theme: entry }]
    if (entry && typeof entry === 'object' && entry.value !== undefined) {
      return [{
        value: String(entry.value),
        label: entry.label,
        theme: entry.theme ?? String(entry.value),
      }]
    }
    impLogger.warn(`${NAME}: a theme is neither a name nor { value, label, theme } - skipping it`)
    return []
  })
}

const labelFor = (entry) => {
  if (entry.label !== undefined) return String(entry.label)
  const key = BUILT_IN_KEYS[entry.value]
  return key === undefined ? entry.value : t(key)
}

const definition = {
  styles,
  props: KNOWN_PROPS,
  build: (instance, props, children) => {
    if (children.length > 0) {
      impLogger.warn(`${NAME}: takes no content - pass the choices as 'themes'`)
    }
    const themes = normalizeThemes(props.themes)
    const remember = props.remember !== false
    const prefersDark = matchMedia(DARK_QUERY)
    const control = el(
      'select',
      {},
      ...themes.map((entry) => option({ value: entry.value }, labelFor(entry))),
    )
    const entryFor = (value) => themes.find((entry) => entry.value === value) ?? null

    const resolve = (entry) => {
      if (entry.theme !== SYSTEM) return entry.theme
      return prefersDark.matches ? DARK : LIGHT
    }

    const apply = (entry) => {
      try {
        applyTheme(resolve(entry))
      } catch (failure) {
        impLogger.error(`${NAME}: could not apply the '${entry.value}' theme`, failure)
      }
    }

    const choose = (value, { store }) => {
      const entry = entryFor(value)
      if (entry === null) return
      control.value = entry.value
      if (store && remember) writePreference(STORAGE_KEY, entry.value)
      apply(entry)
    }

    const appliedName = () => theme.get()?.name ?? null

    const reflect = () => {
      const name = appliedName()
      const entry = themes.find((candidate) => candidate.theme === name)
      if (entry !== undefined && control.value !== entry.value) control.value = entry.value
    }

    control.addEventListener('change', () => choose(control.value, { store: true }))
    if (props.label === undefined) {
      lang.watch(() => {
        control.setAttribute('aria-label', t(LABEL_KEY))
        for (const [index, entry] of themes.entries()) control.options[index].text = labelFor(entry)
      })
    } else bindValue(props.label, (value) => control.setAttribute('aria-label', String(value)))

    prefersDark.addEventListener('change', () => {
      if (entryFor(control.value)?.theme === SYSTEM) choose(control.value, { store: false })
    }, { signal: instance.abortSignal })
    theme.watch(reflect)

    const stored = remember ? readPreference(STORAGE_KEY) : null
    if (stored !== null && entryFor(stored) !== null) choose(stored, { store: false })
    else if (appliedName() === null) choose(themes[0].value, { store: false })
    else reflect()
    return control
  },
}

export const themeSelect = (...args) =>
  defineComponent(NAME, () => definition, () => defaultMessages(messages))(...args)
