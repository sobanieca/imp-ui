import { lang } from '../../api/i18n.js'

export const activeLocale = () => {
  try {
    return Intl.getCanonicalLocales(lang.get())[0]
  } catch {
    return undefined
  }
}
