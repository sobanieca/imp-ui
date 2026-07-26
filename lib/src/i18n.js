import { createState } from './state.js'
import { createLogger } from './logger.js'
import { isPlainObject } from './render.js'

const log = createLogger('imp')

const LANG_STATE = 'imp.lang'

const DEFAULT_LANG = 'en'

const PLACEHOLDER = /\{(\w+)\}/g

let layers = []

const documentElement = () => globalThis.document?.documentElement ?? null

let assignedLang = null

export const readLang = () =>
  documentElement()?.getAttribute('lang') || assignedLang || globalThis.navigator?.language ||
  DEFAULT_LANG

let langState = null

let activeLang = null

const adoptDocumentLanguage = () => {
  const code = readLang()
  if (code === activeLang || sources.length === 0) {
    langState.set(code)
    return
  }
  setLang(code).catch((error) =>
    log.error(`i18n: could not load the translations for '${code}'`, error)
  )
}

const ensureLangState = () => {
  if (langState) return langState
  langState = createState(LANG_STATE, readLang())
  const element = documentElement()
  if (element && typeof MutationObserver === 'function') {
    new MutationObserver(adoptDocumentLanguage)
      .observe(element, { attributes: true, attributeFilter: ['lang'] })
  }
  return langState
}

export const lang = {
  name: LANG_STATE,
  get: readLang,
  watch: (subscriber) => ensureLangState().watch(subscriber),
  text: (select) => ensureLangState().text(select),
  view: (render) => ensureLangState().view(render),
  each: (renderItem, keyOf) => ensureLangState().each(renderItem, keyOf),
}

const assertLanguageCode = (code, helper) => {
  if (typeof code !== 'string' || code.trim() === '') {
    throw new Error(`imp: ${helper} needs a language code like 'en' or 'pt-BR'`)
  }
}

export const writeLang = (code) => {
  assignedLang = code
  activeLang = code
  documentElement()?.setAttribute('lang', code)
  ensureLangState().set(readLang())
  log.debug(`i18n: language set to '${code}'`)
}

const registerMessages = (messagesByLang) => {
  const added = Object.entries(messagesByLang).map(([code, messages]) => ({ code, messages }))
  layers.push(...added)
  reported.clear()
  let released = false
  return () => {
    if (released) return
    released = true
    layers = layers.filter((layer) => !added.includes(layer))
    reported.clear()
  }
}

const sources = []

let switchGeneration = 0

const loaderKeysFor = (loaders, code) => {
  const codes = Object.keys(loaders)
  const base = code.split('-')[0]
  const wanted = []
  if (base !== code && codes.includes(base)) wanted.push(base)
  if (codes.includes(code)) wanted.push(code)
  if (wanted.length > 0) return wanted
  if (codes.includes(base)) return [base]
  return codes.length > 0 ? [codes[0]] : []
}

const sameKeys = (a, b) => a?.length === b.length && b.every((key, index) => a[index] === key)

const loadSource = async (source, code) => {
  const keys = loaderKeysFor(source.loaders, code)
  if (keys.length === 0 || sameKeys(source.loaded?.keys, keys)) {
    source.pending = null
    return
  }
  const loaded = await Promise.all(keys.map(async (key) => {
    const resolved = await source.loaders[key]()
    const messages = resolved?.default ?? resolved
    if (!isPlainObject(messages)) {
      throw new Error(
        `imp: the '${key}' translations loader resolved to ${typeof messages}, not translations — it should be () => import('./locales/${key}.js'), pointing at a module whose default export is your messages`,
      )
    }
    return [key, messages]
  }))
  source.pending = { keys, loaded, requested: code }
}

const commitSource = (source, code) => {
  if (!source.pending || source.pending.requested !== code) return
  const { keys, loaded } = source.pending
  source.pending = null
  const release = registerMessages(Object.fromEntries(loaded))
  source.loaded?.release()
  source.loaded = { keys, release }
  log.debug(`i18n: translations for ${keys.join(' + ')} are live`)
}

export const translationSource = (loaders, helper) => {
  if (!isPlainObject(loaders) || Object.keys(loaders).length === 0) {
    throw new Error(
      `imp: ${helper} needs translations as an object of loaders keyed by language code, like { en: () => import('./locales/en.js'), pl: () => import('./locales/pl.js') }`,
    )
  }
  for (const [code, loader] of Object.entries(loaders)) {
    if (typeof loader !== 'function') {
      throw new Error(
        `imp: ${helper} — the '${code}' translations entry must import them, like () => import('./locales/${code}.js')`,
      )
    }
  }
  const source = { loaders, loaded: null, pending: null }
  sources.push(source)
  return {
    load: async (code) => {
      await loadSource(source, code)
      commitSource(source, code)
    },
    dispose: () => {
      source.pending = null
      source.loaded?.release()
      source.loaded = null
      const index = sources.indexOf(source)
      if (index >= 0) sources.splice(index, 1)
    },
  }
}

export async function setLang(code) {
  assertLanguageCode(code, 'setLang')
  const generation = ++switchGeneration
  await Promise.all(sources.map((source) => loadSource(source, code)))
  if (generation !== switchGeneration) return code
  for (const source of sources) commitSource(source, code)
  writeLang(code)
  return code
}

const languageChain = (code) => {
  const chain = [code]
  const base = code.split('-')[0]
  if (base !== code) chain.push(base)
  const firstRegistered = layers[0]?.code
  if (firstRegistered !== undefined && !chain.includes(firstRegistered)) chain.push(firstRegistered)
  return chain
}

const lookup = (messages, key) => {
  let found = messages
  for (const segment of key.split('.')) {
    if (!isPlainObject(found)) return undefined
    found = found[segment]
  }
  return found
}

const resolveMessage = (code, key) => {
  for (const candidate of languageChain(code)) {
    for (let index = layers.length - 1; index >= 0; index--) {
      const layer = layers[index]
      if (layer.code !== candidate) continue
      const message = lookup(layer.messages, key)
      if (message !== undefined) return message
    }
  }
  return undefined
}

const reported = new Set()

const fallBackToKey = (code, key, detail) => {
  const seen = `${code}/${key}`
  if (!reported.has(seen)) {
    reported.add(seen)
    log.warn(`i18n: ${detail} — showing the key '${key}'`)
  }
  return key
}

const interpolate = (message, params) =>
  message.replace(
    PLACEHOLDER,
    (placeholder, name) => Object.hasOwn(params, name) ? String(params[name]) : placeholder,
  )

export function t(key, params) {
  if (typeof key !== 'string' || key === '') {
    throw new Error(`imp: t needs a message key like 'todo.title'`)
  }
  if (params !== undefined && !isPlainObject(params)) {
    throw new Error(
      `imp: t('${key}') got ${typeof params} params — pass a plain object of placeholder values, like t('${key}', { name: 'Ada' })`,
    )
  }
  const code = readLang()
  const message = resolveMessage(code, key)
  if (message === undefined) {
    return fallBackToKey(code, key, `no message '${key}' is registered for '${code}'`)
  }
  if (isPlainObject(message)) {
    return fallBackToKey(
      code,
      key,
      `'${key}' is a group of messages, not a message — name one of ${
        Object.keys(message).map((name) => `'${key}.${name}'`).join(', ')
      }`,
    )
  }
  if (typeof message !== 'string') {
    return fallBackToKey(code, key, `message '${key}' is a ${typeof message}, not a string`)
  }
  return params === undefined ? message : interpolate(message, params)
}
