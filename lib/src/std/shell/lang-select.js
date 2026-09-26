import { defineComponent } from '../shared/define.js'
import { defaultMessages, lang, setLang, t } from '../../api/i18n.js'
import { impLogger } from '../../logger.js'
import { computed, createState } from '../../state.js'
import { luLanguages } from '../../icons/lucide-icons.js'
import { oneOf } from '../shared/args.js'
import { SIZES } from '../shared/css.js'
import { readPreference, writePreference } from '../shared/preference.js'
import { icon } from '../general/icon.js'
import { menuButton } from '../general/menu-button.js'
import { flex } from '../layout/flex.js'
import { VARIANTS } from '../general/button.js'

const NAME = 'langSelect'

const KNOWN_PROPS = ['languages', 'remember', 'label', 'variant', 'size', 'events']

const STORAGE_KEY = 'imp.lang'

const LABEL_KEY = 'imp.lang.label'

const CURRENT_KEY = 'imp.lang.current'

const messages = {
  [LABEL_KEY]: 'Language',
  [CURRENT_KEY]: 'Language: {language}',
}

const endonym = (code) => {
  try {
    return new Intl.DisplayNames([code], { type: 'language' }).of(code) ?? code
  } catch (failure) {
    impLogger.debug(`${NAME}: '${code}' has no display name - showing the code`, failure)
    return code
  }
}

const normalizeLanguages = (value) => {
  if (!Array.isArray(value) || value.length === 0) {
    impLogger.warn(
      `${NAME}: needs a 'languages' array of codes or { value, label } - showing none`,
    )
    return []
  }
  return value.flatMap((entry) => {
    if (typeof entry === 'string') return [{ value: entry, label: endonym(entry) }]
    if (entry && typeof entry === 'object' && entry.value !== undefined) {
      const code = String(entry.value)
      return [{ value: code, label: String(entry.label ?? endonym(code)) }]
    }
    impLogger.warn(`${NAME}: a language is neither a code nor { value, label } - skipping it`)
    return []
  })
}

const definition = {
  props: KNOWN_PROPS,
  setup: (self, props, children) => {
    if (children.length > 0) {
      impLogger.warn(`${NAME}: takes no content - pass the choices as 'languages'`)
    }
    const languages = normalizeLanguages(props.languages)
    const remember = props.remember !== false
    const variant = oneOf(NAME, 'variant', props.variant, VARIANTS, 'default')
    const size = oneOf(NAME, 'size', props.size, SIZES, 'sm')
    const current = createState('imp.langSelect.current', languages[0]?.value ?? null)
    const known = (code) => languages.some((entry) => entry.value === code)
    const labelOf = (code) => languages.find((entry) => entry.value === code)?.label ?? ''

    const matching = (code) => {
      if (code === null) return null
      if (known(code)) return code
      const base = code.split('-')[0]
      return languages.find((entry) => entry.value.split('-')[0] === base)?.value ?? null
    }

    const choose = (code, { store }) => {
      if (!known(code)) return
      current.set(code)
      if (store && remember) writePreference(STORAGE_KEY, code)
      setLang(code).catch((failure) =>
        impLogger.error(`${NAME}: could not switch to '${code}'`, failure)
      )
    }

    const reflect = () => {
      const code = matching(lang.get())
      if (code !== null && current.get() !== code) current.set(code)
    }

    const currentLabel = computed([current], (code) => labelOf(code))
    const name = props.label ?? computed(
      [lang, currentLabel],
      (_language, chosen) => t(CURRENT_KEY, { language: chosen }),
    )
    const items = languages.map((entry) => ({
      id: entry.value,
      label: entry.label,
      checked: computed([current], (code) => code === entry.value),
      onClick: () => choose(entry.value, { store: true }),
    }))

    lang.watch(self, reflect)

    const stored = remember ? readPreference(STORAGE_KEY) : null
    if (stored !== null && known(stored) && stored !== lang.get()) {
      choose(stored, { store: false })
    } else reflect()

    return menuButton(
      { trigger: 'arrow', variant, size, label: name, items, events: props.events },
      flex(
        { gap: 2, verticalAlign: 'center' },
        icon(luLanguages, { size: 'sm' }),
        currentLabel.text((value) => value),
      ),
    )
  },
}

export const langSelect = (...args) =>
  defineComponent(NAME, () => definition, () => defaultMessages(messages))(...args)
