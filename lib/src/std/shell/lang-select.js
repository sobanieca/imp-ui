import { defineComponent } from '../shared/define.js'
import { appLanguages, defaultMessages, lang, t } from '../../i18n.js'
import { impLogger } from '../../logger.js'
import { computed } from '../../state.js'
import { luLanguages } from '../../icons/lucide-icons.js'
import { oneOf } from '../shared/args.js'
import { SIZES } from '../shared/css.js'
import { icon } from '../general/icon.js'
import { menuButton } from '../general/menu-button.js'
import { flex } from '../layout/flex.js'
import { VARIANTS } from '../general/button.js'

const NAME = 'langSelect'

const KNOWN_PROPS = ['languages', 'label', 'variant', 'size', 'events']

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
      `${NAME}: needs a 'languages' array of codes or { value, label }, or translations in init - showing none`,
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
    const languages = normalizeLanguages(props.languages ?? appLanguages())
    const variant = oneOf(NAME, 'variant', props.variant, VARIANTS, 'default')
    const size = oneOf(NAME, 'size', props.size, SIZES, 'sm')
    const labelOf = (code) => languages.find((entry) => entry.value === code)?.label ?? ''

    const matching = (code) => {
      if (languages.some((entry) => entry.value === code)) return code
      const base = code.split('-')[0]
      return languages.find((entry) => entry.value.split('-')[0] === base)?.value ?? null
    }

    const current = computed([lang], (code) => matching(code))

    const choose = (code) =>
      lang
        .set(code)
        .catch((failure) => impLogger.error(`${NAME}: could not switch to '${code}'`, failure))

    const currentLabel = computed([current], (code) => labelOf(code))
    const name =
      props.label
      ?? computed([lang, currentLabel], (_language, chosen) => t(CURRENT_KEY, { language: chosen }))
    const items = languages.map((entry) => ({
      id: entry.value,
      label: entry.label,
      checked: computed([current], (code) => code === entry.value),
      onClick: () => choose(entry.value),
    }))

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
  defineComponent(
    NAME,
    () => definition,
    () => defaultMessages(messages),
  )(...args)
