import { defineComponent } from '../shared/define.js'
import { defaultMessages, lang, t } from '../../api/i18n.js'
import { appliedTheme, colorSchemeOf } from '../../theme.js'
import { theme, themeChoices } from '../../theme-choice.js'
import { impLogger } from '../../logger.js'
import { computed } from '../../state.js'
import { luMonitor, luMoon, luPalette, luSun } from '../../icons/lucide-icons.js'
import { oneOf } from '../shared/args.js'
import { SIZES } from '../shared/css.js'
import { icon } from '../general/icon.js'
import { menuButton } from '../general/menu-button.js'
import { flex } from '../layout/flex.js'
import { VARIANTS } from '../general/button.js'

const NAME = 'themeSelect'

const KNOWN_PROPS = ['label', 'variant', 'size', 'events']

const SYSTEM = 'system'

const LABEL_KEY = 'imp.theme.label'

const CURRENT_KEY = 'imp.theme.current'

const BUILT_IN_KEYS = {
  [SYSTEM]: 'imp.theme.system',
  'imp-light': 'imp.theme.light',
  'imp-dark': 'imp.theme.dark',
}

const SCHEME_ICONS = {
  light: luSun,
  dark: luMoon,
}

const messages = {
  [LABEL_KEY]: 'Theme',
  [CURRENT_KEY]: 'Theme: {theme}',
  'imp.theme.system': 'System',
  'imp.theme.light': 'Light',
  'imp.theme.dark': 'Dark',
}

const labelFor = (entry) => {
  if (entry.label !== undefined) return entry.label
  const key = BUILT_IN_KEYS[entry.name]
  return key === undefined ? entry.name : t(key)
}

const iconFor = (entry) => {
  if (entry === null) return null
  const glyph =
    entry.theme === null
      ? luMonitor
      : (SCHEME_ICONS[colorSchemeOf(entry.theme.tokens)] ?? luPalette)
  return icon(glyph, { size: 'sm' })
}

const definition = {
  props: KNOWN_PROPS,
  setup: (self, props, children) => {
    if (children.length > 0) {
      impLogger.warn(`${NAME}: takes no content - list the choices in init({ themes })`)
    }
    const choices = themeChoices()
    const variant = oneOf(NAME, 'variant', props.variant, VARIANTS, 'default')
    const size = oneOf(NAME, 'size', props.size, SIZES, 'sm')
    const entryFor = (name) => choices.find((entry) => entry.name === name) ?? null

    const current = computed(
      [theme, appliedTheme],
      (choice, applied) => choice ?? entryFor(applied?.name)?.name ?? null,
    )
    const currentLabel = computed([lang, current], (_language, name) => {
      const entry = entryFor(name)
      return entry === null ? '' : labelFor(entry)
    })
    const name =
      props.label
      ?? computed([lang, currentLabel], (_language, chosen) => t(CURRENT_KEY, { theme: chosen }))
    const items = choices.map((entry) => ({
      id: entry.name,
      label: computed([lang], () => labelFor(entry)),
      icon: iconFor(entry),
      checked: computed([current], (chosen) => chosen === entry.name),
      onClick: () => theme.set(entry.name),
    }))

    return menuButton(
      { trigger: 'arrow', variant, size, label: name, items, events: props.events },
      flex(
        { gap: 2, verticalAlign: 'center' },
        current.view((chosen) => iconFor(entryFor(chosen))),
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
