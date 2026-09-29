import { appMap, mount } from 'imp'
import { div } from 'imp/html'
import { area, navigate, router } from 'imp/router'
import { beforeEach, expect, spy, test } from 'imp/test'
import { settled } from './shadow.js'

const RUNNING_BUILD = '/chunks/main-AAAAAAAA.js'
const NEW_BUILD = '/chunks/main-BBBBBBBB.js'

const pageNaming = (entry) =>
  `<!doctype html><html><head><script type="module" src="${entry}"></script></head></html>`

const missingChunk = () =>
  Promise.reject(new TypeError('Failed to fetch dynamically imported module'))

beforeEach(() => {
  document.body.replaceChildren()
  document.head.innerHTML = `<script type="module" src="${RUNNING_BUILD}"></script>`
  sessionStorage.clear()
  globalThis.__IMP_ENV__ = {}
})

const mountArea = (loader) => {
  const app = appMap({ admin: {} })
  navigate('/admin')
  mount(document.body, div(router({ map: app, screens: { [app.admin]: area(loader) } })))
}

const serve = (entry) =>
  spy(globalThis, 'fetch', () => Promise.resolve(new Response(pageNaming(entry))))

test('a lazy chunk that is gone after a deploy loads the page again, once', async () => {
  spy(console, 'warn', () => {})
  const errors = spy(console, 'error', () => {})
  const fetched = serve(NEW_BUILD)
  const reload = spy(location, 'reload', () => {})
  mountArea(missingChunk)
  await settled()
  await settled()
  expect(fetched.calls.length).toEqual(1)
  expect(reload.calls.length).toEqual(1)
  expect(errors.calls.length).toEqual(0)

  document.body.replaceChildren()
  mountArea(missingChunk)
  await settled()
  await settled()
  expect(reload.calls.length).toEqual(1)
  expect(errors.calls.length).toEqual(1)
})

test('a lazy chunk that fails while the server names the running build does not reload', async () => {
  const errors = spy(console, 'error', () => {})
  serve(RUNNING_BUILD)
  const reload = spy(location, 'reload', () => {})
  mountArea(missingChunk)
  await settled()
  await settled()
  expect(reload.calls.length).toEqual(0)
  expect(errors.calls.length).toEqual(1)
})

test('a lazy chunk that fails when the server cannot be reached does not reload', async () => {
  const errors = spy(console, 'error', () => {})
  spy(globalThis, 'fetch', () => Promise.reject(new TypeError('offline')))
  const reload = spy(location, 'reload', () => {})
  mountArea(missingChunk)
  await settled()
  await settled()
  expect(reload.calls.length).toEqual(0)
  expect(errors.calls.length).toEqual(1)
})

test('a chunk that throws an error of its own does not ask the server', async () => {
  const errors = spy(console, 'error', () => {})
  const fetched = serve(NEW_BUILD)
  const reload = spy(location, 'reload', () => {})
  mountArea(() => Promise.reject(new Error('the module failed')))
  await settled()
  expect(fetched.calls.length).toEqual(0)
  expect(reload.calls.length).toEqual(0)
  expect(errors.calls.length).toEqual(1)
})
