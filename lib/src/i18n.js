import { createState } from './state.js'
import { impLogger } from './logger.js'
import { loadChunk } from './chunk-reload.js'
import { isPlainObject } from './render.js'

const LANG_STATE = 'imp.lang'

const DIR_STATE = 'imp.dir'

const DEFAULT_LANG = 'en'

const DIRECTIONS = ['ltr', 'rtl', 'auto']

const RTL_BASE_LANGUAGES = new Set([
  'ar',
  'arc',
  'ckb',
  'dv',
  'fa',
  'he',
  'ks',
  'ps',
  'sd',
  'ug',
  'ur',
  'yi',
])

const PLACEHOLDER = /\{(\w+)\}/g

let layers = []

const documentElement = () => globalThis.document?.documentElement ?? null

let assignedLang = null

export const readLang = () =>
  documentElement()?.getAttribute('lang')
  || assignedLang
  || globalThis.navigator?.language
  || DEFAULT_LANG

const directionFor = (code) => {
  try {
    const locale = new Intl.Locale(code)
    const textInfo = locale.getTextInfo?.() ?? locale.textInfo
    if (textInfo?.direction) return textInfo.direction
  } catch {
    impLogger.debug(`i18n: '${code}' is not a language tag Intl reads - guessing its direction`)
  }
  return RTL_BASE_LANGUAGES.has(code.split('-')[0].toLowerCase()) ? 'rtl' : 'ltr'
}

let pinnedDir = null

const readDir = () =>
  documentElement()?.getAttribute('dir') || pinnedDir || directionFor(readLang())

let langState = null

let dirState = null

let activeLang = null

let observingDocument = false

const adoptDocumentLanguage = () => {
  applyDirection()
  const code = readLang()
  if (code === activeLang || sources.length === 0) {
    langState?.set(code)
    return
  }
  setLang(code).catch((error) =>
    impLogger.error(`i18n: could not load the translations for '${code}'`, error),
  )
}

const observeDocumentAttributes = () => {
  if (observingDocument) return
  const element = documentElement()
  if (!element) return
  observingDocument = true
  new MutationObserver((records) => {
    if (records.some((record) => record.attributeName === 'lang')) adoptDocumentLanguage()
    dirState?.set(readDir())
  }).observe(element, { attributes: true, attributeFilter: ['lang', 'dir'] })
}

const ensureLangState = () => {
  if (langState) return langState
  langState = createState(LANG_STATE, readLang())
  observeDocumentAttributes()
  return langState
}

const ensureDirState = () => {
  if (dirState) return dirState
  dirState = createState(DIR_STATE, readDir())
  observeDocumentAttributes()
  return dirState
}

export const lang = {
  name: LANG_STATE,
  get: readLang,
  watch: (...args) => ensureLangState().watch(...args),
  text: (select) => ensureLangState().text(select),
  view: (render) => ensureLangState().view(render),
  each: (renderItem, keyOf) => ensureLangState().each(renderItem, keyOf),
}

export const dir = {
  name: DIR_STATE,
  get: readDir,
  watch: (...args) => ensureDirState().watch(...args),
  text: (select) => ensureDirState().text(select),
  view: (render) => ensureDirState().view(render),
  each: (renderItem, keyOf) => ensureDirState().each(renderItem, keyOf),
}

const assertLanguageCode = (code, helper) => {
  if (typeof code !== 'string' || code.trim() === '') {
    throw new Error(`imp: ${helper} needs a language code like 'en' or 'pt-BR'`)
  }
}

export const pinDir = (direction) => {
  if (!DIRECTIONS.includes(direction)) {
    throw new Error(
      `imp: init({ dir }) needs ${DIRECTIONS.map((value) => `'${value}'`).join(
        ', ',
      )} - leave it out to take the direction from the language`,
    )
  }
  pinnedDir = direction
}

export const applyDirection = () => {
  const direction = pinnedDir ?? directionFor(readLang())
  const element = documentElement()
  if (element && element.getAttribute('dir') !== direction) {
    element.setAttribute('dir', direction)
    impLogger.debug(`i18n: text direction set to '${direction}'`)
  }
  dirState?.set(readDir())
}

export const writeLang = (code) => {
  assignedLang = code
  activeLang = code
  documentElement()?.setAttribute('lang', code)
  applyDirection()
  ensureLangState().set(readLang())
  impLogger.debug(`i18n: language set to '${code}'`)
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
    source.pending.delete(code)
    return
  }
  const loaded = await Promise.all(
    keys.map(async (key) => {
      const resolved = await loadChunk(() => source.loaders[key]())
      const messages = resolved?.default ?? resolved
      if (!isPlainObject(messages)) {
        throw new Error(
          `imp: the '${key}' translations loader resolved to ${typeof messages}, not translations - it should be () => import('./locales/${key}.js'), pointing at a module whose default export is your messages`,
        )
      }
      return [key, messages]
    }),
  )
  source.pending.set(code, { keys, loaded })
}

const commitSource = (source, code) => {
  const pending = source.pending.get(code)
  if (!pending || source.disposed) return
  source.pending.delete(code)
  const { keys, loaded } = pending
  const release = registerMessages(Object.fromEntries(loaded))
  source.loaded?.release()
  source.loaded = { keys, release }
  impLogger.debug(`i18n: translations for ${keys.join(' + ')} are live`)
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
        `imp: ${helper} - the '${code}' translations entry must import them, like () => import('./locales/${code}.js')`,
      )
    }
  }
  const source = { loaders, loaded: null, pending: new Map(), disposed: false }
  sources.push(source)
  return {
    load: async (code) => {
      await loadSource(source, code)
      commitSource(source, code)
    },
    dispose: () => {
      source.disposed = true
      source.pending.clear()
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

const defaults = new Map()

const MESSAGE_KEY = /^[A-Za-z0-9_]+(\.[A-Za-z0-9_]+)*$/

export const defaultMessages = (messages) => {
  if (!isPlainObject(messages)) {
    throw new Error(
      `imp: defaultMessages needs an object of message keys to wording, like { 'imp.state.empty': 'Nothing here yet' }`,
    )
  }
  for (const [key, message] of Object.entries(messages)) {
    if (!MESSAGE_KEY.test(key)) {
      throw new Error(`imp: defaultMessages - '${key}' is not a message key like 'imp.state.empty'`)
    }
    if (typeof message !== 'string') {
      throw new Error(
        `imp: defaultMessages - the wording for '${key}' is a ${typeof message}, not a string`,
      )
    }
    defaults.set(key, message)
  }
  reported.clear()
}

const interpolate = (message, params) =>
  message.replace(PLACEHOLDER, (placeholder, name) =>
    Object.hasOwn(params, name) ? String(params[name]) : placeholder,
  )

const reportOnce = (level, code, key, detail) => {
  const seen = `${code}/${key}`
  if (reported.has(seen)) return
  reported.add(seen)
  const shown = defaults.has(key) ? 'showing the built-in wording' : `showing the key '${key}'`
  impLogger[level](`i18n: ${detail} - ${shown}`)
}

const fallBack = (key, params) => {
  const wording = defaults.get(key)
  if (wording === undefined) return key
  return params === undefined ? wording : interpolate(wording, params)
}

export function t(key, params) {
  if (typeof key !== 'string' || key === '') {
    throw new Error(`imp: t needs a message key like 'todo.title'`)
  }
  if (params !== undefined && !isPlainObject(params)) {
    throw new Error(
      `imp: t('${key}') got ${typeof params} params - pass a plain object of placeholder values, like t('${key}', { name: 'Ada' })`,
    )
  }
  const code = readLang()
  const message = resolveMessage(code, key)
  if (message === undefined) {
    reportOnce(
      defaults.has(key) ? 'debug' : 'warn',
      code,
      key,
      `no message '${key}' is registered for '${code}'`,
    )
    return fallBack(key, params)
  }
  if (isPlainObject(message)) {
    reportOnce(
      'warn',
      code,
      key,
      `'${key}' is a group of messages, not a message - name one of ${Object.keys(message)
        .map((name) => `'${key}.${name}'`)
        .join(', ')}`,
    )
    return fallBack(key, params)
  }
  if (typeof message !== 'string') {
    reportOnce('warn', code, key, `message '${key}' is a ${typeof message}, not a string`)
    return fallBack(key, params)
  }
  return params === undefined ? message : interpolate(message, params)
}

export const messageFor = (key) => {
  const message = resolveMessage(readLang(), key)
  return typeof message === 'string' ? message : undefined
}

export const missingMessages = () => {
  const code = readLang()
  return [...defaults.keys()].filter((key) => typeof resolveMessage(code, key) !== 'string').sort()
}
