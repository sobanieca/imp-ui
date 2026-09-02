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

const wrapHandle = (handle) => handle && piercingProxy(handle, HANDLE_SELECTOR_METHODS)

function piercingProxy(target, selectorMethods) {
  return new Proxy(target, {
    get(object, property) {
      const value = Reflect.get(object, property, object)
      if (typeof value !== 'function') return value
      if (!selectorMethods.has(property)) return value.bind(object)
      return async (selector, ...rest) => {
        const result = await value.call(
          object,
          piercingSelector(selector),
          ...framePolled(property, rest),
        )
        if (RETURNS_HANDLE.has(property)) return wrapHandle(result)
        if (RETURNS_HANDLE_LIST.has(property)) return result.map(wrapHandle)
        return result
      }
    },
  })
}

export const piercingPage = (page) => piercingProxy(page, PAGE_SELECTOR_METHODS)

export const piercingBrowser = (browser) =>
  new Proxy(browser, {
    get(object, property) {
      const value = Reflect.get(object, property, object)
      if (typeof value !== 'function') return value
      if (property !== 'newPage') return value.bind(object)
      return async (...args) => piercingPage(await value.call(object, ...args))
    },
  })
