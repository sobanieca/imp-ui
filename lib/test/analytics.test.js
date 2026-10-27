import { appMap, component, mount } from 'imp'
import { button, div, input, span } from 'imp/html'
import { navigate, router } from 'imp/router'
import { initState } from 'imp/state'
import { createHttpClient, initHttpClient } from 'imp/http'
import { batch, onAnalytics, track, zone } from 'imp/analytics'
import { afterEach, beforeEach, expect, spy, test } from 'imp/test'
import { settled } from './shadow.js'

const nativeObserver = globalThis.IntersectionObserver
const observers = new Set()

class StubObserver {
  constructor(callback) {
    this.callback = callback
    this.targets = new Set()
    observers.add(this)
  }

  observe(target) {
    this.targets.add(target)
  }

  unobserve(target) {
    this.targets.delete(target)
  }

  disconnect() {
    this.targets.clear()
  }
}

const showInViewport = (node) => {
  for (const observer of observers) {
    const entries = [...observer.targets]
      .filter((target) => target === node || node.contains(target) || target.contains(node))
      .map((target) => ({ target, isIntersecting: true }))
    if (entries.length) observer.callback(entries)
  }
}

let visibility = 'visible'

const setVisibility = (state) => {
  visibility = state
  document.dispatchEvent(new Event('visibilitychange'))
}

const useTypes = new Set(['click', 'input', 'keydown'])
const trustedListeners = new WeakMap()

const asTrustedByTest = (event) =>
  new Proxy(event, {
    get: (target, property) => {
      if (property === 'isTrusted') return target.isTrusted || trustedEvents.has(target)
      const value = Reflect.get(target, property, target)
      return typeof value === 'function' ? value.bind(target) : value
    },
  })

const trustedListener = (listener) => {
  if (typeof listener !== 'function') return listener
  if (!trustedListeners.has(listener)) {
    trustedListeners.set(listener, function (event) {
      return listener.call(this, asTrustedByTest(event))
    })
  }
  return trustedListeners.get(listener)
}

const seeTestTrustedEvents = () => {
  const { addEventListener, removeEventListener } = EventTarget.prototype
  document.addEventListener = function (type, listener, options) {
    const wrapped = useTypes.has(type) ? trustedListener(listener) : listener
    return addEventListener.call(this, type, wrapped, options)
  }
  document.removeEventListener = function (type, listener, options) {
    const wrapped = useTypes.has(type) ? trustedListener(listener) : listener
    return removeEventListener.call(this, type, wrapped, options)
  }
}

const stops = []

const collect = () => {
  const records = []
  stops.push(onAnalytics((record) => void records.push(record)))
  return records
}

const microtasks = async () => {
  for (let index = 0; index < 5; index++) await null
}

beforeEach(async () => {
  document.body.replaceChildren()
  await microtasks()
  globalThis.__IMP_ENV__ = {}
  globalThis.IntersectionObserver = StubObserver
  seeTestTrustedEvents()
  observers.clear()
  visibility = 'visible'
  Object.defineProperty(document, 'visibilityState', {
    configurable: true,
    get: () => visibility,
  })
})

afterEach(async () => {
  for (const stop of stops.splice(0)) stop()
  document.body.replaceChildren()
  await microtasks()
  globalThis.IntersectionObserver = nativeObserver
  delete document.addEventListener
  delete document.removeEventListener
  delete document.visibilityState
})

const app = appMap({
  invoices: { $id: {} },
  reports: {},
})

const guarded = appMap({
  reports: {},
  secret: {},
})

const slowScreen = component('analytics-slow-screen', {
  setup: () => new Promise((resolve) => setTimeout(() => resolve(div('slow')), 30)),
})

const screens = {
  [app]: () => div('home'),
  [app.invoices]: () => div('invoices'),
  [app.invoices.$id]: ({ params }) => div(`invoice ${params.id}`),
  [app.reports]: () => slowScreen(),
}

const mountApp = (extra = {}) =>
  mount(
    document.body,
    div(router({ map: app, screens, notFound: () => div('not found'), ...extra })),
  )

const deepQuery = (root, selector) => {
  const found = root.querySelector(selector)
  if (found) return found
  for (const node of root.querySelectorAll('*')) {
    const inner = node.shadowRoot && deepQuery(node.shadowRoot, selector)
    if (inner) return inner
  }
  return null
}

const screenRoot = () => deepQuery(document.body, 'imp-route').shadowRoot.firstChild.shadowRoot

const ofType = (records, type) => records.filter((record) => record.type === type)

const described = (records) =>
  records.map((record) =>
    [record.type, record.page, 'zone' in record ? String(record.zone) : (record.name ?? '')].join(
      ' ',
    ),
  )

const trustedEvents = new WeakSet()

const trusted = (event) => {
  trustedEvents.add(event)
  return event
}

const click = (node) =>
  node.dispatchEvent(trusted(new MouseEvent('click', { bubbles: true, composed: true })))

const pressKey = (node, key) =>
  node.dispatchEvent(trusted(new KeyboardEvent('keydown', { key, bubbles: true, composed: true })))

const windowEvents = () => {
  const added = spy(globalThis, 'addEventListener')
  return (type, event) => {
    for (const [name, listener] of added.calls) {
      if (name === type) listener(event)
    }
  }
}

test('the router records one page per screen, keyed by the route pattern', async () => {
  const records = collect()
  navigate('/invoices')
  mountApp()
  await settled()
  navigate('/invoices/7')
  await settled()
  navigate('/invoices/7?tab=history')
  await settled()
  navigate('/nowhere/at/all')
  await settled()

  const pages = ofType(records, 'page')
  expect(pages.map((page) => page.page)).toEqual(['/invoices', '/invoices/:id'])
  expect(pages.every((page) => typeof page.at === 'number')).toEqual(true)
  expect(Object.keys(pages[1])).toEqual(['type', 'visit', 'at', 'page'])
  expect(new Set(records.map((record) => record.visit)).size).toEqual(1)
  expect(JSON.parse(JSON.stringify(records))).toEqual(records)
})

test('a path off the map sends no record of any type', async () => {
  const fire = windowEvents()
  const records = collect()
  track('myapp.before-mount')
  fire('error', { message: 'before mount', error: new Error('before mount') })
  navigate('/nowhere/at/all')
  mountApp()
  await settled()
  click(document.body)
  track('myapp.off-the-map')
  fire('unhandledrejection', { reason: new Error('rejected') })
  expect(records).toEqual([])
  navigate('/invoices')
  await settled()
  track('myapp.on-the-map')
  expect(described(records)).toEqual(['page /invoices ', 'outcome /invoices myapp.on-the-map'])
})

test(
  'a page is ready when the screen replaces its loading content',
  async ({ clock }) => {
    const records = collect()
    navigate('/')
    mountApp()
    await clock.tick(1)
    navigate('/reports')
    const navigatedAt = Date.now()
    await clock.tick(10)
    expect(ofType(records, 'page').map((page) => page.page)).toEqual(['/'])
    await clock.tick(30)
    const reports = ofType(records, 'page').find((page) => page.page === '/reports')
    expect(reports.at - navigatedAt >= 30).toEqual(true)
  },
  { fakeTimers: true },
)

test('a page that the person leaves before it is ready sends no record', async () => {
  const records = collect()
  navigate('/')
  mountApp()
  await settled()
  navigate('/reports')
  await settled()
  navigate('/')
  await settled()
  expect(ofType(records, 'page').map((page) => page.page)).toEqual(['/', '/'])
})

let role = null

const withRole = component('analytics-role', {
  setup: (self, options) => {
    role = initState(self, 'analytics.role', 'user')
    return router(options)
  },
})

test('a guard redirect gives one page, for the node where the navigation ends', async () => {
  const records = collect()
  navigate('/secret')
  mount(
    document.body,
    withRole({
      map: guarded,
      screens: { [guarded.reports]: () => div('reports'), [guarded.secret]: () => div('secret') },
      guards: {
        [guarded.secret]: {
          states: ['analytics.role'],
          check: (role) => (role === 'admin' ? true : '/reports'),
        },
      },
    }),
  )
  await new Promise((resolve) => setTimeout(resolve, 60))
  expect(ofType(records, 'page').map((page) => page.page)).toEqual(['/reports'])
})

test('a guard that allows before its redirect runs gives the page it was redirecting from', async () => {
  const records = collect()
  navigate('/reports')
  mount(
    document.body,
    withRole({
      map: guarded,
      screens: { [guarded.reports]: () => div('reports'), [guarded.secret]: () => div('secret') },
      guards: {
        [guarded.secret]: {
          states: ['analytics.role'],
          check: (current) => (current === 'admin' ? true : '/reports'),
        },
      },
    }),
  )
  await new Promise((resolve) => setTimeout(resolve, 60))
  navigate('/secret')
  role.set('admin')
  await new Promise((resolve) => setTimeout(resolve, 60))
  expect(globalThis.location.pathname).toEqual('/secret')
  expect(ofType(records, 'page').map((page) => page.page)).toEqual(['/reports', '/secret'])
})

const zoned = (name) =>
  component(`analytics-zoned-${name.replaceAll('.', '-')}`, {
    setup: () =>
      div(
        zone({ name }, div({ id: 'inside' }, input({ id: 'field' }), button({ id: 'act' }, 'act'))),
        span({ id: 'outside' }, 'outside'),
      ),
  })

const zonedScreen = zoned('myapp.due-date')

test('a zone is seen once, when it enters the viewport while the document is visible', async () => {
  const records = collect()
  navigate('/')
  mountApp({ screens: { ...screens, [app]: () => zonedScreen() } })
  await settled()
  const inside = screenRoot().querySelector('#inside')
  setVisibility('hidden')
  showInViewport(inside)
  expect(ofType(records, 'seen')).toEqual([])
  setVisibility('visible')
  showInViewport(inside)
  const [seen] = ofType(records, 'seen')
  expect(Object.keys(seen)).toEqual(['type', 'visit', 'at', 'page', 'zone'])
  expect([seen.page, seen.zone]).toEqual(['/', 'myapp.due-date'])
  expect(ofType(records, 'seen').length).toEqual(1)
})

test('a zone is used once per page view, at the first click, input or key', async () => {
  const records = collect()
  navigate('/')
  mountApp({ screens: { ...screens, [app]: () => zonedScreen() } })
  await settled()
  const root = screenRoot()
  const field = root.querySelector('#field')
  field.dispatchEvent(trusted(new Event('input', { bubbles: true, composed: true })))
  pressKey(field, 'a')
  click(root.querySelector('#act'))
  click(root.querySelector('#outside'))
  const [used] = ofType(records, 'used')
  expect(Object.keys(used)).toEqual(['type', 'visit', 'at', 'page', 'zone'])
  expect(described(records)).toEqual([
    'page / ',
    'used / null',
    'seen / myapp.due-date',
    'used / myapp.due-date',
  ])
})

test('Tab, a modifier key, Escape and a function key are no use, a letter and Enter are', async () => {
  const records = collect()
  navigate('/')
  mountApp({ screens: { ...screens, [app]: () => zonedScreen() } })
  await settled()
  const field = screenRoot().querySelector('#field')
  const keys = ['Tab', 'Shift', 'Control', 'Alt', 'Meta', 'CapsLock', 'Escape', 'F1', 'F12', 'F24']
  for (const key of keys) pressKey(field, key)
  expect(ofType(records, 'used')).toEqual([])
  pressKey(field, 'a')
  expect(described(ofType(records, 'used'))).toEqual(['used / null', 'used / myapp.due-date'])
  navigate('/invoices')
  await settled()
  pressKey(document.body, 'Enter')
  expect(ofType(records, 'used').map((record) => record.page)).toEqual(['/', '/', '/invoices'])
})

test('a pointer press, a wheel turn and an event of the code are no use', async () => {
  const records = collect()
  navigate('/')
  mountApp({ screens: { ...screens, [app]: () => zonedScreen() } })
  await settled()
  const act = screenRoot().querySelector('#act')
  act.dispatchEvent(trusted(new PointerEvent('pointerdown', { bubbles: true, composed: true })))
  act.dispatchEvent(trusted(new WheelEvent('wheel', { bubbles: true, composed: true })))
  act.click()
  act.dispatchEvent(new KeyboardEvent('keydown', { key: 'a', bubbles: true, composed: true }))
  expect(ofType(records, 'used')).toEqual([])
})

test('a zone that is used before it is in the viewport is seen first, and seen once', async () => {
  const records = collect()
  navigate('/')
  mountApp({ screens: { ...screens, [app]: () => zonedScreen() } })
  await settled()
  const root = screenRoot()
  click(root.querySelector('#act'))
  showInViewport(root.querySelector('#inside'))
  expect(described(records).slice(1)).toEqual([
    'used / null',
    'seen / myapp.due-date',
    'used / myapp.due-date',
  ])
})

test('each page view can send its own used records', async () => {
  const records = collect()
  navigate('/')
  mountApp({ screens: { ...screens, [app]: () => zonedScreen() } })
  await settled()
  click(screenRoot().querySelector('#outside'))
  navigate('/invoices')
  await settled()
  click(document.body)
  click(document.body)
  expect(ofType(records, 'used').map((record) => record.page)).toEqual(['/', '/invoices'])
})

const rowsScreen = component('analytics-rows', {
  setup: () =>
    div(
      zone(
        { name: 'myapp.invoice-form' },
        zone({ name: 'myapp.invoice-row' }, button({ id: 'one' }, 'one')),
        zone({ name: 'myapp.invoice-row' }, button({ id: 'two' }, 'two')),
      ),
    ),
})

test('zones of one name are one zone, and nested zones both count', async () => {
  const records = collect()
  navigate('/')
  mountApp({ screens: { ...screens, [app]: () => rowsScreen() } })
  await settled()
  const root = screenRoot()
  showInViewport(root.querySelector('#one'))
  showInViewport(root.querySelector('#two'))
  click(root.querySelector('#one'))
  click(root.querySelector('#two'))
  expect(described(records).slice(1)).toEqual([
    'seen / myapp.invoice-form',
    'seen / myapp.invoice-row',
    'used / null',
    'used / myapp.invoice-row',
    'used / myapp.invoice-form',
  ])
})

test('a zone name and an outcome name carry a namespace', () => {
  const error = spy(console, 'error', () => {})
  const records = collect()
  zone({ name: 'due-date' }, div('x'))
  track('invoiceSent')
  expect(ofType(records, 'outcome')).toEqual([])
  expect(error.calls.length).toEqual(2)
  expect(() => zone('myapp.due-date', div('x'))).toThrow('zone({ name }')
  expect(() => track('myapp.invoice-form', 'invalid')).toThrow('track(name) takes a name only')
})

test('a zone name and an outcome name use only plain characters', async () => {
  const error = spy(console, 'error', () => {})
  const records = collect()
  navigate('/invoices/4')
  mountApp()
  await settled()
  track('myapp.<b>sent</b>')
  track('myapp.caf\u00e9')
  track('myapp.invoice sent')
  track(`myapp.${'x'.repeat(123)}`)
  zone({ name: 'myapp.$(id)' }, div('x'))
  expect(ofType(records, 'outcome')).toEqual([])
  expect(error.calls.length).toEqual(5)
  track('my_app.Invoice-sent_2')
  track(`myapp.${'x'.repeat(122)}`)
  expect(ofType(records, 'outcome').map((record) => record.name.length)).toEqual([21, 128])
})

test('track records an outcome on the current page', async () => {
  const records = collect()
  navigate('/invoices/4')
  mountApp()
  await settled()
  track('myapp.invoice-sent')
  const [sent] = ofType(records, 'outcome')
  expect(Object.keys(sent)).toEqual(['type', 'visit', 'at', 'page', 'name'])
  expect([sent.page, sent.name]).toEqual(['/invoices/:id', 'myapp.invoice-sent'])
})

test('a state subscriber that throws sends an error, and the others still run', async () => {
  spy(console, 'error', () => {})
  const records = collect()
  const seen = []
  let count
  const probe = component('analytics-state-probe', {
    setup: (self) => {
      count = initState(self, 'analytics.count', 0)
      count.watch(self, (value) => {
        if (value === 1) throw new TypeError('total is undefined')
      })
      count.watch(self, (value) => seen.push(value))
      return div()
    },
  })
  navigate('/')
  mountApp({ screens: { ...screens, [app]: () => probe() } })
  await settled()
  count.set(1)
  expect(seen).toEqual([0, 1])
  expect(ofType(records, 'error').length).toEqual(1)
  expect(Object.keys(ofType(records, 'error')[0])).toEqual(['type', 'visit', 'at', 'page'])
})

test('an error that an error boundary catches is an error', async () => {
  spy(console, 'error', () => {})
  const records = collect()
  const broken = component('analytics-broken', {
    setup: () => {
      throw new Error('first line\nsecond line')
    },
  })
  const boundary = component('analytics-boundary', {
    error: () => div('failed'),
    setup: () => div(broken()),
  })
  navigate('/')
  mountApp({ screens: { ...screens, [app]: () => boundary() } })
  await settled()
  expect(ofType(records, 'error').length).toEqual(1)
})

test('a request that fails with a 5xx or on the network is an error, a 4xx is not', async () => {
  const records = collect()
  let api
  const probe = component('analytics-http-probe', {
    setup: (self) => {
      api = initHttpClient(self, createHttpClient('analytics.api', { baseUrl: 'https://x.test' }))
      return div()
    },
  })
  navigate('/')
  mountApp({ screens: { ...screens, [app]: () => probe() } })
  await settled()
  let answer = () => new Response('', { status: 404 })
  spy(globalThis, 'fetch', () => Promise.resolve(answer()))
  await api.get('/missing').catch(() => {})
  expect(ofType(records, 'error')).toEqual([])
  answer = () => new Response('', { status: 500 })
  await api.post('/invoices/7/send').catch(() => {})
  expect(ofType(records, 'error').length).toEqual(1)
  for (const stop of stops.splice(0)) stop()
  const fresh = collect()
  answer = () => {
    throw new TypeError('offline')
  }
  await api.get('/list').catch(() => {})
  expect(ofType(fresh, 'error').length).toEqual(1)
})

test('ResizeObserver loop messages and a cross-origin Script error are no error record', async () => {
  const scriptError = windowEvents().bind(null, 'error')
  const records = collect()
  navigate('/')
  mountApp()
  await settled()
  scriptError({ message: 'ResizeObserver loop limit exceeded', error: null, filename: '' })
  scriptError({
    message: 'ResizeObserver loop completed with undelivered notifications.',
    error: null,
    filename: 'https://app.test/',
  })
  scriptError({ message: 'Script error.', error: null, filename: '' })
  expect(ofType(records, 'error')).toEqual([])
  scriptError({ message: 'Uncaught TypeError: total is undefined', error: null })
  expect(ofType(records, 'error').length).toEqual(1)
})

test(
  'errors go out at most once per 5 seconds, whatever throws',
  async ({ clock }) => {
    const fire = windowEvents()
    const records = collect()
    navigate('/')
    mountApp()
    await clock.tick(1)
    for (let index = 0; index < 50; index++) {
      fire('error', { message: `step ${index} failed`, error: new TypeError(`step ${index}`) })
    }
    fire('unhandledrejection', { reason: new Error('rejected') })
    expect(ofType(records, 'error').length).toEqual(1)
    await clock.tick(4999)
    fire('error', { message: 'late', error: new Error('late') })
    expect(ofType(records, 'error').length).toEqual(1)
    await clock.tick(1)
    fire('error', { message: 'late', error: new Error('late') })
    expect(ofType(records, 'error').length).toEqual(2)
    expect(ofType(records, 'error').every((record) => record.page === '/')).toEqual(true)
  },
  { fakeTimers: true },
)

test('a sink that throws or rejects is logged once, and becomes no error record', async () => {
  const error = spy(console, 'error', () => {})
  const records = collect()
  navigate('/')
  mountApp()
  await settled()
  stops.push(onAnalytics(() => Promise.reject(new Error('store down'))))
  stops.push(
    onAnalytics(() => {
      throw new Error('sink bug')
    }),
  )
  track('myapp.invoice-sent')
  await settled()
  expect(error.calls.length).toEqual(4)
  expect(ofType(records, 'error')).toEqual([])
  expect(ofType(records, 'outcome').length).toEqual(1)
})

test('onAnalytics(self, sink) ends when the component unmounts, and the last sink stops it', async () => {
  const records = []
  const host = component('analytics-sink-owner', {
    setup: (self) => {
      onAnalytics(self, (record) => void records.push(record))
      return div()
    },
  })()
  navigate('/')
  mountApp({ screens: { ...screens, [app]: () => host } })
  await settled()
  track('myapp.invoice-sent')
  document.body.replaceChildren()
  await settled()
  track('myapp.invoice-sent')
  expect(records.map((record) => record.type)).toEqual(['page', 'outcome'])
  expect(() => onAnalytics('sink')).toThrow('onAnalytics(sink)')
  expect(() => onAnalytics(() => {}, { when: null })).toThrow('takes a sink only')
})

test(
  'batch sends at size, after ms, on hide, on pagehide and on unregister',
  async ({ clock }) => {
    const fire = windowEvents()
    const sent = []
    navigate('/')
    mountApp({ screens: { ...screens, [app]: () => zonedScreen() } })
    await clock.tick(1)
    const stop = onAnalytics(batch((records) => void sent.push(records), { size: 5, ms: 1000 }))
    stops.push(stop)
    for (let index = 0; index < 4; index++) track(`myapp.step-${index}`)
    expect(sent.map((records) => records.length)).toEqual([5])
    expect(sent[0][0].type).toEqual('page')
    track('myapp.step-4')
    await clock.tick(999)
    expect(sent.length).toEqual(1)
    await clock.tick(1)
    expect(sent.map((records) => records.length)).toEqual([5, 1])

    click(screenRoot().querySelector('#act'))
    setVisibility('hidden')
    expect(sent.at(-1).map((record) => record.type)).toEqual(['used', 'seen', 'used'])

    setVisibility('visible')
    track('myapp.step-6')
    fire('pagehide', {})
    expect(sent.at(-1).map((record) => record.name)).toEqual(['myapp.step-6'])

    track('myapp.step-7')
    stop()
    expect(sent.at(-1).map((record) => record.name)).toEqual(['myapp.step-7'])
  },
  { fakeTimers: true },
)

test('batch adds the segments of each record when it arrives, under the fields of imp', async () => {
  const sent = []
  let plan = null
  navigate('/invoices')
  mountApp()
  await settled()
  const stop = onAnalytics(
    batch((records) => void sent.push(records), {
      segments: () => ({ plan, type: 'forged' }),
    }),
  )
  stops.push(stop)
  track('myapp.signed-in')
  plan = 'pro'
  track('myapp.invoice-sent')
  stop()
  expect(sent[0].map((record) => [record.type, record.plan])).toEqual([
    ['page', null],
    ['outcome', null],
    ['outcome', 'pro'],
  ])
  expect(() => batch(() => {}, { segments: { plan: 'pro' } })).toThrow('batch(send, { segments })')
  expect(() => batch(() => {}, { plan: 'pro' })).toThrow('remove plan')
})

test('a sink that registers after the page is ready gets the page record at once', async () => {
  const early = collect()
  navigate('/invoices')
  mountApp()
  await settled()
  const late = collect()
  track('myapp.later')
  expect(late.map((record) => record.type)).toEqual(['page', 'outcome'])
  expect(late[0]).toEqual(ofType(early, 'page')[0])
})

test(
  'a late sink gets a page that is not ready yet once, when it is ready',
  async ({ clock }) => {
    const early = collect()
    navigate('/')
    mountApp()
    await clock.tick(1)
    navigate('/reports')
    await clock.tick(10)
    const late = collect()
    expect(late).toEqual([])
    await clock.tick(40)
    expect(ofType(late, 'page').map((page) => page.page)).toEqual(['/reports'])
    expect(ofType(late, 'page')[0]).toEqual(ofType(early, 'page').at(-1))
  },
  { fakeTimers: true },
)

test('a collection that starts again sends the page record of the current screen', async () => {
  navigate('/invoices')
  mountApp()
  await settled()
  const first = collect()
  expect(ofType(first, 'page').length).toEqual(1)
  for (const stop of stops.splice(0)) stop()
  const second = collect()
  track('myapp.later')
  expect(described(second)).toEqual(['page /invoices ', 'outcome /invoices myapp.later'])
  expect(second[0].visit).toEqual(first[0].visit)
})

const ga4Sink =
  (gtag) =>
  ({ type, ...fields }) => {
    if (type === 'page') {
      gtag('event', 'page_view', {
        ...fields,
        page_location: 'https://app.test' + fields.page,
      })
    } else {
      gtag('event', type, fields)
    }
  }

const postHogSink =
  (posthog) =>
  ({ type, ...fields }) => {
    if (type === 'page') {
      posthog.capture('$pageview', {
        ...fields,
        $current_url: 'https://app.test' + fields.page,
      })
    } else {
      posthog.capture(type, fields)
    }
  }

const oneVisit = async () => {
  navigate('/')
  mountApp({ screens: { ...screens, [app]: () => zonedScreen() } })
  await settled()
  const inside = screenRoot().querySelector('#inside')
  showInViewport(inside)
  click(inside.querySelector('#act'))
  track('myapp.invoice-sent')
}

const withoutType = ({ type: _type, ...fields }) => fields

test('the GA4 sink of the docs maps the records to gtag calls', async () => {
  const calls = []
  const records = collect()
  stops.push(onAnalytics(ga4Sink((...args) => void calls.push(args))))
  await oneVisit()
  const [page, seen, pageUsed, zoneUsed, outcome] = records
  expect(calls).toEqual([
    ['event', 'page_view', { ...withoutType(page), page_location: 'https://app.test/' }],
    ['event', 'seen', withoutType(seen)],
    ['event', 'used', withoutType(pageUsed)],
    ['event', 'used', withoutType(zoneUsed)],
    ['event', 'outcome', withoutType(outcome)],
  ])
})

test('the PostHog sink of the docs maps the records to capture calls', async () => {
  const calls = []
  const records = collect()
  stops.push(onAnalytics(postHogSink({ capture: (...args) => void calls.push(args) })))
  await oneVisit()
  const [page, seen, pageUsed, zoneUsed, outcome] = records
  expect(calls).toEqual([
    ['$pageview', { ...withoutType(page), $current_url: 'https://app.test/' }],
    ['seen', withoutType(seen)],
    ['used', withoutType(pageUsed)],
    ['used', withoutType(zoneUsed)],
    ['outcome', withoutType(outcome)],
  ])
})
