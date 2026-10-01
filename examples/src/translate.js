import { lang, t } from 'imp/i18n'
import { computed } from 'imp/state'

export const tr = (key, values) => lang.text(() => t(key, values))

export const translated = (key, values) => computed([lang], () => t(key, values))
