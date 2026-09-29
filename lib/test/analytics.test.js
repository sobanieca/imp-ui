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

const windowEvents = () => {
  const added = spy(globalThis, 'addEventListener')
  return (type, event) => {
    for (const [name, listener] of added.calls) {
      if (name === type) listener(event)
    }
  }
}

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

test(
  'a view that the person leaves before it is ready has readyMs null and waitedMs',
  async ({ clock }) => {
    const records = collect()
    navigate('/')
    mountApp()
    await clock.tick(1)
    navigate('/reports')
    await clock.tick(10)
    navigate('/')
    await clock.tick(1)
    const reports = ofType(records, 'view').find((view) => view.page === '/reports')
    expect(reports.readyMs).toEqual(null)
    expect(reports.waitedMs).toEqual(10)
    expect('waitedMs' in ofType(records, 'view')[0]).toEqual(false)
  },
  { fakeTimers: true },
)

test(
  'a page that hides before the screen is ready sends the view once, before the time record',
  async ({ clock }) => {
    const records = collect()
    navigate('/')
    mountApp()
    await clock.tick(1)
    navigate('/reports')
    await clock.tick(10)
    setVisibility('hidden')
    const reports = () => ofType(records, 'view').filter((view) => view.page === '/reports')
    expect(reports().map(({ readyMs, waitedMs }) => ({ readyMs, waitedMs }))).toEqual([
      { readyMs: null, waitedMs: 10 },
    ])
    const hidden = records.slice(records.indexOf(reports()[0]))
    expect(hidden.every((record) => record.view === reports()[0].view)).toEqual(true)
    setVisibility('visible')
    await clock.tick(40)
    setVisibility('hidden')
    navigate('/')
    await clock.tick(1)
    expect(reports().length).toEqual(1)
  },
  { fakeTimers: true },
)

test('pagehide sends a view that is not ready and flushes a batch', async ({ clock }) => {
  const fire = windowEvents()
  const sent = []
  stops.push(onAnalytics(batch((records) => void sent.push(records))))
  navigate('/')
  mountApp()
  await clock.tick(1)
  navigate('/reports')
  await clock.tick(10)
  expect(sent).toEqual([])
  fire('pagehide', {})
  const last = sent.flat().at(-1)
  expect([last.type, last.page, last.readyMs, last.waitedMs]).toEqual([
    'view',
    '/reports',
    null,
    10,
  ])
  fire('pagehide', {})
  setVisibility('hidden')
  await clock.tick(40)
  expect(
    sent.flat().filter((record) => record.page === '/reports' && record.type === 'view').length,
  )
    .toEqual(1)
}, { fakeTimers: true })

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

test('a failed request gives one record, and a message never carries a query or an origin', async () => {
  spy(console, 'error', () => {})
  const records = collect()
  let api
  mount(
    document.body,
    component('analytics-http-owner', {
      setup: (self) => {
        api = initHttpClient(self, createHttpClient('analytics.api', { baseUrl: 'https://x.test' }))
        return div()
      },
    })(),
  )
  let answer = () => new Response('', { status: 503 })
  spy(globalThis, 'fetch', () => Promise.resolve(answer()))
  const screen = (path) =>
    component(`analytics-http-screen-${path.length}`, {
      setup: async () => div(await api.get(path)),
    })
  mount(
    document.body,
    component('analytics-http-boundary', {
      error: () => div('failed'),
      setup: () => div(screen('/down?token=secret')()),
    })(),
  )
  await settled()
  answer = () => new Response('', { status: 404 })
  mount(
    document.body,
    component('analytics-http-missing', {
      error: () => div('failed'),
      setup: () => div(screen('/missing?email=a@b.test')()),
    })(),
  )
  await settled()
  mount(
    document.body,
    component('analytics-url-boundary', {
      error: () => div('failed'),
      setup: () =>
        div(
          component('analytics-url-thrower', {
            setup: () => {
              throw new Error('cannot read https://x.test/users/7?email=a@b.test and /a?b=c')
            },
          })(),
        ),
    })(),
  )
  await settled()
  expect(ofType(records, 'error').map(({ source, message }) => ({ source, message }))).toEqual([
    { source: 'request', message: 'request failed: 503 GET /down' },
    { source: 'render', message: 'request failed: 404 GET /missing' },
    { source: 'render', message: 'Error: cannot read /users/7 and /a' },
  ])
})

test('ResizeObserver loop messages and a cross-origin Script error are no error record', () => {
  const scriptError = windowEvents().bind(null, 'error')
  const records = collect()
  scriptError({ message: 'ResizeObserver loop limit exceeded', error: null, filename: '' })
  scriptError({
    message: 'ResizeObserver loop completed with undelivered notifications.',
    error: null,
    filename: 'https://app.test/',
  })
  scriptError({ message: 'Script error.', error: null, filename: '' })
  scriptError({ message: 'Script error.', error: null, filename: 'https://app.test/main.js' })
  scriptError({ message: 'Uncaught TypeError: total is undefined', error: null })
  expect(ofType(records, 'error').map((record) => record.message)).toEqual([
    'Script error.',
    'Uncaught TypeError: total is undefined',
  ])
})

test(
  'identical errors in a view give one record with a count, and a view has 10 or fewer',
  async ({ clock }) => {
    const scriptError = windowEvents().bind(null, 'error')
    const records = collect()
    navigate('/')
    mountApp()
    await clock.tick(1)
    const fail = (message) => scriptError({ message, error: new TypeError(message) })
    for (let index = 0; index < 5; index++) fail('total is undefined')
    for (let index = 0; index < 12; index++) fail(`step ${index} failed`)
    fail('total is undefined')
    const first = ofType(records, 'error')
    expect(first.length).toEqual(10)
    expect(first[0].message).toEqual('TypeError: total is undefined')
    expect(first.every((record) => record.count === 1)).toEqual(true)
    expect(first.at(-1).message).toEqual('TypeError: step 8 failed')

    setVisibility('hidden')
    setVisibility('visible')
    const repeats = ofType(records, 'error').slice(10)
    expect(repeats.map(({ source, message, count }) => ({ source, message, count }))).toEqual([
      { source: 'script', message: 'TypeError: total is undefined', count: 5 },
    ])
    expect(repeats[0].view).toEqual(first[0].view)

    fail('total is undefined')
    navigate('/invoices')
    await clock.tick(1)
    fail('total is undefined')
    const [, repeat, next] = ofType(records, 'error').slice(10)
    expect([repeat.count, repeat.view]).toEqual([1, first[0].view])
    expect(next.count).toEqual(1)
    expect(next.page).toEqual('/invoices')
  },
  { fakeTimers: true },
)

const JWT_TOKEN =
  'eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.dozjgNryP4J3jVmNHl0w5N_XgL0n3I9PlFUP0THsR8U'

test('an email or a token in a path is scrubbed in every recorded URL', async () => {
  spy(console, 'error', () => {})
  const scriptError = windowEvents().bind(null, 'error')
  const records = collect()
  navigate('/')
  mountApp()
  await settled()
  const offMap = [
    '/users/ann.lee@example.com/profile',
    `/reset/${JWT_TOKEN}`,
    '/files/4f9c2a7e1b3d5f60718293a4b5c6d7e8',
    '/orders/123e4567-e89b-12d3-a456-426614174000/how-to-pay-an-invoice-in-2026',
  ]
  for (const path of offMap) {
    navigate(path)
    await settled()
    navigate('/')
    await settled()
  }
  expect(ofType(records, 'view').filter((view) => view.page === null).map((view) => view.path))
    .toEqual([
      '/users/:email/profile',
      '/reset/:token',
      '/files/:token',
      '/orders/123e4567-e89b-12d3-a456-426614174000/how-to-pay-an-invoice-in-2026',
    ])

  let api
  mount(
    document.body,
    component('analytics-scrub-probe', {
      setup: (self) => {
        api = initHttpClient(self, createHttpClient('analytics.api', { baseUrl: 'https://x.test' }))
        return div()
      },
    })(),
  )
  spy(globalThis, 'fetch', () => Promise.resolve(new Response('', { status: 500 })))
  await api.get('/users/ann%40example.com/orders?token=secret').catch(() => {})
  await api.get(`/sessions/${JWT_TOKEN}`).catch(() => {})
  scriptError({
    message: 'failed',
    error: new Error(`cannot load https://x.test/reset/${JWT_TOKEN}/x and /users/a@b.test`),
  })
  expect(ofType(records, 'error').map((record) => record.message)).toEqual([
    'request failed: 500 GET /users/:email/orders',
    'request failed: 500 GET /sessions/:token',
    'Error: cannot load /reset/:token/x and /users/:email',
  ])
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

test('when holds the records while the state is unknown, and keeps the entry view', async () => {
  let consent
  mount(
    document.body,
    component('analytics-consent', {
      setup: (self) => {
        consent = initState(self, 'analytics.consent', null)
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
  consent.set(null)
  track('a-held')
  expect(records.at(-1).name).toEqual('a-live')
  consent.set(true)
  expect(records.at(-1).name).toEqual('a-held')
})

test('the hold keeps the first held view when records come before it', async () => {
  let consent
  mount(
    document.body,
    component('analytics-consent-early', {
      setup: (self) => {
        consent = initState(self, 'analytics.consent', null)
        return div()
      },
    })(),
  )
  const records = collect({ when: consent })
  track('a-boot')
  navigate('/invoices')
  mountApp()
  await settled()
  for (let index = 0; index < 250; index++) track('a-step', index)
  consent.set(true)
  expect(records.length).toEqual(200)
  expect(records[0].type).toEqual('view')
  expect(records[0].page).toEqual('/invoices')
  expect(records.at(-1).value).toEqual(249)
})

test('a batch sends what it holds when its consent ends, and drops the refused records', () => {
  let consent
  mount(
    document.body,
    component('analytics-consent-batch', {
      setup: (self) => {
        consent = initState(self, 'analytics.consent', true)
        return div()
      },
    })(),
  )
  const sent = []
  const stop = onAnalytics(batch((records) => void sent.push(records.map((r) => r.name))), {
    when: consent,
  })
  stops.push(stop)
  track('a-first')
  consent.set(false)
  expect(sent).toEqual([['a-first']])
  track('a-refused')
  consent.set(true)
  expect(sent).toEqual([['a-first']])
  track('a-second')
  stop()
  expect(sent).toEqual([['a-first'], ['a-second']])
})

let probedConsent

const consentHolder = component('analytics-consent-holder', {
  setup: (self, { initial }) => {
    probedConsent = initState(self, 'analytics.consent', initial)
    return div()
  },
})

const consentProbe = (initial) => {
  const host = document.createElement('div')
  document.body.append(host)
  mount(host, consentHolder({ initial }))
  return probedConsent
}

const described = (records) =>
  records.map((record) => record.type === 'view' ? `view ${record.page}` : record.name)

test('records that come while consent is refused are dropped, not held', async () => {
  const consent = consentProbe(false)
  const records = collect({ when: consent })
  navigate('/invoices')
  mountApp()
  await settled()
  track('a-refused')
  consent.set(true)
  track('a-granted')
  expect(described(records)).toEqual(['view /invoices', 'a-granted'])
})

test('a refusal drops the records that the hold kept while consent was unknown', async () => {
  const consent = consentProbe(null)
  const records = collect({ when: consent })
  navigate('/invoices')
  mountApp()
  await settled()
  track('a-unknown')
  consent.set(false)
  track('a-refused')
  consent.set(null)
  track('a-asked-again')
  consent.set(true)
  expect(described(records)).toEqual(['view /invoices', 'a-asked-again'])
})

test('a sink that registers after the view started gets the view record of that view', async () => {
  const early = collect()
  navigate('/invoices')
  mountApp()
  await settled()
  const late = collect()
  track('a-later')
  expect(late.map((record) => record.type)).toEqual(['view', 'action'])
  expect(late[0]).toEqual(ofType(early, 'view')[0])
  expect(late[1].view).toEqual(late[0].view)
})

test('a late sink gets a view that is not ready yet once, when it is ready', async ({ clock }) => {
  const early = collect()
  navigate('/')
  mountApp()
  await clock.tick(1)
  navigate('/reports')
  await clock.tick(10)
  const late = collect()
  expect(late).toEqual([])
  await clock.tick(40)
  expect(ofType(late, 'view').map((view) => view.page)).toEqual(['/reports'])
  expect(ofType(late, 'view')[0]).toEqual(ofType(early, 'view').at(-1))
}, { fakeTimers: true })

test('a late sink that waits for consent holds the view record of the current view', async () => {
  collect()
  navigate('/invoices')
  mountApp()
  await settled()
  const consent = consentProbe(null)
  const late = collect({ when: consent })
  track('a-unknown')
  expect(late).toEqual([])
  consent.set(true)
  expect(described(late)).toEqual(['view /invoices', 'a-unknown'])
})

test('a collection that starts again sends the view record of the current view', async () => {
  navigate('/invoices')
  mountApp()
  await settled()
  const first = collect()
  expect(ofType(first, 'view').length).toEqual(1)
  for (const stop of stops.splice(0)) stop()
  const second = collect()
  track('a-later')
  const [view] = ofType(second, 'view')
  expect(view?.page).toEqual('/invoices')
  expect(ofType(second, 'action')[0].view).toEqual(view.view)
  expect(view.view).not.toEqual(ofType(first, 'view')[0].view)
})

const ga4Sink = (gtag) => (record) => {
  const view = { view_id: record.view }
  if (record.type === 'view') {
    gtag('event', 'page_view', {
      ...view,
      page_location: 'https://app.test' + (record.page ?? record.path),
      from_page: record.from ?? '(entry)',
      ready: record.readyMs !== null,
      ready_ms: record.readyMs ?? record.waitedMs,
    })
  }
  if (record.type === 'time') gtag('event', 'engaged_time', { ...view, engaged_ms: record.ms })
  if (record.type === 'zone') {
    gtag('event', 'zone', {
      ...view,
      zone: record.name,
      seen: record.seen,
      active_ms: record.activeMs,
    })
  }
  if (record.type === 'action') {
    gtag('event', record.name.replaceAll('-', '_'), { ...view, outcome: record.value })
  }
  if (record.type === 'error') {
    gtag('event', 'exception', {
      ...view,
      description: record.message,
      fatal: false,
      error_count: record.count,
    })
  }
}

const postHogSink = (posthog) => (record) => {
  const view = { view_id: record.view }
  if (record.type === 'view') {
    posthog.capture('$pageview', {
      ...view,
      $current_url: 'https://app.test' + (record.page ?? record.path),
      from: record.from,
      ready: record.readyMs !== null,
      ready_ms: record.readyMs ?? record.waitedMs,
    })
  }
  if (record.type === 'time') posthog.capture('engaged_time', { ...view, engaged_ms: record.ms })
  if (record.type === 'zone') {
    posthog.capture('zone', {
      ...view,
      zone: record.name,
      seen: record.seen,
      active_ms: record.activeMs,
    })
  }
  if (record.type === 'action') posthog.capture(record.name, { ...view, value: record.value })
  if (record.type === 'error') {
    posthog.captureException(new Error(record.message), {
      ...view,
      source: record.source,
      count: record.count,
    })
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

const viewIds = (records) => ofType(records, 'view').map((view) => view.view)

test(
  'the GA4 sink of the docs maps one visit to gtag calls, keyed by the view',
  async ({ clock }) => {
    const calls = []
    const records = collect()
    stops.push(onAnalytics(ga4Sink((...args) => void calls.push(args))))
    await oneVisit(clock)
    const [home, invoice] = viewIds(records)
    expect(calls.filter(([, name]) => name !== 'engaged_time')).toEqual([
      ['event', 'page_view', {
        view_id: home,
        page_location: 'https://app.test/',
        from_page: ofType(records, 'view')[0].from ?? '(entry)',
        ready: true,
        ready_ms: ofType(records, 'view')[0].readyMs,
      }],
      ['event', 'invoice_sent', { view_id: home, outcome: undefined }],
      ['event', 'zone', { view_id: home, zone: 'due-date', seen: true, active_ms: 1000 }],
      ['event', 'zone', { view_id: home, zone: 'due-date', seen: true, active_ms: 0 }],
      ['event', 'page_view', {
        view_id: invoice,
        page_location: 'https://app.test/invoices/:id',
        from_page: '/',
        ready: true,
        ready_ms: ofType(records, 'view')[1].readyMs,
      }],
      ['event', 'exception', {
        view_id: invoice,
        description: 'TypeError: total is undefined',
        fatal: false,
        error_count: 1,
      }],
    ])
    const engaged = calls.filter(([, name]) => name === 'engaged_time')
    expect(engaged.map(([, , params]) => params)).toEqual(
      ofType(records, 'time').map((time) => ({ view_id: time.view, engaged_ms: time.ms })),
    )
  },
  { fakeTimers: true },
)

test(
  'the PostHog sink of the docs maps one visit to capture calls, keyed by the view',
  async ({ clock }) => {
    const calls = []
    const records = collect()
    stops.push(onAnalytics(postHogSink({
      capture: (...args) => void calls.push(args),
      captureException: (error, properties) =>
        void calls.push(['$exception', error.message, properties]),
    })))
    await oneVisit(clock)
    const [home, invoice] = viewIds(records)
    const withoutTime = calls.filter(([name]) => name !== 'engaged_time')
    expect(withoutTime).toEqual([
      ['$pageview', {
        view_id: home,
        $current_url: 'https://app.test/',
        from: ofType(records, 'view')[0].from,
        ready: true,
        ready_ms: ofType(records, 'view')[0].readyMs,
      }],
      ['invoice-sent', { view_id: home, value: undefined }],
      ['zone', { view_id: home, zone: 'due-date', seen: true, active_ms: 1000 }],
      ['zone', { view_id: home, zone: 'due-date', seen: true, active_ms: 0 }],
      ['$pageview', {
        view_id: invoice,
        $current_url: 'https://app.test/invoices/:id',
        from: '/',
        ready: true,
        ready_ms: ofType(records, 'view')[1].readyMs,
      }],
      ['$exception', 'TypeError: total is undefined', {
        view_id: invoice,
        source: 'script',
        count: 1,
      }],
    ])
    const engaged = calls.filter(([name]) => name === 'engaged_time')
    expect(engaged.map(([, properties]) => properties)).toEqual(
      ofType(records, 'time').map((time) => ({ view_id: time.view, engaged_ms: time.ms })),
    )
  },
  { fakeTimers: true },
)

test('a sink maps a view that was not ready to ready false and the wait', async ({ clock }) => {
  const calls = []
  stops.push(onAnalytics(ga4Sink((...args) => void calls.push(args))))
  navigate('/')
  mountApp()
  await clock.tick(1)
  navigate('/reports')
  await clock.tick(10)
  setVisibility('hidden')
  const pageViews = calls.filter(([, name]) => name === 'page_view').map(([, , params]) => params)
  expect([pageViews[1].ready, pageViews[1].ready_ms]).toEqual([false, 10])
}, { fakeTimers: true })
