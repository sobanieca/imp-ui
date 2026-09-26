import { component, mount } from 'imp'
import { createHttpClient, initHttpClient } from 'imp/http'
import { initState } from 'imp/state'
import { loader } from 'imp/std/feedback'
import { beforeEach, expect, spy, test } from 'imp/test'
import { settled } from './shadow.js'

const stateHost = component('loader-state-host', { setup: (self, render) => render(self) })

const mounted = (host) => {
  mount(document.body, host)
  return host
}

const inner = (host, selector) => host.shadowRoot.querySelector(selector)

const nested = (host, selector) => inner(inner(host, 'imp-loader'), selector)

const warnings = () => spy(console, 'warn', () => {})

const warned = (warn, text) => warn.calls.some(([first]) => String(first).includes(text))

const deferred = () => {
  let settle
  return { promise: new Promise((resolve) => settle = resolve), answer: (value) => settle(value) }
}

const jsonResponse = (body) =>
  new Response(JSON.stringify(body), {
    status: 200,
    headers: { 'content-type': 'application/json' },
  })

beforeEach(() => {
  document.body.replaceChildren()
})

test('loader is a status region that carries the spinner and a hidden label', () => {
  const host = mounted(loader({ label: 'Loading' }))
  expect(host.localName).toEqual('imp-loader')
  const root = inner(host, '.root')
  expect(root.getAttribute('role')).toEqual('status')
  expect(root.getAttribute('class')).toContain('size-md')
  expect(root.getAttribute('class')).toContain('color-primary')
  expect(inner(host, '.spinner').getAttribute('aria-hidden')).toEqual('true')
  expect(inner(host, '.words').textContent).toEqual('Loading')
  expect(root.hasAttribute('aria-valuenow')).toEqual(false)
})

test('a live label updates the words in place, and size and color are classes', () => {
  let label
  const host = mounted(stateHost((self) => {
    label = initState(self, 'loader.label', 'Loading')
    return loader({ label, size: 'lg', color: 'teal' })
  }))
  expect(nested(host, '.words').textContent).toEqual('Loading')
  label.set('Still loading')
  expect(nested(host, '.words').textContent).toEqual('Still loading')
  expect(nested(host, '.root').getAttribute('class')).toContain('size-lg')
  expect(nested(host, '.root').getAttribute('class')).toContain('color-teal')
})

test('loader warns about a missing label, a bad size and an unknown prop', () => {
  const warn = warnings()
  const host = mounted(loader({ size: 'xl', shape: 'ring' }))
  expect(warned(warn, "pass a 'label'")).toBeTruthy()
  expect(warned(warn, "'size' must be one of")).toBeTruthy()
  expect(warned(warn, "unknown prop 'shape'")).toBeTruthy()
  expect(inner(host, '.root').getAttribute('class')).toContain('size-md')
})

test('loader with a client name shows itself only while that client has calls in flight', async () => {
  const answer = deferred()
  spy(globalThis, 'fetch', () => answer.promise)
  let api
  const host = mounted(stateHost((self) => {
    api = initHttpClient(self, 'test.api', { baseUrl: 'https://api.test' })
    return loader({ label: 'Saving', client: 'test.api' })
  }))
  const root = nested(host, '.root')
  expect(root.hidden).toEqual(true)
  const call = api.get('/users')
  await settled()
  expect(root.hidden).toEqual(false)
  answer.answer(jsonResponse({}))
  await call
  expect(root.hidden).toEqual(true)
})

test('loader takes a client object', async () => {
  const answer = deferred()
  spy(globalThis, 'fetch', () => answer.promise)
  const api = createHttpClient('test.shared', { baseUrl: 'https://api.test' })
  const host = mounted(loader({ label: 'Saving', client: api }))
  expect(inner(host, '.root').hidden).toEqual(true)
  const call = api.get('/users')
  await settled()
  expect(inner(host, '.root').hidden).toEqual(false)
  answer.answer(jsonResponse({}))
  await call
  expect(inner(host, '.root').hidden).toEqual(true)
  api.close()
})

test('loader stays hidden and reports a client that nothing provides', () => {
  const error = spy(console, 'error', () => {})
  const host = mounted(loader({ label: 'Saving', client: 'missing.api' }))
  expect(inner(host, '.root').hidden).toEqual(true)
  expect(error.calls.some(([first]) => String(first).includes("no http client 'missing.api'")))
    .toBeTruthy()
})
