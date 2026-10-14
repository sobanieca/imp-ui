import { appMap, mount } from 'imp'
import { div } from 'imp/html'
import { navigate, router } from 'imp/router'
import { onAnalytics, track } from 'imp/analytics'
import { alySink } from 'imp/analytics/aly'
import { afterEach, beforeEach, expect, spy, test } from 'imp/test'
import { settled } from './shadow.js'

const SERVERS = ['https://a.aly.test', 'https://b.aly.test/', 'https://c.aly.test/base']

const COLLECT_URLS = [
  'https://a.aly.test/collect/myapp',
  'https://b.aly.test/collect/myapp',
  'https://c.aly.test/base/collect/myapp',
]

const app = appMap({ home: { path: '/' } })

const stops = []

const microtasks = async () => {
  for (let index = 0; index < 10; index++) await null
  await new Promise((resolve) => setTimeout(resolve))
}

let answers = []

const stubFetch = () =>
  spy(globalThis, 'fetch', (url) => {
    const answer = answers.find((candidate) => candidate.url === url) ?? { status: 202 }
    if (answer.status === 'network') return Promise.reject(new TypeError('Failed to fetch'))
    return Promise.resolve(
      new Response(JSON.stringify({ accepted: 1, rejected: answer.rejected ?? 0 }), {
        status: answer.status,
      }),
    )
  })

const sentBodies = (fetch) => fetch.calls.map(([url, init]) => [url, JSON.parse(init.body)])

const register = (options) => {
  const stop = onAnalytics(alySink({ app: 'myapp', servers: SERVERS, size: 1, ...options }))
  stops.push(stop)
  return stop
}

const setFlag = (target, name, value) =>
  Object.defineProperty(target, name, { value, configurable: true })

beforeEach(async () => {
  answers = []
  setFlag(navigator, 'webdriver', false)
  document.body.replaceChildren()
  await microtasks()
  globalThis.__IMP_ENV__ = {}
  navigate('/')
  mount(document.body, div(router({ map: app, screens: { [app.home]: () => div('home') } })))
  await settled()
})

afterEach(async () => {
  for (const stop of stops.splice(0)) stop()
  delete navigator.webdriver
  delete document.prerendering
  document.body.replaceChildren()
  await microtasks()
})

test('alySink sends the first record at once, then each batch, to /collect/<app> of one server', async () => {
  const fetch = stubFetch()
  register({ size: 2 })
  track('myapp.invoice-sent')
  track('myapp.invoice-archived')
  await microtasks()
  const [[url, init], [nextUrl, nextInit]] = fetch.calls
  expect(nextUrl).toEqual(url)
  expect(COLLECT_URLS.includes(url)).toEqual(true)
  expect(init).toEqual({
    method: 'POST',
    body: init.body,
    keepalive: true,
    credentials: 'omit',
    referrerPolicy: 'strict-origin',
  })
  expect(JSON.parse(init.body).map((record) => record.type)).toEqual(['page'])
  expect(JSON.parse(nextInit.body).map((record) => record.name)).toEqual([
    'myapp.invoice-sent',
    'myapp.invoice-archived',
  ])
})

test('every record of a visit goes to the same server, also from a second sink', async () => {
  const fetch = stubFetch()
  register()
  register()
  track('myapp.first')
  track('myapp.second')
  await microtasks()
  expect(fetch.calls.length).toEqual(6)
  expect(new Set(fetch.calls.map(([url]) => url)).size).toEqual(1)
})

test('a server that fails on the network or with a 5xx hands the visit to the next one', async () => {
  const fetch = stubFetch()
  register()
  await microtasks()
  const home = COLLECT_URLS.indexOf(fetch.calls[0][0])
  const next = COLLECT_URLS[(home + 1) % 3]
  const last = COLLECT_URLS[(home + 2) % 3]
  answers = [
    { url: COLLECT_URLS[home], status: 'network' },
    { url: next, status: 503 },
  ]
  track('myapp.moved')
  await microtasks()
  expect(sentBodies(fetch).slice(1).map(([url, records]) => [url, records[0].name])).toEqual([
    [COLLECT_URLS[home], 'myapp.moved'],
    [next, 'myapp.moved'],
    [last, 'myapp.moved'],
  ])
  answers = []
  track('myapp.stays')
  await microtasks()
  expect(fetch.calls.at(-1)[0]).toEqual(last)
})

test('a 4xx answer drops the batch, logs it, and keeps the server', async () => {
  const fetch = stubFetch()
  const errors = spy(console, 'error', () => {})
  const warnings = spy(console, 'warn', () => {})
  register()
  await microtasks()
  const home = fetch.calls[0][0]
  answers = [{ url: home, status: 404 }]
  track('myapp.unknown-app')
  await microtasks()
  expect(fetch.calls.length).toEqual(2)
  expect(errors.calls.flat().join(' ')).toContain('imp-aly app add myapp')
  answers = [{ url: home, status: 202, rejected: 1 }]
  track('myapp.rejected')
  await microtasks()
  expect(fetch.calls.map(([url]) => url)).toEqual([home, home, home])
  expect(warnings.calls.flat().join(' ')).toContain(
    "rejected 1 of 1 records - run 'imp-aly app show myapp'",
  )
})

test('all servers that fail drop the batch with a warning', async () => {
  const fetch = stubFetch()
  const warnings = spy(console, 'warn', () => {})
  answers = COLLECT_URLS.map((url) => ({ url, status: 'network' }))
  register()
  await microtasks()
  expect(fetch.calls.length).toEqual(3)
  expect(warnings.calls.flat().join(' ')).toContain('no imp-aly server took 1 records')
})

test('segments are added to each record, and never replace a field of imp', async () => {
  const fetch = stubFetch()
  let plan = 'free'
  register({ segments: () => ({ plan, type: 'forged' }) })
  plan = 'pro'
  track('myapp.upgraded')
  await microtasks()
  const records = sentBodies(fetch).map(([, [record]]) => record)
  expect(records.map((record) => [record.type, record.plan])).toEqual([
    ['page', 'free'],
    ['outcome', 'pro'],
  ])
})

test('the batch of a sink with segments still goes out when the sink is unregistered', async () => {
  const fetch = stubFetch()
  const stop = register({ size: 20, segments: () => ({ plan: 'pro' }) })
  track('myapp.held')
  track('myapp.held-too')
  expect(fetch.calls.length).toEqual(1)
  stop()
  await microtasks()
  expect(sentBodies(fetch)[1][1].map((record) => [record.name, record.plan])).toEqual([
    ['myapp.held', 'pro'],
    ['myapp.held-too', 'pro'],
  ])
})

test('alySink sends nothing from a browser that automation software controls', async () => {
  const fetch = stubFetch()
  setFlag(navigator, 'webdriver', true)
  register()
  track('myapp.from-a-bot')
  await microtasks()
  expect(fetch.calls.length).toEqual(0)
})

test('alySink holds the records of a prerendered page until the page shows', async () => {
  const fetch = stubFetch()
  setFlag(document, 'prerendering', true)
  register()
  track('myapp.early')
  await microtasks()
  expect(fetch.calls.length).toEqual(0)
  setFlag(document, 'prerendering', false)
  document.dispatchEvent(new Event('prerenderingchange'))
  await microtasks()
  expect(sentBodies(fetch).map(([, [record]]) => record.type)).toEqual(['page', 'outcome'])
})

test('alySink checks its options', () => {
  expect(() => alySink({ servers: SERVERS })).toThrow('alySink({ app })')
  expect(() => alySink({ app: 'My App', servers: SERVERS })).toThrow('alySink({ app })')
  expect(() => alySink({ app: 'myapp', servers: [] })).toThrow('alySink({ servers })')
  expect(() => alySink({ app: 'myapp', servers: 'https://a.aly.test' })).toThrow(
    'alySink({ servers })',
  )
  expect(() => alySink({ app: 'myapp', servers: ['ftp://a.aly.test'] })).toThrow(
    "'ftp://a.aly.test' is not the URL of an imp-aly server",
  )
  expect(() => alySink({ app: 'myapp', servers: ['https://a.aly.test?x=1'] })).toThrow(
    'is not the URL of an imp-aly server',
  )
  expect(() => alySink({ app: 'myapp', servers: ['https://a.aly.test', 'https://a.aly.test/'] }))
    .toThrow('each server is in the list once')
  expect(() => alySink({ app: 'myapp', servers: SERVERS, segments: { plan: 'pro' } })).toThrow(
    'segments',
  )
  expect(() => alySink({ app: 'myapp', servers: SERVERS, url: '/collect' })).toThrow(
    'remove url',
  )
  expect(() => alySink({ app: 'myapp', servers: SERVERS, size: 0 })).toThrow('size')
})
