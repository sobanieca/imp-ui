const REGISTRY_KEY = Symbol.for('imp.test.registry')

const registry = globalThis[REGISTRY_KEY] ??= {
  tests: [],
  focused: false,
  beforeAll: [],
  beforeEach: [],
  afterEach: [],
  afterAll: [],
  spies: [],
  restores: [],
  running: false,
}

function register(mode, name, run, options) {
  if (typeof name !== 'string' || !name) {
    throw new TypeError('test(name, fn) - name must be a non-empty string')
  }
  if (typeof run !== 'function') {
    throw new TypeError(`test('${name}', fn) - fn must be a function`)
  }
  if (mode === 'only') registry.focused = true
  registry.tests.push({
    name,
    run,
    mode,
    timeout: options?.timeout,
    fakeTimers: options?.fakeTimers,
  })
}

export function test(name, run, options) {
  register('normal', name, run, options)
}
test.only = (name, run, options) => register('only', name, run, options)
test.skip = (name, run, options) => register('skip', name, run, options)

export const beforeAll = (hook) => registry.beforeAll.push(hook)
export const beforeEach = (hook) => registry.beforeEach.push(hook)
export const afterEach = (hook) => registry.afterEach.push(hook)
export const afterAll = (hook) => registry.afterAll.push(hook)

function makeSpy(implementation) {
  const spy = function (...args) {
    spy.calls.push(args)
    return typeof implementation === 'function' ? implementation.apply(this, args) : undefined
  }
  spy.calls = []
  registry.spies.push(spy)
  return spy
}

export function spy(target, method, implementation) {
  const patchesMethod = (typeof target === 'object' || typeof target === 'function') &&
    target !== null && typeof method === 'string'
  if (!patchesMethod) return makeSpy(target)
  const original = target[method]
  if (typeof original !== 'function') {
    throw new TypeError(`spy(object, '${method}') - '${method}' is not a method on the object`)
  }
  const wrapped = makeSpy(implementation ?? ((...args) => original.apply(target, args)))
  target[method] = wrapped
  if (registry.running) registry.restores.push(() => target[method] = original)
  return wrapped
}

export const mockModule = () => {}

const typeTag = (value) => Object.prototype.toString.call(value).slice(8, -1)

const isDomNode = (value) =>
  typeof value?.nodeType === 'number' && typeof value?.nodeName === 'string'

const ASYMMETRIC = Symbol.for('imp.test.asymmetric')
const asymmetric = (label, match) => ({ [ASYMMETRIC]: true, label, match })
const isAsymmetric = (value) =>
  value !== null && typeof value === 'object' && value[ASYMMETRIC] === true

const matchesConstructor = (constructor, actual) => {
  switch (constructor) {
    case String:
      return typeof actual === 'string' || actual instanceof String
    case Number:
      return typeof actual === 'number' || actual instanceof Number
    case Boolean:
      return typeof actual === 'boolean'
    case BigInt:
      return typeof actual === 'bigint'
    case Symbol:
      return typeof actual === 'symbol'
    case Function:
      return typeof actual === 'function'
    case Object:
      return actual !== null && typeof actual === 'object'
    default:
      return actual != null && actual instanceof constructor
  }
}

const clip = (text) => text.length > 200 ? `${text.slice(0, 200)}…` : text

export function stringify(value) {
  if (isAsymmetric(value)) return value.label
  if (typeof value === 'string') return JSON.stringify(value)
  if (typeof value === 'function') return `[function ${value.name || '(anonymous)'}]`
  if (typeof value === 'bigint') return `${value}n`
  if (isDomNode(value)) return clip(value.outerHTML ?? `#${value.nodeName.toLowerCase()}`)
  const tag = typeTag(value)
  if (tag === 'Error') return `${value.name}: ${value.message}`
  if (tag === 'RegExp' || tag === 'Date') return String(value)
  if (tag === 'Map') return `Map(${stringify([...value.entries()])})`
  if (tag === 'Set') return `Set(${stringify([...value.values()])})`
  try {
    const json = JSON.stringify(
      value,
      (_key, entry) => typeof entry === 'bigint' ? `${entry}n` : entry,
    )
    if (json !== undefined) return clip(json)
  } catch {
    // fall through for cyclic values
  }
  return clip(String(value))
}

export function deepEqual(a, b) {
  if (isAsymmetric(b)) return b.match(a)
  if (isAsymmetric(a)) return a.match(b)
  if (Object.is(a, b)) return true
  if (typeof a !== 'object' || typeof b !== 'object' || a === null || b === null) return false
  if (isDomNode(a) || isDomNode(b)) return false
  const tag = typeTag(a)
  if (tag !== typeTag(b)) return false
  if (tag === 'Date') return a.getTime() === b.getTime()
  if (tag === 'RegExp') return String(a) === String(b)
  if (Array.isArray(a)) {
    return Array.isArray(b) && a.length === b.length &&
      a.every((entry, index) => deepEqual(entry, b[index]))
  }
  if (tag === 'Set') {
    return a.size === b.size &&
      [...a].every((entry) => [...b].some((other) => deepEqual(entry, other)))
  }
  if (tag === 'Map') {
    return a.size === b.size &&
      [...a].every(([key, entry]) => b.has(key) && deepEqual(entry, b.get(key)))
  }
  if (tag !== 'Object') return false
  const keys = Object.keys(a)
  return keys.length === Object.keys(b).length &&
    keys.every((key) => Object.hasOwn(b, key) && deepEqual(a[key], b[key]))
}

class ExpectationError extends Error {
  name = 'ExpectationError'
}

const fail = (lines) => {
  throw new ExpectationError(lines.join('\n'))
}

const describeCall = (negated, matcher, argument) =>
  `expect(received)${negated ? '.not' : ''}.${matcher}(${argument !== undefined ? argument : ''})`

function buildMatchers(received, negated) {
  const check = (pass, matcher, { expected, expectedLabel = 'expected', argument } = {}) => {
    if (pass !== negated) return
    const lines = [describeCall(negated, matcher, argument)]
    if (expected !== undefined || expectedLabel !== 'expected') {
      lines.push(`  ${expectedLabel}: ${expected}`)
    }
    lines.push(`  received: ${stringify(received)}`)
    fail(lines)
  }

  const matchers = {
    toEqual(expected) {
      check(deepEqual(received, expected), 'toEqual', {
        expected: stringify(expected),
        argument: stringify(expected),
      })
    },
    toContain(expected) {
      const pass = typeof received === 'string'
        ? received.includes(expected)
        : Array.from(received ?? []).some((entry) =>
          Object.is(entry, expected) || deepEqual(entry, expected)
        )
      check(pass, 'toContain', {
        expected: stringify(expected),
        expectedLabel: 'looking for',
        argument: stringify(expected),
      })
    },
    toMatch(expected) {
      const pattern = expected instanceof RegExp ? expected : null
      const pass = typeof received === 'string' &&
        (pattern ? pattern.test(received) : received.includes(String(expected)))
      check(pass, 'toMatch', {
        expected: stringify(expected),
        expectedLabel: 'pattern',
        argument: stringify(expected),
      })
    },
    toBeTruthy() {
      check(!!received, 'toBeTruthy')
    },
    toBeGreaterThan(expected) {
      check(received > expected, 'toBeGreaterThan', {
        expected: stringify(expected),
        argument: stringify(expected),
      })
    },
    toBeLessThan(expected) {
      check(received < expected, 'toBeLessThan', {
        expected: stringify(expected),
        argument: stringify(expected),
      })
    },
    toThrow(expected) {
      if (typeof received !== 'function') {
        fail(['expect(fn).toThrow() - the received value must be a function'])
      }
      const matches = (error) => {
        if (expected === undefined) return true
        const message = error instanceof Error ? error.message : String(error)
        return expected instanceof RegExp
          ? expected.test(message)
          : message.includes(String(expected))
      }
      const settle = (thrown, error) => {
        const pass = thrown && matches(error)
        if (pass === negated) {
          const lines = [
            describeCall(
              negated,
              'toThrow',
              expected === undefined ? undefined : stringify(expected),
            ),
          ]
          if (expected !== undefined) lines.push(`  expected error: ${stringify(expected)}`)
          lines.push(thrown ? `  thrown: ${stringify(error)}` : '  nothing was thrown')
          fail(lines)
        }
      }
      let result
      try {
        result = received()
      } catch (error) {
        settle(true, error)
        return
      }
      if (result && typeof result.then === 'function') {
        return result.then(() => settle(false), (error) => settle(true, error))
      }
      settle(false)
    },
  }

  if (!negated) {
    Object.defineProperty(matchers, 'not', {
      get: () => buildMatchers(received, true),
    })
  }
  return matchers
}

export function expect(received) {
  return buildMatchers(received, false)
}

expect.anything = () =>
  asymmetric('anything()', (actual) => actual !== null && actual !== undefined)
expect.any = (constructor) =>
  asymmetric(
    `any(${constructor?.name ?? String(constructor)})`,
    (actual) => matchesConstructor(constructor, actual),
  )
expect.stringContaining = (text) =>
  asymmetric(
    `stringContaining(${stringify(text)})`,
    (actual) => typeof actual === 'string' && actual.includes(text),
  )
expect.stringMatching = (pattern) =>
  asymmetric(`stringMatching(${stringify(pattern)})`, (actual) =>
    typeof actual === 'string' &&
    (pattern instanceof RegExp ? pattern.test(actual) : actual.includes(String(pattern))))
expect.arrayContaining = (items) =>
  asymmetric(
    `arrayContaining(${stringify(items)})`,
    (actual) =>
      Array.isArray(actual) &&
      items.every((item) => actual.some((entry) => deepEqual(entry, item))),
  )
expect.objectContaining = (shape) =>
  asymmetric(
    `objectContaining(${stringify(shape)})`,
    (actual) =>
      actual !== null && typeof actual === 'object' &&
      Object.keys(shape).every((key) => key in actual && deepEqual(actual[key], shape[key])),
  )
expect.closeTo = (value, digits = 2) =>
  asymmetric(
    `closeTo(${value})`,
    (actual) => typeof actual === 'number' && Math.abs(actual - value) < 10 ** -digits / 2,
  )
