import { defineComponent } from '../shared/define.js'
import { defaultMessages, lang, t } from '../../api/i18n.js'
import { applyTheme, theme } from '../../theme.js'
import { impLogger } from '../../logger.js'
import { computed, createState } from '../../state.js'
import { luMonitor, luMoon, luPalette, luSun } from '../../icons/lucide-icons.js'
import { oneOf } from '../shared/args.js'
import { SIZES } from '../shared/css.js'
import { readPreference, writePreference } from '../shared/preference.js'
import { icon } from '../general/icon.js'
import { menuButton } from '../general/menu-button.js'
import { flex } from '../layout/flex.js'
import { VARIANTS } from '../general/button.js'

const NAME = 'themeSelect'

const KNOWN_PROPS = ['themes', 'remember', 'label', 'variant', 'size', 'events']

const STORAGE_KEY = 'imp.theme'

const SYSTEM = 'system'

const LIGHT = 'imp-light'

const DARK = 'imp-dark'

const DARK_QUERY = '(prefers-color-scheme: dark)'

const LABEL_KEY = 'imp.theme.label'

const CURRENT_KEY = 'imp.theme.current'

const BUILT_IN_KEYS = {
  [SYSTEM]: 'imp.theme.system',
  [LIGHT]: 'imp.theme.light',
  [DARK]: 'imp.theme.dark',
}

const BUILT_IN_ICONS = {
  [SYSTEM]: luMonitor,
  [LIGHT]: luSun,
  [DARK]: luMoon,
}

const messages = {
  [LABEL_KEY]: 'Theme',
  [CURRENT_KEY]: 'Theme: {theme}',
  'imp.theme.system': 'System',
  'imp.theme.light': 'Light',
  'imp.theme.dark': 'Dark',
}

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
      return [
        {
          value: String(entry.value),
          label: entry.label,
          theme: entry.theme ?? String(entry.value),
        },
      ]
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

const iconFor = (entry) => icon(BUILT_IN_ICONS[entry.value] ?? luPalette, { size: 'sm' })

const definition = {
  props: KNOWN_PROPS,
  setup: (self, props, children) => {
    if (children.length > 0) {
      impLogger.warn(`${NAME}: takes no content - pass the choices as 'themes'`)
    }
    const themes = normalizeThemes(props.themes)
    const remember = props.remember !== false
    const variant = oneOf(NAME, 'variant', props.variant, VARIANTS, 'default')
    const size = oneOf(NAME, 'size', props.size, SIZES, 'sm')
    const prefersDark = matchMedia(DARK_QUERY)
    const current = createState('imp.themeSelect.current', themes[0].value)
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

    let chosen = null

    const choose = (value, { store }) => {
      const entry = entryFor(value)
      if (entry === null) return
      chosen = entry
      current.set(entry.value)
      if (store && remember) writePreference(STORAGE_KEY, entry.value)
      apply(entry)
    }

    const appliedName = () => theme.get()?.name ?? null

    const reflect = () => {
      const name = appliedName()
      if (chosen !== null && chosen.value === current.get() && resolve(chosen) === name) return
      const entry = themes.find((candidate) => candidate.theme === name)
      if (entry !== undefined && current.get() !== entry.value) current.set(entry.value)
    }

    const currentLabel = computed([lang, current], (_language, value) => labelFor(entryFor(value)))
    const name =
      props.label
      ?? computed([lang, currentLabel], (_language, chosen) => t(CURRENT_KEY, { theme: chosen }))
    const items = themes.map((entry) => ({
      id: entry.value,
      label: computed([lang], () => labelFor(entry)),
      icon: iconFor(entry),
      checked: computed([current], (value) => value === entry.value),
      onClick: () => choose(entry.value, { store: true }),
    }))

    prefersDark.addEventListener(
      'change',
      () => {
        if (entryFor(current.get())?.theme === SYSTEM) choose(current.get(), { store: false })
      },
      { signal: self.abortSignal },
    )
    theme.watch(self, reflect)

    const stored = remember ? readPreference(STORAGE_KEY) : null
    if (stored !== null && entryFor(stored) !== null) choose(stored, { store: false })
    else if (appliedName() === null) choose(themes[0].value, { store: false })
    else reflect()

    return menuButton(
      { trigger: 'arrow', variant, size, label: name, items, events: props.events },
      flex(
        { gap: 2, verticalAlign: 'center' },
        current.view((value) => iconFor(entryFor(value))),
        currentLabel.text((value) => value),
      ),
    )
  },
}

export const themeSelect = (...args) =>
  defineComponent(
    NAME,
    () => definition,
    () => defaultMessages(messages),
  )(...args)
