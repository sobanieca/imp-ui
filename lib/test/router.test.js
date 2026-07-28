import { component, mount } from 'imp'
import { div, span } from 'imp/html'
import { initState, useState } from 'imp/state'
import { area, navigate, router, url, useRoute } from 'imp/router'
import { beforeEach, expect, spy, test } from 'imp/test'
import { renderedText, settled } from './shadow.js'

beforeEach(() => {
  document.body.replaceChildren()
  globalThis.__IMP_ENV__ = {}
})

const mountRouter = (options) => mount(document.body, div(router(options)))

test('the router renders the screen whose pattern matches the path', () => {
  navigate('/r-home')
  mountRouter({ routes: { '/r-home': () => div('home page') } })
  expect(renderedText(document.body)).toEqual('home page')
})

test('a :param segment is decoded and passed to the factory', () => {
  navigate('/r-todos/a%20b')
  mountRouter({ routes: { '/r-todos/:id': ({ params }) => div(`todo ${params.id}`) } })
  expect(renderedText(document.body)).toEqual('todo a b')
})

test('the query string is parsed and passed to the factory', () => {
  navigate('/r-search?q=hello')
  mountRouter({ routes: { '/r-search': ({ query }) => div(`q=${query.q ?? ''}`) } })
  expect(renderedText(document.body)).toEqual('q=hello')
})

test('a query-only navigation keeps the screen mounted and updates useRoute', () => {
  let mounts = 0
  const screen = component('r-keep', {
    onMount: () => {
      mounts++
      return span(useRoute().text((current) => current.query.a ?? ''))
    },
  })
  navigate('/r-keep?a=1')
  mountRouter({ routes: { '/r-keep': () => screen() } })
  expect(mounts).toEqual(1)
  expect(renderedText(document.body)).toEqual('1')
  navigate('/r-keep?a=2')
  expect(mounts).toEqual(1)
  expect(renderedText(document.body)).toEqual('2')
})

test('navigating to a different screen swaps it and unmounts the previous one', async () => {
  let unmounts = 0
  const page = component('r-leaver', {
    onMount: () => div('leaving page'),
    onUnmount: () => unmounts++,
  })
  navigate('/r-first')
  mountRouter({
    routes: {
      '/r-first': () => page(),
      '/r-second': () => div('second page'),
    },
  })
  expect(renderedText(document.body)).toEqual('leaving page')
  navigate('/r-second')
  await settled()
  expect(renderedText(document.body)).toEqual('second page')
  expect(unmounts).toEqual(1)
})

test("a screen's scoped state is released when the screen is left", async () => {
  const holder = component('r-stateful', {
    onMount: () => {
      initState('rroute.value', 'kept')
      return div('holding')
    },
  })
  const reader = component('r-reader', {
    onMount: () => {
      let message = 'resolved'
      try {
        useState('rroute.value')
      } catch (error) {
        message = error.message
      }
      return div(message)
    },
  })
  navigate('/r-holds')
  mountRouter({
    routes: {
      '/r-holds': () => holder(),
      '/r-check': () => reader(),
    },
  })
  navigate('/r-check')
  await settled()
  expect(renderedText(document.body)).toContain("no state 'rroute.value'")
})

test("a screen's own onUnmount runs its cleanup when the router leaves it", async () => {
  let cleaned = 0
  const screen = component('r-cleanup', {
    onMount: () => div('touched a global'),
    onUnmount: () => cleaned++,
  })
  navigate('/r-clean-a')
  mountRouter({
    routes: {
      '/r-clean-a': () => screen(),
      '/r-clean-b': () => div('b'),
    },
  })
  expect(cleaned).toEqual(0)
  navigate('/r-clean-b')
  await settled()
  expect(cleaned).toEqual(1)
})

test('a screen factory that returns a Promise is rejected', async () => {
  const errors = spy(console, 'error', () => {})
  navigate('/r-async-screen')
  mountRouter({
    routes: { '/r-async-screen': () => Promise.resolve(div('too late')) },
    onError: (error) => div(error.message),
  })
  await settled()
  expect(renderedText(document.body)).toContain('a screen renders immediately')
  expect(errors.calls.length).toEqual(1)
})

test('router({ placeholder }) shows a loader while an area downloads', async () => {
  navigate('/r-slow-area')
  mountRouter({
    routes: {
      '/r-slow-area': area(() =>
        Promise.resolve({ default: area({ routes: { '/': () => div('arrived') } }) })
      ),
    },
    placeholder: () => div('loading…'),
  })
  expect(renderedText(document.body)).toEqual('loading…')
  await settled()
  expect(renderedText(document.body)).toEqual('arrived')
})

test('a failed area download logs and renders nothing', async () => {
  const errors = spy(console, 'error', () => {})
  navigate('/r-broken-area')
  mountRouter({
    routes: { '/r-broken-area': area(() => Promise.reject(new Error('chunk failed'))) },
  })
  await settled()
  expect(renderedText(document.body)).toEqual('')
  expect(errors.calls.length).toEqual(1)
})

test('router({ onError }) renders a fallback when a screen fails to render', async () => {
  const errors = spy(console, 'error', () => {})
  const broken = component('r-broken-screen', {
    onMount: () => {
      throw new Error('boom')
    },
  })
  navigate('/r-onerror')
  mountRouter({
    routes: { '/r-onerror': () => broken() },
    onError: (error) => div(`failed: ${error.message}`),
  })
  await settled()
  expect(renderedText(document.body)).toEqual('failed: boom')
  expect(errors.calls.length).toBeGreaterThan(0)
})

test('router({ onNotFound }) renders a single-place not-found page for unmatched paths', () => {
  navigate('/r-nowhere')
  mountRouter({
    routes: { '/r-known-page': () => div('known') },
    onNotFound: () => div('nothing here'),
  })
  expect(renderedText(document.body)).toEqual('nothing here')
})

test('an area matches its prefix and renders a sub-screen from its own table', async () => {
  navigate('/r-admin/users')
  mountRouter({
    routes: {
      '/': () => div('app home'),
      '/r-admin': area(() =>
        Promise.resolve({
          default: area({
            routes: {
              '/': () => div('admin home'),
              '/users': () => div('admin users'),
            },
          }),
        })
      ),
    },
  })
  await settled()
  expect(renderedText(document.body)).toEqual('admin users')
})

test('an area entry point (the prefix itself) renders the sub-table root', async () => {
  navigate('/r-shop')
  mountRouter({
    routes: {
      '/r-shop': area(() =>
        Promise.resolve({ default: area({ routes: { '/': () => div('shop home') } }) })
      ),
    },
  })
  await settled()
  expect(renderedText(document.body)).toEqual('shop home')
})

test('an area loads its module and matches the tail against its own routes table', async () => {
  navigate('/r-lazy-area/reports')
  mountRouter({
    routes: {
      '/r-lazy-area': area(() =>
        Promise.resolve({ default: area({ routes: { '/reports': () => div('lazy reports') } }) })
      ),
    },
  })
  await settled()
  expect(renderedText(document.body)).toEqual('lazy reports')
})

test('a prefix param is merged into the sub-screen params', async () => {
  navigate('/r-org/42/team')
  mountRouter({
    routes: {
      '/r-org/:orgId': area(() =>
        Promise.resolve({
          default: area({
            routes: {
              '/team': ({ params }) => div(`org ${params.orgId} team`),
            },
          }),
        })
      ),
    },
  })
  await settled()
  expect(renderedText(document.body)).toEqual('org 42 team')
})

test('navigating within an area keeps it mounted and swaps only the sub-screen', async () => {
  let loads = 0
  navigate('/r-keep-area/one')
  mountRouter({
    routes: {
      '/r-keep-area': area(() => {
        loads++
        return Promise.resolve({
          default: area({
            routes: {
              '/one': () => div('sub one'),
              '/two': () => div('sub two'),
            },
          }),
        })
      }),
    },
  })
  await settled()
  expect(renderedText(document.body)).toEqual('sub one')
  expect(loads).toEqual(1)
  navigate('/r-keep-area/two')
  await settled()
  expect(renderedText(document.body)).toEqual('sub two')
  expect(loads).toEqual(1)
})

test('an area({ root }) wraps the section, and router() inside it renders the tail', async () => {
  const shell = component('r-area-root', {
    onMount: () => div(span('shell'), router()),
  })
  navigate('/r-rooted/users')
  mountRouter({
    routes: {
      '/r-rooted': area(() =>
        Promise.resolve({
          default: area({
            root: () => shell(),
            routes: {
              '/': () => div('rooted home'),
              '/users': () => div('rooted users'),
            },
          }),
        })
      ),
    },
  })
  await settled()
  expect(renderedText(document.body)).toEqual('shellrooted users')
  navigate('/r-rooted')
  await settled()
  expect(renderedText(document.body)).toEqual('shellrooted home')
})

test("an area's root stays mounted while its screens swap, and provides to all of them", async () => {
  let mounts = 0
  const shell = component('r-area-shell', {
    onMount: () => {
      mounts++
      initState('rarea.section', 'section value')
      return div(router())
    },
  })
  const reader = component('r-area-reader', {
    onMount: () => div(useState('rarea.section').text((current) => current)),
  })
  navigate('/r-shell/one')
  mountRouter({
    routes: {
      '/r-shell': area(() =>
        Promise.resolve({
          default: area({
            root: () => shell(),
            routes: {
              '/one': () => reader(),
              '/two': () => reader(),
            },
          }),
        })
      ),
    },
  })
  await settled()
  expect(renderedText(document.body)).toEqual('section value')
  expect(mounts).toEqual(1)
  navigate('/r-shell/two')
  await settled()
  expect(renderedText(document.body)).toEqual('section value')
  expect(mounts).toEqual(1)
})

test("a prefix param reaches the area's root and its screens", async () => {
  const shell = component('r-area-param', {
    onMount: (_instance, context) => div(span(`org ${context.params.orgId} `), router()),
  })
  navigate('/r-rooted-org/42/team')
  mountRouter({
    routes: {
      '/r-rooted-org/:orgId': area(() =>
        Promise.resolve({
          default: area({
            root: (context) => shell(context),
            routes: {
              '/team': ({ params }) => div(`team of ${params.orgId}`),
            },
          }),
        })
      ),
    },
  })
  await settled()
  expect(renderedText(document.body)).toEqual('org 42 team of 42')
})

test("an area's root inherits the router's options and can override them", async () => {
  const shell = component('r-area-options', {
    onMount: () => div(router()),
  })
  const overriding = component('r-area-own-404', {
    onMount: () => div(router({ onNotFound: () => div('section 404') })),
  })
  const sectionArea = (root) =>
    area(() => Promise.resolve({ default: area({ root, routes: { '/': () => div('home') } }) }))
  navigate('/r-inherit/missing')
  mountRouter({
    routes: {
      '/r-inherit': sectionArea(() => shell()),
      '/r-override': sectionArea(() => overriding()),
    },
    onNotFound: () => div('app 404'),
  })
  await settled()
  expect(renderedText(document.body)).toEqual('app 404')
  navigate('/r-override/missing')
  await settled()
  expect(renderedText(document.body)).toEqual('section 404')
})

test('area validates its root, and router() outside an area needs a table', () => {
  expect(() => area({ root: 'nope', routes: { '/': () => div() } })).toThrow(
    'root must be a function',
  )
  expect(() => router()).toThrow('area({ root })')
})

test('router options are per instance, not module state', () => {
  navigate('/r-multi')
  mount(
    document.body,
    div(
      router({
        routes: { '/r-multi': () => div('first match') },
        onNotFound: () => div('first miss'),
      }),
      router({
        routes: { '/r-other': () => div('second match') },
        onNotFound: () => div('second miss'),
      }),
    ),
  )
  expect(renderedText(document.body)).toEqual('first matchsecond miss')
})

test('useRoute exposes the current path and reacts to navigation', () => {
  const crumb = component('r-crumb', {
    onMount: () => span(useRoute().text((current) => current.path)),
  })
  navigate('/r-one')
  mountRouter({
    routes: {
      '/r-one': () => crumb(),
      '/r-two': () => crumb(),
    },
  })
  expect(renderedText(document.body)).toEqual('/r-one')
  navigate('/r-two')
  expect(renderedText(document.body)).toEqual('/r-two')
})

test('IMP_BASEPATH prefixes navigate and strips the base when matching', () => {
  globalThis.__IMP_ENV__ = { IMP_BASEPATH: '/app' }
  navigate('/base-home')
  expect(globalThis.location.pathname).toEqual('/app/base-home')
  mountRouter({ routes: { '/base-home': () => div('based home') } })
  expect(renderedText(document.body)).toEqual('based home')
})

test('url() prefixes app-root paths with the base and leaves the rest untouched', () => {
  expect(url('/todos')).toEqual('/todos')
  globalThis.__IMP_ENV__ = { IMP_BASEPATH: '/app' }
  expect(url('/todos')).toEqual('/app/todos')
  expect(url('todos')).toEqual('todos')
  expect(url('https://example.com/todos')).toEqual('https://example.com/todos')
})

test('routes validates its table', () => {
  expect(() => area({ routes: { 'r-bad': () => div() } })).toThrow(
    "must be a path pattern starting with '/'",
  )
  expect(() => area({ routes: { '/r-bad': 42 } })).toThrow(
    'screen factory or an area',
  )
})

test('a plain-object nested table is rejected — an area must be loaded on demand', () => {
  expect(() => area({ routes: { '/r-nested': { '/': () => div() } } })).toThrow(
    'screen factory or an area',
  )
})

test('area rejects anything that is neither a loader nor a definition', () => {
  expect(() => area('nope')).toThrow('area() takes either a loader')
  expect(() => area({})).toThrow('area() takes either a loader')
})

test('an area definition placed straight in a table is rejected with the fix', () => {
  expect(() => area({ routes: { '/r-inline': area({ routes: { '/': () => div() } }) } }))
    .toThrow('loaded on demand')
})

test('router validates its options', () => {
  expect(() => router({})).toThrow("'routes' is required")
  expect(() => router({ routes: {}, placeholder: 'nope' })).toThrow(
    'placeholder must be a function',
  )
  expect(() => router({ routes: {}, onError: 'nope' })).toThrow('onError must be a function')
  expect(() => router({ routes: {}, onNotFound: 'nope' })).toThrow('onNotFound must be a function')
})
