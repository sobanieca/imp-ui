import { applyTheme } from './theme.js'
import { applyDirection, pinDir, readLang, translationSource, writeLang } from './i18n.js'
import { isPlainObject } from './render.js'

const KNOWN_OPTIONS = ['theme', 'translations', 'lang', 'dir']

export async function init(options = {}) {
  if (!isPlainObject(options)) {
    throw new Error(
      `imp: init needs an options object like { theme: 'imp-light', translations: { en: () => import('./locales/en.js') } }`,
    )
  }
  const unknown = Object.keys(options).filter((name) => !KNOWN_OPTIONS.includes(name))
  if (unknown.length > 0) {
    throw new Error(
      `imp: init got unknown option${unknown.length > 1 ? 's' : ''} ${
        unknown.map((name) => `'${name}'`).join(', ')
      } — it takes ${KNOWN_OPTIONS.map((name) => `'${name}'`).join(', ')}`,
    )
  }
  const { theme, translations, lang, dir } = options
  if (theme !== undefined) applyTheme(theme)
  if (dir !== undefined) pinDir(dir)
  if (lang !== undefined) {
    if (typeof lang !== 'string' || lang.trim() === '') {
      throw new Error(`imp: init({ lang }) needs a language code like 'en' or 'pt-BR'`)
    }
    writeLang(lang)
  }
  applyDirection()
  if (translations !== undefined) {
    await translationSource(translations, 'init({ translations })').load(readLang())
  }
}
