import { defineComponent } from '../shared/define.js'
import { el, option } from '../../api/html.js'
import { defaultMessages, lang, setLang, t } from '../../api/i18n.js'
import { impLogger } from '../../logger.js'
import { bindValue } from '../shared/args.js'
import { readPreference, writePreference } from '../shared/preference.js'
import { fontFamily, forcedColors, token } from '../shared/css.js'

const NAME = 'langSelect'

const KNOWN_PROPS = ['languages', 'remember', 'label', 'events']

const STORAGE_KEY = 'imp.lang'

const LABEL_KEY = 'imp.lang.label'

const messages = {
  [LABEL_KEY]: 'Language',
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
  styles,
  props: KNOWN_PROPS,
  build: (_instance, props, children) => {
    if (children.length > 0) {
      impLogger.warn(`${NAME}: takes no content - pass the choices as 'languages'`)
    }
    const languages = normalizeLanguages(props.languages)
    const remember = props.remember !== false
    const control = el(
      'select',
      {},
      ...languages.map((entry) => option({ value: entry.value }, entry.label)),
    )
    const known = (code) => languages.some((entry) => entry.value === code)

    const matching = (code) => {
      if (code === null) return null
      if (known(code)) return code
      const base = code.split('-')[0]
      return languages.find((entry) => entry.value.split('-')[0] === base)?.value ?? null
    }

    const choose = (code, { store }) => {
      if (!known(code)) return
      control.value = code
      if (store && remember) writePreference(STORAGE_KEY, code)
      setLang(code).catch((failure) =>
        impLogger.error(`${NAME}: could not switch to '${code}'`, failure)
      )
    }

    const reflect = () => {
      const code = matching(lang.get())
      if (code !== null && control.value !== code) control.value = code
    }

    control.addEventListener('change', () => choose(control.value, { store: true }))
    if (props.label === undefined) {
      lang.watch(() => control.setAttribute('aria-label', t(LABEL_KEY)))
    } else bindValue(props.label, (value) => control.setAttribute('aria-label', String(value)))
    lang.watch(reflect)

    const stored = remember ? readPreference(STORAGE_KEY) : null
    if (stored !== null && known(stored) && stored !== lang.get()) {
      choose(stored, { store: false })
    } else reflect()
    return control
  },
}

export const langSelect = (...args) =>
  defineComponent(NAME, () => definition, () => defaultMessages(messages))(...args)
