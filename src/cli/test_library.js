const REGISTRY_KEY = Symbol.for('imp.test.registry')

const registry = globalThis[REGISTRY_KEY] ??= {
  tests: [],
  focused: false,
  beforeAll: [],
  beforeEach: [],
  afterEach: [],
  afterAll: [],
}

function register(mode, name, run, options) {
  if (typeof name !== 'string' || !name) {
    throw new TypeError('test(name, fn) — name must be a non-empty string')
  }
  if (typeof run !== 'function') {
    throw new TypeError(`test('${name}', fn) — fn must be a function`)
  }
  if (mode === 'only') registry.focused = true
  registry.tests.push({ name, run, mode, timeout: options?.timeout })
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

const typeTag = (value) => Object.prototype.toString.call(value).slice(8, -1)

const isDomNode = (value) =>
  typeof value?.nodeType === 'number' && typeof value?.nodeName === 'string'

const clip = (text) => text.length > 200 ? `${text.slice(0, 200)}…` : text

export function stringify(value) {
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
  if (Object.is(a, b)) return true
  if (typeof a !== 'object' || typeof b !== 'object' || a === null || b === null) return false
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
    toBe(expected) {
      check(Object.is(received, expected), 'toBe', {
        expected: stringify(expected),
        argument: stringify(expected),
      })
    },
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
    toBeFalsy() {
      check(!received, 'toBeFalsy')
    },
    toBeNull() {
      check(received === null, 'toBeNull')
    },
    toBeUndefined() {
      check(received === undefined, 'toBeUndefined')
    },
    toBeDefined() {
      check(received !== undefined, 'toBeDefined')
    },
    toBeNaN() {
      check(Number.isNaN(received), 'toBeNaN')
    },
    toBeInstanceOf(expected) {
      check(received instanceof expected, 'toBeInstanceOf', {
        expected: expected?.name ?? stringify(expected),
        argument: expected?.name,
      })
    },
    toBeGreaterThan(expected) {
      check(received > expected, 'toBeGreaterThan', {
        expected: stringify(expected),
        argument: stringify(expected),
      })
    },
    toBeGreaterThanOrEqual(expected) {
      check(received >= expected, 'toBeGreaterThanOrEqual', {
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
    toBeLessThanOrEqual(expected) {
      check(received <= expected, 'toBeLessThanOrEqual', {
        expected: stringify(expected),
        argument: stringify(expected),
      })
    },
    toBeCloseTo(expected, digits = 2) {
      const pass = Math.abs(received - expected) < 10 ** -digits / 2
      check(pass, 'toBeCloseTo', {
        expected: stringify(expected),
        argument: stringify(expected),
      })
    },
    toHaveLength(expected) {
      check(received?.length === expected, 'toHaveLength', {
        expected: String(expected),
        expectedLabel: 'expected length',
        argument: String(expected),
      })
    },
    toHaveProperty(key, ...rest) {
      const expected = rest[0]
      const path = String(key).split('.')
      let value = received
      let present = true
      for (const segment of path) {
        if (value === null || value === undefined || !(segment in Object(value))) {
          present = false
          break
        }
        value = value[segment]
      }
      const pass = present && (!rest.length || deepEqual(value, expected))
      check(pass, 'toHaveProperty', {
        expected: rest.length ? `'${key}' = ${stringify(expected)}` : `property '${key}'`,
        argument: stringify(key),
      })
    },
    toThrow(expected) {
      if (typeof received !== 'function') {
        fail(['expect(fn).toThrow() — the received value must be a function'])
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
