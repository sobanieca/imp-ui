import { component, mount } from 'imp'
import { div, span } from 'imp/html'
import { area, guard, navigate, route, router, url, useRoute, wait } from 'imp/router'
import { beforeEach, expect, spy, test } from 'imp/test'
import { renderedText, settled } from './shadow.js'
import { initState, useState } from 'imp/state'

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
    setup: () => {
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
    setup: () => div('leaving page'),
    onRemove: () => unmounts++,
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
    setup: (self) => {
      initState(self, 'rroute.value', 'kept')
      return div('holding')
    },
  })
  const reader = component('r-reader', {
    setup: (self) => {
      let message = 'resolved'
      try {
        useState(self, 'rroute.value')
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

test("a screen's own onRemove runs its cleanup when the router leaves it", async () => {
  let cleaned = 0
  const screen = component('r-cleanup', {
    setup: () => div('touched a global'),
    onRemove: () => cleaned++,
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
    error: (_self, error) => div(error.message),
  })
  await settled()
  expect(renderedText(document.body)).toContain('a screen renders immediately')
  expect(errors.calls.length).toEqual(1)
})

test('router({ loading }) shows a loader while an area downloads', async () => {
  navigate('/r-slow-area')
  mountRouter({
    routes: {
      '/r-slow-area': area(() =>
        Promise.resolve({ default: area({ routes: { '/': () => div('arrived') } }) })
      ),
    },
    loading: () => div('loading...'),
  })
  expect(renderedText(document.body)).toEqual('loading...')
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

test('router({ error }) renders an error view when a screen fails to render', async () => {
  const errors = spy(console, 'error', () => {})
  const broken = component('r-broken-screen', {
    setup: () => {
      throw new Error('boom')
    },
  })
  navigate('/r-onerror')
  mountRouter({
    routes: { '/r-onerror': () => broken() },
    error: (_self, error) => div(`failed: ${error.message}`),
  })
  await settled()
  expect(renderedText(document.body)).toEqual('failed: boom')
  expect(errors.calls.length).toBeGreaterThan(0)
})

test('router({ notFound }) renders a single-place not-found page for unmatched paths', () => {
  navigate('/r-nowhere')
  mountRouter({
    routes: { '/r-known-page': () => div('known') },
    notFound: () => div('nothing here'),
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
    setup: () => div(span('shell'), router()),
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
    setup: (self) => {
      mounts++
      initState(self, 'rarea.section', 'section value')
      return div(router())
    },
  })
  const reader = component('r-area-reader', {
    setup: (self) => div(useState(self, 'rarea.section').text((current) => current)),
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
    setup: (_self, context) => div(span(`org ${context.params.orgId} `), router()),
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
    setup: () => div(router()),
  })
  const overriding = component('r-area-own-404', {
    setup: () => div(router({ notFound: () => div('section 404') })),
  })
  const sectionArea = (root) =>
    area(() => Promise.resolve({ default: area({ root, routes: { '/': () => div('home') } }) }))
  navigate('/r-inherit/missing')
  mountRouter({
    routes: {
      '/r-inherit': sectionArea(() => shell()),
      '/r-override': sectionArea(() => overriding()),
    },
    notFound: () => div('app 404'),
  })
  await settled()
  expect(renderedText(document.body)).toEqual('app 404')
  navigate('/r-override/missing')
  await settled()
  expect(renderedText(document.body)).toEqual('section 404')
})

test('area validates its root, and router() outside an area fails at mount', async () => {
  expect(() => area({ root: 'nope', routes: { '/': () => div() } })).toThrow(
    'root must be a function',
  )
  const errors = spy(console, 'error', () => {})
  mount(document.body, div(router()))
  await settled()
  expect(errors.calls.length).toEqual(1)
  expect(String(errors.calls[0][1])).toContain('area({ root })')
})

test('router() with no table resolves its area after an await in the root', async () => {
  const shell = component('r-area-late-root', {
    setup: async () => {
      await Promise.resolve()
      return div(span('late shell '), router())
    },
  })
  navigate('/r-late/users')
  mountRouter({
    routes: {
      '/r-late': area(() =>
        Promise.resolve({
          default: area({
            root: () => shell(),
            routes: { '/users': () => div('late users') },
          }),
        })
      ),
    },
  })
  await settled()
  expect(renderedText(document.body)).toEqual('late shell late users')
})

test("the router's error view receives the self of the route host", async () => {
  spy(console, 'error', () => {})
  const broken = component('r-broken-with-self', {
    setup: () => {
      throw new Error('boom')
    },
  })
  const owner = component('r-error-owner', {
    setup: (self) => {
      initState(self, 'rerr.label', 'failed')
      return div(router({
        routes: { '/r-error-self': () => broken() },
        error: (self, error) => div(useState(self, 'rerr.label').text(), ': ', error.message),
      }))
    },
  })
  navigate('/r-error-self')
  mount(document.body, owner())
  await settled()
  expect(renderedText(document.body)).toEqual('failed: boom')
})

test('router options are per self, not module state', () => {
  navigate('/r-multi')
  mount(
    document.body,
    div(
      router({
        routes: { '/r-multi': () => div('first match') },
        notFound: () => div('first miss'),
      }),
      router({
        routes: { '/r-other': () => div('second match') },
        notFound: () => div('second miss'),
      }),
    ),
  )
  expect(renderedText(document.body)).toEqual('first matchsecond miss')
})

test('useRoute exposes the current path and reacts to navigation', () => {
  const crumb = component('r-crumb', {
    setup: () => span(useRoute().text((current) => current.path)),
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

test('a plain-object nested table is rejected - an area must be loaded on demand', () => {
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
  expect(() => router({ routes: {}, loading: 'nope' })).toThrow('loading must be a function')
  expect(() => router({ routes: {}, error: 'nope' })).toThrow('error must be a function')
  expect(() => router({ routes: {}, notFound: 'nope' })).toThrow('notFound must be a function')
})

const MAX_GUARD_REDIRECTS = 10

let session = null

const guardHost = component('r-guard-host', {
  setup: (self, options, initial) => {
    session = initial === undefined
      ? initState(self, 'rguard.session')
      : initState(self, 'rguard.session', initial)
    return div(router(options))
  },
})

const mountGuarded = (options, initial) => mount(document.body, guardHost(options, initial))

const signedIn = guard(
  ['rguard.session'],
  (current) => current === undefined ? wait : Boolean(current) || '/r-login',
)

const adminOnly = guard(['rguard.session'], (current) => {
  if (current === undefined) return wait
  if (!current) return '/r-login'
  return current.role === 'admin' || '/r-forbidden'
})

test('a guard that can decide renders the screen in the same tick', () => {
  navigate('/r-guard-ok')
  mountGuarded({
    routes: { '/r-guard-ok': route({ guard: signedIn, screen: () => div('secret') }) },
  }, { name: 'ada' })
  expect(renderedText(document.body)).toEqual('secret')
})

test('a guard returning wait shows the loading content until the state settles', async () => {
  navigate('/r-guard-wait')
  mountGuarded({
    routes: { '/r-guard-wait': route({ guard: signedIn, screen: () => div('dashboard') }) },
    loading: () => div('loading'),
  })
  expect(renderedText(document.body)).toEqual('loading')
  session.set({ name: 'ada' })
  await settled()
  expect(renderedText(document.body)).toEqual('dashboard')
})

test('a guard redirects to the path it returns, replacing the denied entry', async () => {
  navigate('/r-guard-admin')
  mountGuarded({
    routes: {
      '/r-guard-admin': route({ guard: adminOnly, screen: () => div('admin area') }),
      '/r-forbidden': () => div('forbidden'),
    },
  }, { name: 'ada', role: 'user' })
  await settled()
  expect(renderedText(document.body)).toEqual('forbidden')
  expect(globalThis.location.pathname).toEqual('/r-forbidden')
})

test('a guard waiting first, then denying, redirects once the state settles', async () => {
  navigate('/r-guard-late')
  mountGuarded({
    routes: {
      '/r-guard-late': route({ guard: adminOnly, screen: () => div('admin area') }),
      '/r-login': () => div('login'),
    },
    loading: () => div('loading'),
  })
  expect(renderedText(document.body)).toEqual('loading')
  session.set(null)
  await settled()
  expect(renderedText(document.body)).toEqual('login')
})

test('a guard re-runs when its state changes and leaves a mounted screen', async () => {
  navigate('/r-guard-live')
  mountGuarded({
    routes: {
      '/r-guard-live': route({ guard: signedIn, screen: () => div('inbox') }),
      '/r-login': () => div('login'),
    },
  }, { name: 'ada' })
  expect(renderedText(document.body)).toEqual('inbox')
  session.set(null)
  await settled()
  expect(renderedText(document.body)).toEqual('login')
})

test('a guard returning false renders the not-found page', async () => {
  const hidden = guard(
    ['rguard.session'],
    (current) => current === undefined ? wait : current.role === 'admin',
  )
  navigate('/r-guard-hidden')
  mountGuarded({
    routes: { '/r-guard-hidden': route({ guard: hidden, screen: () => div('admin area') }) },
    notFound: () => div('nothing here'),
  }, { name: 'ada', role: 'user' })
  await settled()
  expect(renderedText(document.body)).toEqual('nothing here')
})

test('one guard covers one route - its siblings stay open', async () => {
  navigate('/r-guard-one')
  mountGuarded({
    routes: {
      '/r-guard-one': route({ guard: signedIn, screen: () => div('protected') }),
      '/r-guard-open': () => div('open'),
      '/r-login': () => div('login'),
    },
  }, null)
  await settled()
  expect(renderedText(document.body)).toEqual('login')
  navigate('/r-guard-open')
  await settled()
  expect(renderedText(document.body)).toEqual('open')
})

test('a guard on an area entry decides before the area downloads', async () => {
  let loads = 0
  navigate('/r-guard-area/users')
  mountGuarded({
    routes: {
      '/r-guard-area': route({
        guard: adminOnly,
        screen: area(() => {
          loads++
          return Promise.resolve({
            default: area({ routes: { '/users': () => div('admin users') } }),
          })
        }),
      }),
      '/r-forbidden': () => div('forbidden'),
    },
  }, { name: 'ada', role: 'user' })
  await settled()
  expect(renderedText(document.body)).toEqual('forbidden')
  expect(loads).toEqual(0)
})

test("a guard on the entry covers the area's root and every screen in it", async () => {
  let roots = 0
  const shell = component('r-guard-shell', {
    setup: () => {
      roots++
      return div(span('shell'), router())
    },
  })
  navigate('/r-guard-section/reports')
  mountGuarded({
    routes: {
      '/r-guard-section': route({
        guard: adminOnly,
        screen: area(() =>
          Promise.resolve({
            default: area({ root: () => shell(), routes: { '/reports': () => div('reports') } }),
          })
        ),
      }),
      '/r-forbidden': () => div('forbidden'),
    },
  }, { name: 'ada', role: 'user' })
  await settled()
  expect(renderedText(document.body)).toEqual('forbidden')
  expect(roots).toEqual(0)
})

test('a guarded area keeps re-checking while the visitor is inside it', async () => {
  navigate('/r-guard-inside/reports')
  mountGuarded({
    routes: {
      '/r-guard-inside': route({
        guard: signedIn,
        screen: area(() =>
          Promise.resolve({ default: area({ routes: { '/reports': () => div('reports') } }) })
        ),
      }),
      '/r-login': () => div('login'),
    },
  }, { name: 'ada' })
  await settled()
  expect(renderedText(document.body)).toEqual('reports')
  session.set(null)
  await settled()
  expect(renderedText(document.body)).toEqual('login')
})

test('a guard whose state is not provided fails the route instead of allowing it', async () => {
  const errors = spy(console, 'error', () => {})
  const missing = guard(['rguard.absent'], () => true)
  navigate('/r-guard-missing')
  mountGuarded({
    routes: { '/r-guard-missing': route({ guard: missing, screen: () => div('secret') }) },
    error: (_self, error) => div(error.message),
  }, { name: 'ada' })
  await settled()
  expect(renderedText(document.body)).toContain("no state 'rguard.absent'")
  expect(errors.calls.length).toBeGreaterThan(0)
})

test('a guard returning something else fails the route with a clear error', async () => {
  const errors = spy(console, 'error', () => {})
  const confused = guard(['rguard.session'], () => 'login')
  navigate('/r-guard-bad')
  mountGuarded({
    routes: { '/r-guard-bad': route({ guard: confused, screen: () => div('secret') }) },
    error: (_self, error) => div(error.message),
  }, { name: 'ada' })
  await settled()
  expect(renderedText(document.body)).toContain('must return true to allow')
  expect(errors.calls.length).toBeGreaterThan(0)
})

test('guards that redirect in a cycle fail with a clear error', async () => {
  const errors = spy(console, 'error', () => {})
  const toB = guard(['rguard.session'], () => '/r-loop-b')
  const toA = guard(['rguard.session'], () => '/r-loop-a')
  navigate('/r-loop-a')
  mountGuarded({
    routes: {
      '/r-loop-a': route({ guard: toB, screen: () => div('a') }),
      '/r-loop-b': route({ guard: toA, screen: () => div('b') }),
    },
    error: (_self, error) => div(error.message),
  }, { name: 'ada' })
  await settled()
  expect(renderedText(document.body)).toContain('redirecting in a cycle')
  expect(errors.calls.length).toBeGreaterThan(0)
})

test('redirects that reach a screen do not accumulate toward the cycle limit', async () => {
  const errors = spy(console, 'error', () => {})
  navigate('/r-hop-guarded')
  mountGuarded({
    routes: {
      '/r-hop-guarded': route({ guard: adminOnly, screen: () => div('admin area') }),
      '/r-forbidden': () => div('forbidden'),
    },
  }, { name: 'ada', role: 'user' })
  for (let attempt = 0; attempt < MAX_GUARD_REDIRECTS + 2; attempt++) {
    navigate('/r-hop-guarded')
    await settled()
    expect(renderedText(document.body)).toEqual('forbidden')
  }
  expect(errors.calls.length).toEqual(0)
})

test('guard, route, router and area validate their guard options', () => {
  expect(() => guard('rguard.session', () => true)).toThrow('non-empty array of state names')
  expect(() => guard(['session'], () => true)).toThrow('must include a namespace')
  expect(() => guard(['rguard.session'], 'nope')).toThrow("'check' must be a function")
  expect(() => route({ guard: signedIn })).toThrow('route({ guard, screen })')
  expect(() => route({ guard: 'nope', screen: () => div() })).toThrow('must be one guard')
  expect(() => route({ guard: [signedIn, adminOnly], screen: () => div() })).toThrow(
    'exactly one guard',
  )
  expect(() => router({ routes: {}, guard: signedIn })).toThrow('route({ guard, screen })')
  expect(() => area({ routes: { '/': () => div() }, guard: signedIn })).toThrow(
    'guard the entry pointing at this area',
  )
})
