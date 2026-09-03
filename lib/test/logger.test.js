import { component, mount } from 'imp'
import { div } from 'imp/html'
import { computed, initState } from 'imp/state'
import { createLogger, logger, logLevel, setLogLevel } from 'imp/log'
import { afterEach, beforeEach, expect, spy, test } from 'imp/test'

const probe = component('logger-probe', { setup: (self, run) => run(self) })

const hostedState = (name, initialValue) => {
  let state
  mount(document.body, probe((self) => void (state = initState(self, name, initialValue))))
  return state
}

beforeEach(() => {
  document.body.replaceChildren()
})

afterEach(() => {
  setLogLevel('info')
})

const messagesOf = (recorded) => recorded.calls.map(([first]) => String(first))

test('the default log level is info', () => {
  expect(logLevel()).toEqual('info')
})

test('debug is suppressed at the info level and shown at the debug level', () => {
  const log = spy(console, 'log', () => {})
  logger.debug('hidden')
  expect(log.calls.length).toEqual(0)
  setLogLevel('debug')
  logger.debug('shown')
  expect(log.calls.length).toEqual(1)
  expect(log.calls[0]).toEqual(['shown'])
})

test('info and debug write through console.log, warn and error keep their methods', () => {
  const log = spy(console, 'log', () => {})
  const warn = spy(console, 'warn', () => {})
  const error = spy(console, 'error', () => {})
  logger.info('information')
  logger.warn('warning')
  logger.error('failure')
  expect(log.calls).toEqual([['information']])
  expect(warn.calls).toEqual([['warning']])
  expect(error.calls).toEqual([['failure']])
})

test('a named logger prefixes its messages', () => {
  const log = spy(console, 'log', () => {})
  const myapp = createLogger('myapp')
  myapp.info('hello', 42)
  expect(log.calls[0]).toEqual(['myapp: hello', 42])
})

test('a named logger keeps a non-string first argument intact', () => {
  const log = spy(console, 'log', () => {})
  createLogger('myapp').info({ user: 'Ada' })
  expect(log.calls[0]).toEqual(['myapp:', { user: 'Ada' }])
})

test('levels below the active one are suppressed', () => {
  const warn = spy(console, 'warn', () => {})
  const error = spy(console, 'error', () => {})
  setLogLevel('error')
  logger.warn('quiet')
  logger.error('loud')
  expect(warn.calls.length).toEqual(0)
  expect(error.calls.length).toEqual(1)
})

test('setLogLevel rejects unknown levels', () => {
  expect(() => setLogLevel('silent')).toThrow('unknown')
  expect(() => setLogLevel('loud')).toThrow('unknown')
  expect(() => createLogger(42)).toThrow('string name')
})

test('state lifecycle, sets, and reads emit debug logs', () => {
  const log = spy(console, 'log', () => {})
  setLogLevel('debug')
  const count = hostedState('lg1.count', 1)
  count.get()
  count.set(2)
  count.set(2)
  const messages = messagesOf(log)
  expect(messages.some((m) => m.includes("state 'lg1.count' initialized"))).toBeTruthy()
  expect(messages.some((m) => m.includes("state 'lg1.count' read"))).toBeTruthy()
  expect(messages.some((m) => m.includes("state 'lg1.count' set"))).toBeTruthy()
  expect(
    messages.some((m) => m.includes("state 'lg1.count' set skipped - the value is unchanged")),
  ).toBeTruthy()
})

test('structurally equal sets log as skipped', () => {
  const log = spy(console, 'log', () => {})
  setLogLevel('debug')
  const user = hostedState('lg2.user', { name: 'Ada' })
  user.set({ name: 'Ada' })
  expect(
    messagesOf(log).some((m) =>
      m.includes("state 'lg2.user' set skipped - the new value is structurally equal")
    ),
  ).toBeTruthy()
})

test('subscriptions log attach, notify, and detach at the debug level', () => {
  const log = spy(console, 'log', () => {})
  setLogLevel('debug')
  const count = hostedState('lg3.count', 0)
  let off
  mount(
    document.body,
    probe(() => {
      off = count.watch(() => {})
    }),
  )
  count.set(1)
  off()
  const messages = messagesOf(log)
  expect(messages.some((m) => m.includes("state 'lg3.count': watch attached"))).toBeTruthy()
  expect(messages.some((m) => m.includes("state 'lg3.count': notifying 1 subscriber(s)")))
    .toBeTruthy()
  expect(messages.some((m) => m.includes("state 'lg3.count': watch detached"))).toBeTruthy()
})

test('computed states log recomputes', () => {
  const log = spy(console, 'log', () => {})
  setLogLevel('debug')
  const price = hostedState('lg4.price', 10)
  const total = computed([price], (value) => value * 2)
  mount(document.body, probe(() => div(total.text())))
  price.set(20)
  expect(
    messagesOf(log).some((m) => m.includes("state 'computed(lg4.price)' recomputed")),
  ).toBeTruthy()
})

test('component mounts log at the debug level', () => {
  const log = spy(console, 'log', () => {})
  setLogLevel('debug')
  mount(document.body, probe(() => div('hi')))
  expect(messagesOf(log).some((m) => m.includes("component 'logger-probe' mounted"))).toBeTruthy()
})
