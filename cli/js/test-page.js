const QUERY_HANDLER_PREFIX = /^(?:aria|pierce|text|xpath)\//

const piercingSelector = (selector) => {
  if (typeof selector !== 'string') return selector
  const trimmed = selector.trimStart()
  if (trimmed.startsWith('>>>') || QUERY_HANDLER_PREFIX.test(trimmed)) return selector
  return `>>> ${trimmed}`
}

const HANDLE_SELECTOR_METHODS = new Set(['$', '$$', '$eval', '$$eval', 'waitForSelector'])

const PAGE_SELECTOR_METHODS = new Set([
  ...HANDLE_SELECTOR_METHODS,
  'click',
  'focus',
  'hover',
  'select',
  'tap',
  'type',
])

const RETURNS_HANDLE = new Set(['$', 'waitForSelector'])
const RETURNS_HANDLE_LIST = new Set(['$$'])

const framePolled = (property, rest) => {
  if (property !== 'waitForSelector') return rest
  const [options, ...others] = rest
  return [{ polling: 'raf', ...options }, ...others]
}

const savedScreenshot = (screenshot, save) => async (options = {}) => {
  if (!options.path) return screenshot(options)
  const { path, ...rest } = options
  const data = await screenshot({ ...rest, encoding: 'base64' })
  await save(path, data)
  return Uint8Array.from(atob(data), (char) => char.charCodeAt(0))
}

function piercingProxy(target, selectorMethods, save) {
  return new Proxy(target, {
    get(object, property) {
      const value = Reflect.get(object, property, object)
      if (typeof value !== 'function') return value
      if (property === 'screenshot') return savedScreenshot(value.bind(object), save)
      if (!selectorMethods.has(property)) return value.bind(object)
      return async (selector, ...rest) => {
        const result = await value.call(
          object,
          piercingSelector(selector),
          ...framePolled(property, rest),
        )
        if (RETURNS_HANDLE.has(property)) return result && piercingProxy(result, HANDLE_SELECTOR_METHODS, save)
        if (RETURNS_HANDLE_LIST.has(property)) {
          return result.map((handle) => handle && piercingProxy(handle, HANDLE_SELECTOR_METHODS, save))
        }
        return result
      }
    },
  })
}

export const piercingPage = (page, { save }) => piercingProxy(page, PAGE_SELECTOR_METHODS, save)

export const piercingBrowser = (browser, { save }) =>
  new Proxy(browser, {
    get(object, property) {
      const value = Reflect.get(object, property, object)
      if (typeof value !== 'function') return value
      if (property !== 'newPage') return value.bind(object)
      return async (...args) => piercingPage(await value.call(object, ...args), { save })
    },
  })
