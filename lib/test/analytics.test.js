import { appMap, component, mount } from 'imp'
import { button, div, input, span } from 'imp/html'
import { guard, navigate, router } from 'imp/router'
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

const stops = []

const collect = (options) => {
  const records = []
  stops.push(onAnalytics((record) => void records.push(record), options))
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
  delete document.visibilityState
})

const app = appMap({
  home: { path: '/' },
  invoices: { $id: {} },
  reports: {},
})

const guarded = appMap({
  reports: {},
  secret: { access: 'admin' },
})

const slowScreen = component('analytics-slow-screen', {
  setup: () => new Promise((resolve) => setTimeout(() => resolve(div('slow')), 30)),
})

const screens = {
  [app.home]: () => div('home'),
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

test('the router records one view per screen, keyed by the route pattern', async () => {
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

  const views = ofType(records, 'view')
  expect(views.map((view) => view.page)).toEqual(['/invoices', '/invoices/:id', null])
  expect(views.map((view) => view.from)).toEqual([null, '/invoices', '/invoices/:id'])
  expect(views[2].path).toEqual('/nowhere/at/all')
  expect(views[0].path).toEqual(undefined)
  expect(typeof views[1].readyMs).toEqual('number')
  expect(new Set(views.map((view) => view.view)).size).toEqual(3)
  expect(new Set(records.map((record) => record.visit)).size).toEqual(1)
  expect(JSON.parse(JSON.stringify(records))).toEqual(records)
})

test('a view is ready when the screen replaces its loading content', async ({ clock }) => {
  const records = collect()
  navigate('/')
  mountApp()
  await clock.tick(1)
  navigate('/reports')
  await clock.tick(10)
  expect(ofType(records, 'view').map((view) => view.page)).toEqual(['/'])
  await clock.tick(30)
  const reports = ofType(records, 'view').find((view) => view.page === '/reports')
  expect(reports.readyMs >= 30).toEqual(true)
}, { fakeTimers: true })

test('a view that the person leaves before it is ready has readyMs null', async () => {
  const records = collect()
  navigate('/')
  mountApp()
  await settled()
  navigate('/reports')
  await settled()
  navigate('/')
  await settled()
  const reports = ofType(records, 'view').find((view) => view.page === '/reports')
  expect(reports.readyMs).toEqual(null)
})

const withRole = component('analytics-role', {
  setup: (self, options) => {
    initState(self, 'analytics.role', 'user')
    return router(options)
  },
})

test('a guard redirect gives one view, for the node where the navigation ends', async () => {
  const records = collect()
  navigate('/secret')
  mount(
    document.body,
    withRole({
      map: guarded,
      screens: { [guarded.reports]: () => div('reports'), [guarded.secret]: () => div('secret') },
      access: guard(['analytics.role'], (role) => role === 'admin' ? true : '/reports'),
    }),
  )
  await new Promise((resolve) => setTimeout(resolve, 60))
  expect(ofType(records, 'view').map((view) => view.page)).toEqual(['/reports'])
})

test(
  'engaged time goes out as a delta when the document hides and when the view ends',
  async ({ clock }) => {
    const records = collect()
    navigate('/')
    mountApp()
    await clock.tick(1000)
    setVisibility('hidden')
    await clock.tick(5000)
    setVisibility('visible')
    await clock.tick(2000)
    navigate('/invoices')
    await clock.tick(1)
    const times = ofType(records, 'time')
    expect(times.map((time) => time.ms)).toEqual([1000, 2000])
    expect(times.every((time) => time.page === '/')).toEqual(true)
  },
  { fakeTimers: true },
)

const zoned = (name) =>
  component(`analytics-zoned-${name}`, {
    setup: () =>
      div(
        zone({ name }, div({ id: 'inside' }, input({ id: 'field' }), button({ id: 'act' }, 'act'))),
        span({ id: 'outside' }, 'outside'),
      ),
  })

const zonedScreen = zoned('due-date')

test('a zone records seen and the active time of the person, per view', async ({ clock }) => {
  const records = collect()
  navigate('/')
  mountApp({ screens: { ...screens, [app.home]: () => zonedScreen() } })
  await clock.tick(1)
  const inside = screenRoot().querySelector('#inside')
  showInViewport(inside)
  inside.querySelector('#field').dispatchEvent(
    new KeyboardEvent('keydown', { key: 'a', bubbles: true, composed: true }),
  )
  await clock.tick(2000)
  inside.querySelector('#act').dispatchEvent(
    new PointerEvent('pointerdown', { bubbles: true, composed: true }),
  )
  await clock.tick(10000)
  navigate('/invoices')
  await clock.tick(1)
  const zones = ofType(records, 'zone')
  expect(zones).toEqual([{
    type: 'zone',
    visit: zones[0].visit,
    view: zones[0].view,
    page: '/',
    name: 'due-date',
    seen: true,
    activeMs: 7000,
  }])
}, { fakeTimers: true })

test('Tab and a modifier key alone are no use of a zone', async ({ clock }) => {
  const records = collect()
  navigate('/')
  mountApp({ screens: { ...screens, [app.home]: () => zonedScreen() } })
  await clock.tick(1)
  const field = screenRoot().querySelector('#field')
  for (const key of ['Tab', 'Shift', 'Control']) {
    field.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true, composed: true }))
  }
  screenRoot().querySelector('#outside').dispatchEvent(
    new PointerEvent('pointerdown', { bubbles: true, composed: true }),
  )
  navigate('/invoices')
  await clock.tick(1)
  expect(ofType(records, 'zone')).toEqual([])
}, { fakeTimers: true })

const rowsScreen = component('analytics-rows', {
  setup: () =>
    div(
      zone(
        { name: 'invoice-form' },
        zone({ name: 'invoice-row' }, button({ id: 'one' }, 'one')),
        zone({ name: 'invoice-row' }, button({ id: 'two' }, 'two')),
      ),
    ),
})

test('zones of one name are one zone, and nested zones both count', async ({ clock }) => {
  const records = collect()
  navigate('/')
  mountApp({ screens: { ...screens, [app.home]: () => rowsScreen() } })
  await clock.tick(1)
  const root = screenRoot()
  const press = (id) =>
    root.querySelector(`#${id}`).dispatchEvent(
      new PointerEvent('pointerdown', { bubbles: true, composed: true }),
    )
  press('one')
  await clock.tick(1000)
  press('two')
  await clock.tick(8000)
  navigate('/invoices')
  await clock.tick(1)
  const zones = Object.fromEntries(
    ofType(records, 'zone').map((record) => [record.name, record.activeMs]),
  )
  expect(zones).toEqual({ 'invoice-form': 6000, 'invoice-row': 6000 })
}, { fakeTimers: true })

test('a zone name and an action name must be kebab case', () => {
  const error = spy(console, 'error', () => {})
  const records = collect()
  zone({ name: 'dueDate' }, div('x'))
  track('invoiceSent')
  track('invoice-form', { valid: false })
  expect(ofType(records, 'action')).toEqual([])
  expect(error.calls.length).toEqual(3)
  expect(() => zone('due-date', div('x'))).toThrow('zone({ name }')
})

test('track records an outcome with an optional value, in the current view', async () => {
  const records = collect()
  navigate('/invoices/4')
  mountApp()
  await settled()
  track('invoice-sent')
  track('invoice-form', 'invalid')
  const [sent, form] = ofType(records, 'action')
  expect(sent.name).toEqual('invoice-sent')
  expect('value' in sent).toEqual(false)
  expect(form.value).toEqual('invalid')
  expect(form.page).toEqual('/invoices/:id')
})

test('a state subscriber that throws sends one script error, and the others still run', () => {
  spy(console, 'error', () => {})
  const records = collect()
  const seen = []
  let count
  mount(
    document.body,
    component('analytics-state-probe', {
      setup: (self) => {
        count = initState(self, 'analytics.count', 0)
        count.watch(self, (value) => {
          if (value === 1) throw new TypeError('total is undefined')
        })
        count.watch(self, (value) => seen.push(value))
        return div()
      },
    })(),
  )
  count.set(1)
  expect(seen).toEqual([0, 1])
  const errors = ofType(records, 'error')
  expect(errors.map(({ source, message }) => ({ source, message }))).toEqual([
    { source: 'script', message: 'TypeError: total is undefined' },
  ])
})

test('an error that an error boundary catches is a render error', async () => {
  spy(console, 'error', () => {})
  const records = collect()
  const broken = component('analytics-broken', {
    setup: () => {
      throw new Error('first line\nsecond line')
    },
  })
  mount(
    document.body,
    component('analytics-boundary', {
      error: () => div('failed'),
      setup: () => div(broken()),
    })(),
  )
  await settled()
  expect(ofType(records, 'error').map(({ source, message }) => ({ source, message }))).toEqual([
    { source: 'render', message: 'Error: first line' },
  ])
})

test('a request that fails with a 5xx or on the network is a request error', async () => {
  const records = collect()
  let api
  mount(
    document.body,
    component('analytics-http-probe', {
      setup: (self) => {
        api = initHttpClient(self, createHttpClient('analytics.api', { baseUrl: 'https://x.test' }))
        return div()
      },
    })(),
  )
  let answer = () => new Response('', { status: 500 })
  spy(globalThis, 'fetch', () => Promise.resolve(answer()))
  await api.post('/invoices/7/send?token=secret').catch(() => {})
  answer = () => new Response('', { status: 404 })
  await api.get('/missing').catch(() => {})
  answer = () => {
    throw new TypeError('offline')
  }
  await api.get('/list').catch(() => {})
  expect(ofType(records, 'error').map((record) => record.message)).toEqual([
    'request failed: 500 POST /invoices/7/send',
    'request failed: network GET /list',
  ])
  expect(ofType(records, 'error').every((record) => record.source === 'request')).toEqual(true)
})

test('a sink that throws or rejects is logged once, and becomes no error record', async () => {
  const error = spy(console, 'error', () => {})
  const records = collect()
  stops.push(onAnalytics(() => Promise.reject(new Error('store down'))))
  stops.push(onAnalytics(() => {
    throw new Error('sink bug')
  }))
  track('invoice-sent')
  await settled()
  expect(error.calls.length).toEqual(2)
  expect(ofType(records, 'error')).toEqual([])
  expect(ofType(records, 'action').length).toEqual(1)
})

test('onAnalytics(self, sink) ends when the component unmounts, and the last sink stops it', async () => {
  const records = []
  const host = component('analytics-sink-owner', {
    setup: (self) => {
      onAnalytics(self, (record) => void records.push(record))
      return div()
    },
  })()
  mount(document.body, host)
  track('invoice-sent')
  document.body.replaceChildren()
  await settled()
  track('invoice-sent')
  expect(records.length).toEqual(1)
  expect(() => onAnalytics('sink')).toThrow('onAnalytics(sink)')
})

test(
  'batch sends at size, after ms, on hide after the time and zone records, and on unregister',
  async ({ clock }) => {
    const sent = []
    const stop = onAnalytics(batch((records) => void sent.push(records), { size: 5, ms: 1000 }))
    stops.push(stop)
    for (let index = 0; index < 5; index++) track('a-step', index)
    expect(sent.map((records) => records.length)).toEqual([5])
    track('a-step', 5)
    await clock.tick(999)
    expect(sent.length).toEqual(1)
    await clock.tick(1)
    expect(sent.map((records) => records.length)).toEqual([5, 1])

    navigate('/')
    mountApp({ screens: { ...screens, [app.home]: () => zonedScreen() } })
    await clock.tick(1)
    screenRoot().querySelector('#act').dispatchEvent(
      new PointerEvent('pointerdown', { bubbles: true, composed: true }),
    )
    await clock.tick(100)
    setVisibility('hidden')
    const flushed = sent.at(-1).map((record) => record.type)
    expect(flushed).toEqual(['view', 'time', 'zone'])

    setVisibility('visible')
    track('a-five')
    stop()
    expect(sent.at(-1).map((record) => record.name)).toEqual(['a-five'])
  },
  { fakeTimers: true },
)

test('when holds the records until the state is true, and keeps the entry view', async () => {
  let consent
  mount(
    document.body,
    component('analytics-consent', {
      setup: (self) => {
        consent = initState(self, 'analytics.consent', false)
        return div()
      },
    })(),
  )
  const records = collect({ when: consent })
  navigate('/invoices')
  mountApp()
  await settled()
  for (let index = 0; index < 250; index++) track('a-step', index)
  expect(records).toEqual([])
  consent.set(true)
  expect(records.length).toEqual(200)
  expect(records[0].type).toEqual('view')
  expect(records[1].value).toEqual(51)
  expect(records.at(-1).value).toEqual(249)
  track('a-live')
  expect(records.at(-1).name).toEqual('a-live')
  consent.set(false)
  track('a-held')
  expect(records.at(-1).name).toEqual('a-live')
})

const ga4Sink = (gtag) => (record) => {
  if (record.type === 'view') {
    gtag('event', 'page_view', { page_location: 'https://app.test' + (record.page ?? record.path) })
  }
  if (record.type === 'zone') {
    gtag('event', 'zone', { zone: record.name, seen: record.seen, active_ms: record.activeMs })
  }
  if (record.type === 'action') {
    gtag('event', record.name.replaceAll('-', '_'), { outcome: record.value })
  }
  if (record.type === 'error') {
    gtag('event', 'exception', { description: record.message, fatal: false })
  }
}

const postHogSink = (posthog) => (record) => {
  if (record.type === 'view') {
    posthog.capture('$pageview', {
      $current_url: 'https://app.test' + (record.page ?? record.path),
    })
  }
  if (record.type === 'zone') {
    posthog.capture('zone', { zone: record.name, seen: record.seen, active_ms: record.activeMs })
  }
  if (record.type === 'action') posthog.capture(record.name, { value: record.value })
  if (record.type === 'error') {
    posthog.captureException(new Error(record.message), { source: record.source })
  }
}

let total

const totalProbe = component('analytics-total', {
  setup: (self) => {
    total = initState(self, 'analytics.total', 0)
    total.watch(self, (value) => {
      if (value > 0) throw new TypeError('total is undefined')
    })
    return div()
  },
})

const oneVisit = async (clock) => {
  navigate('/')
  mountApp({ screens: { ...screens, [app.home]: () => zonedScreen() } })
  await clock.tick(1)
  const inside = screenRoot().querySelector('#inside')
  showInViewport(inside)
  inside.querySelector('#act').dispatchEvent(
    new PointerEvent('pointerdown', { bubbles: true, composed: true }),
  )
  await clock.tick(1000)
  track('invoice-sent')
  setVisibility('hidden')
  setVisibility('visible')
  navigate('/invoices/7')
  await clock.tick(1)
  spy(console, 'error', () => {})
  document.body.append(totalProbe())
  total.set(1)
}

test('the GA4 sink of the docs maps one visit to gtag calls', async ({ clock }) => {
  const calls = []
  stops.push(onAnalytics(ga4Sink((...args) => void calls.push(args))))
  await oneVisit(clock)
  expect(calls).toEqual([
    ['event', 'page_view', { page_location: 'https://app.test/' }],
    ['event', 'invoice_sent', { outcome: undefined }],
    ['event', 'zone', { zone: 'due-date', seen: true, active_ms: 1000 }],
    ['event', 'zone', { zone: 'due-date', seen: true, active_ms: 0 }],
    ['event', 'page_view', { page_location: 'https://app.test/invoices/:id' }],
    ['event', 'exception', { description: 'TypeError: total is undefined', fatal: false }],
  ])
}, { fakeTimers: true })

test('the PostHog sink of the docs maps one visit to capture calls', async ({ clock }) => {
  const calls = []
  stops.push(onAnalytics(postHogSink({
    capture: (...args) => void calls.push(args),
    captureException: (error, properties) =>
      void calls.push(['$exception', error.message, properties]),
  })))
  await oneVisit(clock)
  expect(calls).toEqual([
    ['$pageview', { $current_url: 'https://app.test/' }],
    ['invoice-sent', { value: undefined }],
    ['zone', { zone: 'due-date', seen: true, active_ms: 1000 }],
    ['zone', { zone: 'due-date', seen: true, active_ms: 0 }],
    ['$pageview', { $current_url: 'https://app.test/invoices/:id' }],
    ['$exception', 'TypeError: total is undefined', { source: 'script' }],
  ])
}, { fakeTimers: true })
