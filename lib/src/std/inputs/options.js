import { lang } from '../../api/i18n.js'
import { impLogger } from '../../logger.js'
import { isStateShaped } from '../../render.js'

export const normalizeOptions = (name, options) => {
  if (!Array.isArray(options)) {
    impLogger.warn(
      `${name}: 'options' must be an array of { value, label } or plain strings - rendering none`,
    )
    return []
  }
  return options.flatMap((entry) => {
    if (typeof entry === 'string' || typeof entry === 'number') {
      return [{ value: String(entry), label: String(entry), icon: null, disabled: false }]
    }
    if (entry && typeof entry === 'object' && entry.value !== undefined) {
      return [{
        value: String(entry.value),
        label: isStateShaped(entry.label) ? entry.label : String(entry.label ?? entry.value),
        icon: entry.icon ?? null,
        disabled: Boolean(entry.disabled),
      }]
    }
    impLogger.warn(`${name}: an option is neither a string nor { value, label } - skipping it`)
    return []
  })
}

export const asValueList = (value) => {
  if (Array.isArray(value)) return value.map(String)
  if (value === undefined || value === null || value === '') return []
  return [String(value)]
}

export const isEmptyList = (value) => asValueList(value).length === 0

export const lowered = (name, text) => {
  try {
    return text.toLocaleLowerCase(lang.get())
  } catch (failure) {
    impLogger.debug(`${name}: '${lang.get()}' is not a language tag Intl reads`, failure)
    return text.toLocaleLowerCase()
  }
}
