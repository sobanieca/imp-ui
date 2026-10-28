import { declareThemes } from './theme-choice.js'
import { declareLanguages, pinDir } from './i18n.js'
import { isPlainObject } from './render.js'
import { setDefaults } from './defaults.js'

const KNOWN_OPTIONS = ['themes', 'theme', 'translations', 'lang', 'dir', 'persist', 'defaults']

const PREFERENCES = ['theme', 'lang']

const rememberedPreferences = (persist) => {
  if (persist === undefined || typeof persist === 'boolean') {
    return { theme: persist === true, lang: persist === true }
  }
  const valid =
    isPlainObject(persist)
    && Object.entries(persist).every(
      ([name, value]) => PREFERENCES.includes(name) && typeof value === 'boolean',
    )
  if (!valid) {
    throw new Error(
      `imp: init({ persist }) takes true, false, or an object like { theme: true, lang: false }`,
    )
  }
  return { theme: persist.theme === true, lang: persist.lang === true }
}

export async function init(options = {}) {
  if (!isPlainObject(options)) {
    throw new Error(
      `imp: init needs an options object like { theme: 'imp-light', translations: { en: () => import('./locales/en.js') } }`,
    )
  }
  const unknown = Object.keys(options).filter((name) => !KNOWN_OPTIONS.includes(name))
  if (unknown.length > 0) {
    throw new Error(
      `imp: init got unknown option${unknown.length > 1 ? 's' : ''} ${unknown
        .map((name) => `'${name}'`)
        .join(', ')} - it takes ${KNOWN_OPTIONS.map((name) => `'${name}'`).join(', ')}`,
    )
  }
  const { themes, theme, translations, lang, dir, persist, defaults } = options
  const remember = rememberedPreferences(persist)
  if (defaults !== undefined) setDefaults(defaults)
  declareThemes({ themes, initial: theme, remember: remember.theme })
  if (dir !== undefined) pinDir(dir)
  await declareLanguages({ initial: lang, translations, remember: remember.lang })
}
