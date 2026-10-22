import { appMap, component, mount } from 'imp'
import { div, span } from 'imp/html'
import { link } from 'imp/std'
import {
  area,
  beforeLeave,
  crumbLabel,
  guard,
  navigate,
  redirect,
  router,
  safeNext,
  screenRegion,
  url,
  useRoute,
  wait,
} from 'imp/router'
import { beforeEach, expect, spy, test } from 'imp/test'
import { nextFrame, renderedText, settled } from './shadow.js'
import { initState, useState } from 'imp/state'
import { mapNav } from '../src/app-map.js'

beforeEach(() => {
  document.body.replaceChildren()
  globalThis.__IMP_ENV__ = {}
})

const demo = () =>
  appMap({
    home: { path: '/', description: 'The start' },
    todos: {
      description: 'Every todo',
      $id: { edit: {} },
    },
    search: {},
    reports: { weekly: {}, monthly: {} },
    admin: { users: {}, billing: {} },
    login: { nav: false },
  })

const todoOptions = [
  { value: '1', label: 'First' },
  { value: '2', label: 'Second' },
]

const mountRouter = (options) => mount(document.body, div(router(options)))

test('appMap derives the path and the label of a node from its name', () => {
  const app = appMap({ admin: { createApiKey: {}, $projectId: { buildLogs: {} } } })
  expect(String(app.admin)).toEqual('/admin')
  expect(String(app.admin.createApiKey)).toEqual('/admin/create-api-key')
  expect(String(app.admin.$projectId)).toEqual('/admin/:projectId')
  expect(String(app.admin.$projectId.buildLogs)).toEqual('/admin/:projectId/build-logs')
  expect(app.admin.createApiKey.spec.label).toEqual('Create api key')
  expect(app.admin.$projectId.spec.label).toEqual('Project id')
  expect(app.admin.$projectId.spec.param).toEqual(true)
})

test('loading is asked for only when a route can wait', () => {
  const app = demo()
  const warn = spy(console, 'warn', () => {})
  navigate('/search')
  mountRouter({
    map: app,
    screens: { [app.search]: () => div('search') },
    loading: () => div('loading...'),
  })
  expect(renderedText(document.body)).toEqual('search')
  expect(warn.calls.some(([line]) => String(line).includes('loading is set'))).toEqual(false)
})

test('a handle stringifies to its pattern, so it keys an object', () => {
  const app = demo()
  const keyed = { [app.todos.$id.edit]: 'bound' }
  expect(keyed['/todos/:id/edit']).toEqual('bound')
  expect(`${app.home}`).toEqual('/')
})

test('handle.href fills the params through url()', () => {
  const app = demo()
  expect(app.todos.$id.edit.href({ id: 'a b' })).toEqual('/todos/a%20b/edit')
  expect(app.search.href()).toEqual('/search')
  globalThis.__IMP_ENV__ = { IMP_BASEPATH: '/app' }
  expect(app.search.href()).toEqual('/app/search')
  expect(() => app.todos.$id.href({})).toThrow("app.todos.$id.href() needs a value for 'id'")
})

test('handle.href fills a missing param from the current route', () => {
  const app = demo()
  navigate('/todos/42')
  expect(app.todos.$id.edit.href()).toEqual('/todos/42/edit')
  expect(app.todos.$id.edit.href({ id: '7' })).toEqual('/todos/7/edit')
  navigate('/search')
  expect(() => app.todos.$id.href()).toThrow("needs a value for 'id'")
})

test('a string node is its description, and a map grafts as a part of another map', () => {
  const admin = appMap(
    { access: 'admin', description: 'Back office' },
    {
      users: 'Everyone with a login',
      createApiKey: {},
    },
  )
  expect(String(admin.users)).toEqual('/users')
  const app = appMap({ home: { path: '/' }, admin, docs: 'Guides and references' })
  expect(String(app.admin)).toEqual('/admin')
  expect(String(app.admin.users)).toEqual('/admin/users')
  expect(String(admin.users)).toEqual('/admin/users')
  expect(app.admin.users === admin.users).toEqual(true)
  expect(admin.users.spec.pattern).toEqual('/admin/users')
  expect(admin.users.spec.description).toEqual('Everyone with a login')
  expect(app.admin.spec.access).toEqual('admin')
  expect(app.admin.spec.description).toEqual('Back office')
  expect(app.docs.spec.description).toEqual('Guides and references')
  expect(app.admin.spec.children).toEqual([admin.users, admin.createApiKey])
  expect(() => appMap({ again: admin })).toThrow('already a part of another map')
  expect(() => router({ map: admin })).toThrow('a part of another map')
  expect(() => router({ map: appMap({ access: 'x' }, {}) })).toThrow('a part of another map')
  expect(() => appMap({ a: appMap({ b: { path: '/' } }) })).toThrow("path '/' is the index")
  expect(() => appMap({ path: '/' }, {})).toThrow('cannot be the index')
  expect(() => appMap({ title: 'x' }, {})).toThrow("'title' is not a node prop")
})

test('the spec of a handle is frozen node data with its children', () => {
  const app = demo()
  expect(Object.isFrozen(app.admin.spec)).toEqual(true)
  expect(app.admin.spec.access).toEqual(undefined)
  expect(appMap({ admin: { access: 'admin' } }).admin.spec.access).toEqual('admin')
  expect(app.admin.spec.children.map((child) => child.spec.name)).toEqual(['users', 'billing'])
  expect(app.todos.$id.spec.pattern).toEqual('/todos/:id')
})

test('appMap rejects a value that is neither a node nor a node prop', () => {
  expect(() => appMap({ admin: { lable: 3 } })).toThrow(
    "app.admin: 'lable' is neither a node (a description, an object, or a map) nor a node prop",
  )
  expect(String(appMap({ admin: { lable: 'Admin' } }).admin.lable)).toEqual('/admin/lable')
  expect(() => appMap({ admin: true })).toThrow("'admin' is true - write a description string")
  expect(() => appMap({ 'create-key': {} })).toThrow("'create-key' is not a valid node name")
  expect(() => appMap({ access: 'x' })).toThrow("'access' is a node prop, and the root holds nodes")
  expect(() => appMap({ spec: { a: {} } })).toThrow("'spec' cannot name a node")
})

test('appMap validates every node prop', () => {
  expect(() => appMap({ a: { path: '/' }, b: { path: '/' } })).toThrow('the app has one index')
  expect(() => appMap({ a: { b: { path: '/' } } })).toThrow("path '/' is the index of the app")
  expect(() => appMap({ a: { path: 'x/y' } })).toThrow("'path' is one segment")
  expect(() => appMap({ a: { nav: true } })).toThrow("'nav' takes false only")
  expect(() => appMap({ $a: { nav: false } })).toThrow('a param node is never a row')
  expect(() => appMap({ a: { group: '' } })).toThrow("'group' must be a string")
  expect(() => appMap({ a: { label: 3 } })).toThrow("'label' must be a string or a function")
  expect(() => appMap({ a: { description: 3 } })).toThrow("'description' must be a string")
  expect(() => appMap({ x: 1 }, { a: {} })).toThrow("'x' is not a node prop")
})

test('the router renders the screen bound to the matched node', () => {
  const app = demo()
  navigate('/search')
  mountRouter({ map: app, screens: { [app.search]: () => div('search page') } })
  expect(renderedText(document.body)).toEqual('search page')
})

test('the index node answers the root path', () => {
  const app = demo()
  navigate('/')
  mountRouter({ map: app, screens: { [app.home]: () => div('home page') } })
  expect(renderedText(document.body)).toEqual('home page')
})

test('a param is decoded and passed to the factory with the node', () => {
  const app = demo()
  navigate('/todos/a%20b')
  mountRouter({
    map: app,
    screens: { [app.todos.$id]: ({ params, node }) => div(`todo ${params.id} at ${node}`) },
  })
  expect(renderedText(document.body)).toEqual('todo a b at /todos/:id')
})

test('the query string is parsed and passed to the factory', () => {
  const app = demo()
  navigate('/search?q=hello')
  mountRouter({ map: app, screens: { [app.search]: ({ query }) => div(`q=${query.q ?? ''}`) } })
  expect(renderedText(document.body)).toEqual('q=hello')
})

test('a malformed percent encoding in a param renders the not-found page', () => {
  const app = demo()
  const errors = spy(console, 'error', () => {})
  navigate('/todos/%zz')
  mountRouter({
    map: app,
    screens: { [app.todos.$id]: ({ params }) => div(`todo ${params.id}`) },
    notFound: () => div('nothing here'),
  })
  expect(renderedText(document.body)).toEqual('nothing here')
  expect(errors.calls.length).toEqual(0)
})

test('a repeated query key keeps its first value in query, and every value in searchParams', () => {
  const app = demo()
  const seen = []
  navigate('/search?tag=a&tag=b&q=milk')
  mountRouter({
    map: app,
    screens: {
      [app.search]: ({ query, searchParams }) => {
        seen.push(searchParams.getAll('tag').join('+'))
        return div(`${query.tag} ${query.q}`)
      },
    },
  })
  expect(renderedText(document.body)).toEqual('a milk')
  expect(seen).toEqual(['a+b'])
  expect(useRoute().get().query).toEqual({ tag: 'a', q: 'milk' })
  expect(useRoute().get().searchParams.getAll('tag')).toEqual(['a', 'b'])
})

test('a change of a repeated query value reaches useRoute', () => {
  const app = demo()
  const screen = component('r-tags', {
    setup: () => span(useRoute().text((current) => current.searchParams.getAll('tag').join('+'))),
  })
  navigate('/search?tag=a&tag=b')
  mountRouter({ map: app, screens: { [app.search]: () => screen() } })
  expect(renderedText(document.body)).toEqual('a+b')
  navigate('/search?tag=a&tag=c')
  expect(renderedText(document.body)).toEqual('a+c')
})

test('a query-only navigation keeps the screen mounted and updates useRoute', () => {
  const app = demo()
  let mounts = 0
  const screen = component('r-keep', {
    setup: () => {
      mounts++
      return span(useRoute().text((current) => current.query.a ?? ''))
    },
  })
  navigate('/search?a=1')
  mountRouter({ map: app, screens: { [app.search]: () => screen() } })
  expect(mounts).toEqual(1)
  expect(renderedText(document.body)).toEqual('1')
  navigate('/search?a=2')
  expect(mounts).toEqual(1)
  expect(renderedText(document.body)).toEqual('2')
})

test('navigating to a different screen swaps it and unmounts the previous one', async () => {
  const app = demo()
  let unmounts = 0
  const page = component('r-leaver', {
    setup: () => div('leaving page'),
    onRemove: () => unmounts++,
  })
  navigate('/search')
  mountRouter({
    map: app,
    screens: { [app.search]: () => page(), [app.login]: () => div('login page') },
  })
  expect(renderedText(document.body)).toEqual('leaving page')
  navigate('/login')
  await settled()
  expect(renderedText(document.body)).toEqual('login page')
  expect(unmounts).toEqual(1)
})

test("a screen's scoped state is released when the screen is left", async () => {
  const app = demo()
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
  navigate('/search')
  mountRouter({ map: app, screens: { [app.search]: () => holder(), [app.login]: () => reader() } })
  navigate('/login')
  await settled()
  expect(renderedText(document.body)).toContain("no state 'rroute.value'")
})

test('a screen factory that returns a Promise is rejected', async () => {
  const app = demo()
  const errors = spy(console, 'error', () => {})
  navigate('/search')
  mountRouter({
    map: app,
    screens: { [app.search]: () => Promise.resolve(div('too late')) },
    error: (_self, error) => div(error.message),
  })
  await settled()
  expect(renderedText(document.body)).toContain('a screen renders immediately')
  expect(errors.calls.length).toEqual(1)
})

test('a node with no screen renders a stub that names it', () => {
  const app = demo()
  const logs = spy(console, 'log', () => {})
  navigate('/todos/7/edit')
  mountRouter({ map: app, screens: { [app.search]: () => div('search') } })
  expect(renderedText(document.body)).toEqual('Edit')
  expect(logs.calls.some(([line]) => String(line).includes('render a stub'))).toEqual(true)
  expect(logs.calls.some(([line]) => String(line).includes('/todos/:id/edit'))).toEqual(true)
})

test('a stub shows the description of its node', () => {
  const app = demo()
  navigate('/')
  mountRouter({ map: app, screens: {} })
  expect(renderedText(document.body)).toEqual('HomeThe start')
})

test('a parent with no screen forwards to its first static child', async () => {
  const app = demo()
  navigate('/todos')
  mountRouter({ map: app, screens: { [app.todos.$id]: () => div('one todo') } })
  await settled()
  expect(renderedText(document.body)).toEqual('TodosEvery todo')
  navigate('/admin')
  await settled()
  expect(globalThis.location.pathname).toEqual('/admin/users')
})

test('a node bound to redirect() forwards to the handle, with the params of the route', async () => {
  const app = demo()
  navigate('/reports')
  mountRouter({
    map: app,
    screens: {
      [app.reports]: redirect(app.reports.monthly),
      [app.reports.monthly]: () => div('monthly report'),
      [app.todos.$id]: redirect(app.todos.$id.edit),
      [app.todos.$id.edit]: ({ params }) => div(`edit ${params.id}`),
      [app.search]: redirect('/admin/billing'),
    },
  })
  await settled()
  expect(globalThis.location.pathname).toEqual('/reports/monthly')
  expect(renderedText(document.body)).toEqual('monthly report')
  navigate('/todos/5')
  await settled()
  expect(globalThis.location.pathname).toEqual('/todos/5/edit')
  expect(renderedText(document.body)).toEqual('edit 5')
  navigate('/search')
  await settled()
  expect(globalThis.location.pathname).toEqual('/admin/billing')
  expect(() => redirect('admin')).toThrow("a path starts with '/'")
  expect(() => redirect(3)).toThrow('to is a handle of the map')
  expect(() =>
    router({ map: app, screens: { [app.search]: redirect(appMap({ x: {} }).x) } }),
  ).toThrow("redirects to '/x', which is not a node of the map")
})

test('router({ notFound }) renders the one not-found page for a path off the map', () => {
  const app = demo()
  navigate('/nowhere/at/all')
  mountRouter({ map: app, screens: {}, notFound: () => div('nothing here') })
  expect(renderedText(document.body)).toEqual('nothing here')
})

test('router({ error }) renders an error view when a screen fails to render', async () => {
  const app = demo()
  const errors = spy(console, 'error', () => {})
  const broken = component('r-broken-screen', {
    setup: () => {
      throw new Error('boom')
    },
  })
  navigate('/search')
  mountRouter({
    map: app,
    screens: { [app.search]: () => broken() },
    error: (_self, error) => div(`failed: ${error.message}`),
  })
  await settled()
  expect(renderedText(document.body)).toEqual('failed: boom')
  expect(errors.calls.length).toBeGreaterThan(0)
})

test('screens must be keyed by handles of the map', () => {
  const app = demo()
  expect(() => router({ map: app, screens: { [app.admin.usres]: () => div() } })).toThrow(
    "a key is 'undefined', so a handle is mistyped",
  )
  expect(() => router({ map: app, screens: { '/elsewhere': () => div() } })).toThrow(
    "'/elsewhere' is not a node of the map",
  )
  expect(() => router({ map: app, screens: { [app.search]: 42 } })).toThrow(
    'must map to a screen factory or an area',
  )
  expect(() => router({ map: app, screens: { [app.search]: area({ screens: {} }) } })).toThrow(
    'loaded on demand',
  )
})

test('router validates its options', () => {
  const app = demo()
  expect(() => router({ routes: {} })).toThrow('the route table is the map')
  expect(() => router({ map: 'nope' })).toThrow("'map' must be the value appMap() returned")
  expect(() => router({ screens: {} })).toThrow("needs the 'map'")
  expect(() => router({ map: app, screens: {}, loading: 'nope' })).toThrow(
    'loading must be a function',
  )
  expect(() => router({ map: app, screens: {}, error: 'nope' })).toThrow('error must be a function')
  expect(() => router({ map: app, screens: {}, notFound: 'nope' })).toThrow(
    'notFound must be a function',
  )
  expect(() => router({ map: app, screens: {}, access: 'nope' })).toThrow(
    'access must be one guard',
  )
  expect(() => router({ map: appMap({ a: { access: 'x' } }), screens: {} })).toThrow(
    "the map sets access on '/a'",
  )
})

const adminArea = (app, extra = {}) =>
  area(() =>
    Promise.resolve({
      default: area({
        screens: {
          [app.admin]: () => div('admin home'),
          [app.admin.users]: () => div('admin users'),
        },
        ...extra,
      }),
    }),
  )

test('an area bound to a node loads its module and renders the screens under it', async () => {
  const app = demo()
  navigate('/admin/users')
  mountRouter({
    map: app,
    screens: { [app.admin]: adminArea(app) },
    loading: () => div('loading...'),
  })
  expect(renderedText(document.body)).toEqual('loading...')
  await settled()
  expect(renderedText(document.body)).toEqual('admin users')
  navigate('/admin')
  await settled()
  expect(renderedText(document.body)).toEqual('admin home')
})

test('a node inside an area that the area does not bind renders a stub', async () => {
  const app = demo()
  navigate('/admin/billing')
  mountRouter({ map: app, screens: { [app.admin]: adminArea(app) } })
  await settled()
  expect(renderedText(document.body)).toEqual('Billing')
})

test('an area binds only its own nodes', async () => {
  const app = demo()
  const errors = spy(console, 'error', () => {})
  navigate('/admin/users')
  mountRouter({
    map: app,
    screens: {
      [app.admin]: area(() =>
        Promise.resolve({ default: area({ screens: { [app.search]: () => div('x') } }) }),
      ),
    },
    error: (_self, error) => div(error.message),
  })
  await settled()
  expect(renderedText(document.body)).toContain("'/search' is outside the area at '/admin'")
  expect(errors.calls.length).toBeGreaterThan(0)
})

test('a failed area download logs and renders nothing', async () => {
  const app = demo()
  const errors = spy(console, 'error', () => {})
  navigate('/admin/users')
  mountRouter({
    map: app,
    screens: { [app.admin]: area(() => Promise.reject(new Error('chunk failed'))) },
  })
  await settled()
  expect(renderedText(document.body)).toEqual('')
  expect(errors.calls.length).toEqual(1)
})

test('a prefix param reaches the screens of an area', async () => {
  const app = appMap({ shop: { $orgId: { team: {} } } })
  navigate('/shop/42/team')
  mountRouter({
    map: app,
    screens: {
      [app.shop.$orgId]: area(() =>
        Promise.resolve({
          default: area({
            screens: { [app.shop.$orgId.team]: ({ params }) => div(`org ${params.orgId} team`) },
          }),
        }),
      ),
    },
  })
  await settled()
  expect(renderedText(document.body)).toEqual('org 42 team')
})

test('navigating within an area keeps it mounted and swaps only the sub-screen', async () => {
  const app = demo()
  let loads = 0
  navigate('/admin/users')
  mountRouter({
    map: app,
    screens: {
      [app.admin]: area(() => {
        loads++
        return Promise.resolve({
          default: area({
            screens: {
              [app.admin.users]: () => div('sub users'),
              [app.admin.billing]: () => div('sub billing'),
            },
          }),
        })
      }),
    },
  })
  await settled()
  expect(renderedText(document.body)).toEqual('sub users')
  expect(loads).toEqual(1)
  navigate('/admin/billing')
  await settled()
  expect(renderedText(document.body)).toEqual('sub billing')
  expect(loads).toEqual(1)
})

test('an area({ root }) wraps the section, and router() inside it renders the tail', async () => {
  const app = demo()
  const frame = component('r-area-root', {
    setup: () => div(span('frame '), router()),
  })
  navigate('/admin/users')
  mountRouter({ map: app, screens: { [app.admin]: adminArea(app, { root: () => frame() }) } })
  await settled()
  expect(renderedText(document.body)).toEqual('frame admin users')
  navigate('/admin')
  await settled()
  expect(renderedText(document.body)).toEqual('frame admin home')
})

test("an area's root stays mounted while its screens swap, and provides to all of them", async () => {
  const app = demo()
  let mounts = 0
  const frame = component('r-area-shell', {
    setup: (self) => {
      mounts++
      initState(self, 'rarea.section', 'section value')
      return div(router())
    },
  })
  const reader = component('r-area-reader', {
    setup: (self) => div(useState(self, 'rarea.section').text((current) => current)),
  })
  navigate('/admin/users')
  mountRouter({
    map: app,
    screens: {
      [app.admin]: area(() =>
        Promise.resolve({
          default: area({
            root: () => frame(),
            screens: {
              [app.admin.users]: () => reader(),
              [app.admin.billing]: () => reader(),
            },
          }),
        }),
      ),
    },
  })
  await settled()
  expect(renderedText(document.body)).toEqual('section value')
  expect(mounts).toEqual(1)
  navigate('/admin/billing')
  await settled()
  expect(renderedText(document.body)).toEqual('section value')
  expect(mounts).toEqual(1)
})

test("a path under an area that is off the map renders the app's not-found page", async () => {
  const app = appMap({ a: { x: {} } })
  const frame = component('r-area-options', { setup: () => div(router()) })
  navigate('/a/missing')
  mountRouter({
    map: app,
    screens: {
      [app.a]: area(() =>
        Promise.resolve({
          default: area({ root: () => frame(), screens: { [app.a.x]: () => div('x') } }),
        }),
      ),
    },
    notFound: () => div('app 404'),
  })
  await settled()
  expect(renderedText(document.body)).toEqual('app 404')
  navigate('/a/x')
  await settled()
  expect(renderedText(document.body)).toEqual('x')
})

test('area validates its definition, and router() outside an area fails at mount', async () => {
  expect(() => area({ root: 'nope', screens: {} })).toThrow('root must be a function')
  expect(() => area({ screens: 'nope' })).toThrow('screens must be an object')
  expect(() => area({ screens: {}, access: 'admin' })).toThrow('access is a node prop of the map')
  expect(() => area('nope')).toThrow('area() takes either a loader')
  expect(() => area({ routes: {} })).toThrow('area() takes either a loader')
  const errors = spy(console, 'error', () => {})
  mount(document.body, div(router()))
  await settled()
  expect(errors.calls.length).toEqual(1)
  expect(String(errors.calls[0][1])).toContain('area({ root })')
})

test("the router's error view receives the self of the route host", async () => {
  const app = demo()
  spy(console, 'error', () => {})
  const broken = component('r-broken-with-self', {
    setup: () => {
      throw new Error('boom')
    },
  })
  const owner = component('r-error-owner', {
    setup: (self) => {
      initState(self, 'rerr.label', 'failed')
      return div(
        router({
          map: app,
          screens: { [app.search]: () => broken() },
          error: (self, error) => div(useState(self, 'rerr.label').text(), ': ', error.message),
        }),
      )
    },
  })
  navigate('/search')
  mount(document.body, owner())
  await settled()
  expect(renderedText(document.body)).toEqual('failed: boom')
})

test('useRoute exposes the current path and reacts to navigation', () => {
  const app = demo()
  const crumb = component('r-crumb', {
    setup: () => span(useRoute().text((current) => current.path)),
  })
  navigate('/search')
  mountRouter({ map: app, screens: { [app.search]: () => crumb(), [app.login]: () => crumb() } })
  expect(renderedText(document.body)).toEqual('/search')
  navigate('/login')
  expect(renderedText(document.body)).toEqual('/login')
})

const descriptionContent = () =>
  document.head.querySelector('meta[name="description"]')?.getAttribute('content') ?? null

test('the router writes the description of the matched node to the meta tag', () => {
  const app = demo()
  document.head.querySelector('meta[name="description"]')?.remove()
  navigate('/todos')
  mountRouter({ map: app, screens: {} })
  expect(descriptionContent()).toEqual('Every todo')
  navigate('/')
  expect(descriptionContent()).toEqual('The start')
  navigate('/search')
  expect(document.head.querySelector('meta[name="description"]')).toEqual(null)
  navigate('/nowhere')
  expect(document.head.querySelector('meta[name="description"]')).toEqual(null)
})

test('a node with no description restores the description of the page', () => {
  const app = demo()
  document.head.querySelector('meta[name="description"]')?.remove()
  const meta = document.createElement('meta')
  meta.setAttribute('name', 'description')
  meta.setAttribute('content', 'The app for todos')
  document.head.append(meta)
  navigate('/todos')
  mountRouter({ map: app, screens: {} })
  expect(descriptionContent()).toEqual('Every todo')
  navigate('/search')
  expect(descriptionContent()).toEqual('The app for todos')
  meta.remove()
})

test('router({ title }) writes the document title from the trail', async () => {
  const app = demo()
  navigate('/todos/2/edit')
  document.title = 'untouched'
  mountRouter({ map: app, screens: {} })
  expect(document.title).toEqual('untouched')
  document.body.replaceChildren()
  mountRouter({
    map: app,
    screens: {},
    options: { [app.todos.$id]: todoOptions },
    title: ({ crumbs, node, params }) => `${crumbs.join(' / ')} | ${node} | ${params.id ?? ''}`,
  })
  expect(document.title).toEqual('Todos / Second / Edit | /todos/:id/edit | 2')
  navigate('/search')
  await settled()
  expect(document.title).toEqual('Search | /search |')
  expect(() => router({ map: app, title: 'Acme' })).toThrow('title is a function')
})

test('router({ options }) binds a list or a state to a param node', () => {
  const app = demo()
  expect(() => router({ map: app, options: { [app.todos]: [] } })).toThrow(
    'is not a param node of the map',
  )
  expect(() => router({ map: app, options: { [app.todos.$id]: 'plain' } })).toThrow(
    'must include a namespace',
  )
  expect(() => router({ map: app, options: { [app.todos.$id]: 3 } })).toThrow(
    'must name a state that holds',
  )
  expect(() => router({ map: app, options: [] })).toThrow('keyed by param handles')
})

test('IMP_BASEPATH prefixes navigate and strips the base when matching', () => {
  const app = demo()
  globalThis.__IMP_ENV__ = { IMP_BASEPATH: '/app' }
  navigate('/search')
  expect(globalThis.location.pathname).toEqual('/app/search')
  mountRouter({ map: app, screens: { [app.search]: () => div('based search') } })
  expect(renderedText(document.body)).toEqual('based search')
})

test('url() prefixes app-root paths with the base and leaves the rest untouched', () => {
  expect(url('/todos')).toEqual('/todos')
  globalThis.__IMP_ENV__ = { IMP_BASEPATH: '/app' }
  expect(url('/todos')).toEqual('/app/todos')
  expect(url('todos')).toEqual('todos')
  expect(url('https://example.com/todos')).toEqual('https://example.com/todos')
})

test('safeNext() keeps a path of the app and falls back for anything else', () => {
  expect(safeNext('/todos/3?tab=notes', '/home')).toEqual('/todos/3?tab=notes')
  for (const value of [
    '//evil.example/',
    '/\\evil.example/',
    '/\t/evil.example/',
    'https://evil.example/',
    'javascript:alert(1)',
    'data:text/html,hi',
    'todos',
    '',
    undefined,
    null,
    ['/todos'],
  ]) {
    expect(safeNext(value, '/home')).toEqual('/home')
  }
  expect(safeNext('//evil.example/')).toEqual('/')
  globalThis.__IMP_ENV__ = { IMP_ROUTING: 'hash' }
  expect(safeNext('/todos', '/home')).toEqual('/todos')
  expect(safeNext('//evil.example/', '/home')).toEqual('/home')
})

test('navigate() refuses another origin without external, and every non-web url', () => {
  const href = globalThis.location.href
  for (const to of ['//evil.example/', '/\\evil.example/', 'https://evil.example/']) {
    expect(() => navigate(to)).toThrow('another site')
  }
  for (const to of ['javascript:alert(1)', 'data:text/html,hi', 'vbscript:x']) {
    expect(() => navigate(to)).toThrow('only an http or https url')
    expect(() => navigate(to, { external: true })).toThrow('only an http or https url')
  }
  globalThis.__IMP_ENV__ = { IMP_BASEPATH: '/app' }
  expect(() => navigate('//evil.example/')).not.toThrow()
  expect(globalThis.location.pathname).toEqual('/app//evil.example/')
  expect(href.startsWith(globalThis.location.origin)).toEqual(true)
})

test('navigate(url, { external: true }) keeps a path of the app in the router', () => {
  navigate('/search', { external: true })
  expect(globalThis.location.pathname).toEqual('/search')
})

test('a leaving screen does not see the route of the next screen in watch(self)', () => {
  const app = demo()
  const seen = []
  const watcher = component('r-route-watcher', {
    setup: (self) => {
      useRoute().watch(self, ({ path }) => seen.push(path))
      return div('watching')
    },
  })
  navigate('/search')
  mountRouter({
    map: app,
    screens: { [app.search]: () => watcher(), [app.reports.weekly]: () => div('weekly') },
  })
  navigate('/reports/weekly')
  expect(renderedText(document.body)).toEqual('weekly')
  expect(seen).toEqual(['/search'])
})

test('url() leaves a path that already carries the base as it is', () => {
  globalThis.__IMP_ENV__ = { IMP_BASEPATH: '/app' }
  expect(url('/app/todos')).toEqual('/app/todos')
  expect(url('/app')).toEqual('/app')
  expect(url('/app?tab=notes')).toEqual('/app?tab=notes')
  expect(url('/application')).toEqual('/app/application')
})

test('IMP_BASEPATH: navigate and link take handle.href() without a second base', () => {
  const app = demo()
  globalThis.__IMP_ENV__ = { IMP_BASEPATH: '/app' }
  navigate(app.search.href())
  expect(globalThis.location.pathname).toEqual('/app/search')
  const anchor = link({ href: app.todos.$id.href({ id: '7' }) }, 'Todo 7')
  mount(document.body, anchor)
  expect(anchor.shadowRoot.querySelector('a').getAttribute('href')).toEqual('/app/todos/7')
})

test('IMP_ROUTING hash keeps the route in the fragment and leaves the path alone', () => {
  const app = demo()
  globalThis.__IMP_ENV__ = { IMP_ROUTING: 'hash' }
  const pathname = globalThis.location.pathname
  navigate('/search?q=milk')
  expect(globalThis.location.pathname).toEqual(pathname)
  expect(globalThis.location.hash).toEqual('#/search?q=milk')
  mountRouter({ map: app, screens: { [app.search]: ({ query }) => div(`search ${query.q}`) } })
  expect(renderedText(document.body)).toEqual('search milk')
  expect(useRoute().get().path).toEqual('/search')
  expect(useRoute().get().query).toEqual({ q: 'milk' })
  expect(useRoute().get().searchParams.toString()).toEqual('q=milk')
  navigate('/reports/weekly')
  expect(globalThis.location.hash).toEqual('#/reports/weekly')
  expect(useRoute().get().path).toEqual('/reports/weekly')
})

test('url() and handle.href() write a fragment under hash routing', () => {
  const app = demo()
  globalThis.__IMP_ENV__ = { IMP_ROUTING: 'hash', IMP_BASEPATH: '/app' }
  expect(url('/todos')).toEqual('#/todos')
  expect(app.todos.$id.href({ id: '7' })).toEqual('#/todos/7')
  expect(url('https://example.com/todos')).toEqual('https://example.com/todos')
})

const MAX_GUARD_REDIRECTS = 10

let session = null

const guardHost = component('r-guard-host', {
  setup: (self, options, initial) => {
    session =
      initial === undefined
        ? initState(self, 'rguard.session')
        : initState(self, 'rguard.session', initial)
    return div(router(options))
  },
})

const mountGuarded = (options, initial) => mount(document.body, guardHost(options, initial))

const access = guard(['rguard.session'], (current, { need }) => {
  if (current === undefined) return wait
  if (!current) return '/login'
  if (need === 'user') return true
  return current.roles.includes(need) || '/forbidden'
})

const guarded = () =>
  appMap({
    login: { nav: false },
    forbidden: { nav: false },
    inbox: { access: 'user' },
    admin: { access: 'admin', users: {}, billing: { access: 'billing' } },
  })

test('an access guard that can decide renders the screen in the same tick', () => {
  const app = guarded()
  navigate('/inbox')
  mountGuarded(
    { map: app, access, screens: { [app.inbox]: () => div('secret') } },
    {
      roles: [],
    },
  )
  expect(renderedText(document.body)).toEqual('secret')
})

test('a guard that allows at once renders the screen with no warning about the loading content', () => {
  const warn = spy(console, 'warn', () => {})
  const app = guarded()
  navigate('/inbox')
  mountGuarded(
    {
      map: app,
      access,
      screens: { [app.inbox]: () => div('inbox') },
      loading: () => div('loading'),
    },
    { roles: [] },
  )
  expect(renderedText(document.body)).toEqual('inbox')
  expect(warn.calls.some(([first]) => String(first).includes('loading is set'))).toEqual(false)
})

test('a guard returning wait shows the loading content until the state settles', async () => {
  const app = guarded()
  navigate('/inbox')
  mountGuarded({
    map: app,
    access,
    screens: { [app.inbox]: () => div('dashboard') },
    loading: () => div('loading'),
  })
  expect(renderedText(document.body)).toEqual('loading')
  session.set({ roles: [] })
  await settled()
  expect(renderedText(document.body)).toEqual('dashboard')
})

test('a guard redirects to the path it returns, replacing the denied entry', async () => {
  const app = guarded()
  navigate('/admin/users')
  mountGuarded(
    {
      map: app,
      access,
      screens: { [app.admin.users]: () => div('users'), [app.forbidden]: () => div('forbidden') },
    },
    { roles: [] },
  )
  await settled()
  expect(renderedText(document.body)).toEqual('forbidden')
  expect(globalThis.location.pathname).toEqual('/forbidden')
})

test('every access on the chain must allow - the deepest need is checked too', async () => {
  const app = guarded()
  navigate('/admin/billing')
  mountGuarded(
    {
      map: app,
      access,
      screens: {
        [app.admin.billing]: () => div('billing'),
        [app.forbidden]: () => div('forbidden'),
      },
    },
    { roles: ['admin'] },
  )
  await settled()
  expect(renderedText(document.body)).toEqual('forbidden')
  session.set({ roles: ['admin', 'billing'] })
  navigate('/admin/billing')
  await settled()
  expect(renderedText(document.body)).toEqual('billing')
})

test('a guard waiting first, then denying, redirects once the state settles', async () => {
  const app = guarded()
  navigate('/admin/users')
  mountGuarded({
    map: app,
    access,
    screens: { [app.admin.users]: () => div('users'), [app.login]: () => div('login') },
    loading: () => div('loading'),
  })
  expect(renderedText(document.body)).toEqual('loading')
  session.set(null)
  await settled()
  expect(renderedText(document.body)).toEqual('login')
})

test('a guard re-runs when its state changes and leaves a mounted screen', async () => {
  const app = guarded()
  navigate('/inbox')
  mountGuarded(
    {
      map: app,
      access,
      screens: { [app.inbox]: () => div('inbox'), [app.login]: () => div('login') },
    },
    { roles: [] },
  )
  expect(renderedText(document.body)).toEqual('inbox')
  session.set(null)
  await settled()
  expect(renderedText(document.body)).toEqual('login')
})

test('a guard returning false renders the not-found page', async () => {
  const app = guarded()
  const hidden = guard(['rguard.session'], (current) =>
    current === undefined ? wait : current.roles.includes('admin'),
  )
  navigate('/admin/users')
  mountGuarded(
    {
      map: app,
      access: hidden,
      screens: { [app.admin.users]: () => div('users') },
      notFound: () => div('nothing here'),
    },
    { roles: [] },
  )
  await settled()
  expect(renderedText(document.body)).toEqual('nothing here')
})

test('a node with no access is open, so the login page never loops', async () => {
  const app = guarded()
  navigate('/inbox')
  mountGuarded(
    {
      map: app,
      access,
      screens: { [app.inbox]: () => div('protected'), [app.login]: () => div('login') },
    },
    null,
  )
  await settled()
  expect(renderedText(document.body)).toEqual('login')
})

test('an access on an area node decides before the area downloads', async () => {
  const app = guarded()
  let loads = 0
  navigate('/admin/users')
  mountGuarded(
    {
      map: app,
      access,
      screens: {
        [app.admin]: area(() => {
          loads++
          return Promise.resolve({
            default: area({ screens: { [app.admin.users]: () => div('admin users') } }),
          })
        }),
        [app.forbidden]: () => div('forbidden'),
      },
    },
    { roles: [] },
  )
  await settled()
  expect(renderedText(document.body)).toEqual('forbidden')
  expect(loads).toEqual(0)
})

test('a narrower access inside an area is checked by the inner router', async () => {
  const app = guarded()
  navigate('/admin/billing')
  mountGuarded(
    {
      map: app,
      access,
      screens: {
        [app.admin]: area(() =>
          Promise.resolve({
            default: area({ screens: { [app.admin.billing]: () => div('billing') } }),
          }),
        ),
        [app.forbidden]: () => div('forbidden'),
      },
    },
    { roles: ['admin'] },
  )
  await settled()
  expect(renderedText(document.body)).toEqual('forbidden')
})

test('a guarded area keeps re-checking while the visitor is inside it', async () => {
  const app = guarded()
  navigate('/admin/users')
  mountGuarded(
    {
      map: app,
      access,
      screens: {
        [app.admin]: area(() =>
          Promise.resolve({
            default: area({ screens: { [app.admin.users]: () => div('users') } }),
          }),
        ),
        [app.login]: () => div('login'),
      },
    },
    { roles: ['admin'] },
  )
  await settled()
  expect(renderedText(document.body)).toEqual('users')
  session.set(null)
  await settled()
  expect(renderedText(document.body)).toEqual('login')
})

test('a guard whose state is not provided fails the route instead of allowing it', async () => {
  const app = guarded()
  const errors = spy(console, 'error', () => {})
  const missing = guard(['rguard.absent'], () => true)
  navigate('/inbox')
  mountGuarded(
    {
      map: app,
      access: missing,
      screens: { [app.inbox]: () => div('secret') },
    },
    { roles: [] },
  )
  await settled()
  expect(renderedText(document.body)).toEqual('')
  expect(errors.calls.some((call) => String(call[1]).includes("no state 'rguard.absent'"))).toEqual(
    true,
  )
})

test('a guard returning something else fails the route with a clear error', async () => {
  const app = guarded()
  const errors = spy(console, 'error', () => {})
  const confused = guard(['rguard.session'], () => 'login')
  navigate('/inbox')
  mountGuarded(
    {
      map: app,
      access: confused,
      screens: { [app.inbox]: () => div('secret') },
      error: (_self, error) => div(error.message),
    },
    { roles: [] },
  )
  await settled()
  expect(renderedText(document.body)).toContain('must return true to allow')
  expect(errors.calls.length).toBeGreaterThan(0)
})

test('guards that redirect in a cycle fail with a clear error', async () => {
  const app = appMap({ a: { access: 'a' }, b: { access: 'b' } })
  const errors = spy(console, 'error', () => {})
  const bouncing = guard(['rguard.session'], (_current, { need }) => (need === 'a' ? '/b' : '/a'))
  navigate('/a')
  mountGuarded(
    {
      map: app,
      access: bouncing,
      screens: { [app.a]: () => div('a'), [app.b]: () => div('b') },
      error: (_self, error) => div(error.message),
    },
    { roles: [] },
  )
  await settled()
  expect(renderedText(document.body)).toContain('redirecting in a cycle')
  expect(errors.calls.length).toBeGreaterThan(0)
})

test('redirects that reach a screen do not accumulate toward the cycle limit', async () => {
  const app = guarded()
  const errors = spy(console, 'error', () => {})
  navigate('/admin/users')
  mountGuarded(
    {
      map: app,
      access,
      screens: { [app.admin.users]: () => div('users'), [app.forbidden]: () => div('forbidden') },
    },
    { roles: [] },
  )
  for (let attempt = 0; attempt < MAX_GUARD_REDIRECTS + 2; attempt++) {
    navigate('/admin/users')
    await settled()
    expect(renderedText(document.body)).toEqual('forbidden')
  }
  expect(errors.calls.length).toEqual(0)
})

test('guard validates its arguments', () => {
  expect(() => guard('rguard.session', () => true)).toThrow('non-empty array of state names')
  expect(() => guard(['session'], () => true)).toThrow('must include a namespace')
  expect(() => guard(['rguard.session'], 'nope')).toThrow("'check' must be a function")
})

const editor = component('r-editor', {
  setup: (self, check) => {
    beforeLeave(self, check)
    return div('editing')
  },
})

const editing = (check) => {
  const app = demo()
  navigate('/search')
  mountRouter({
    map: app,
    screens: { [app.search]: () => editor(check), [app.login]: () => div('login page') },
  })
  expect(renderedText(document.body)).toEqual('editing')
}

test('beforeLeave returning false keeps the screen when the app navigates away', async () => {
  const check = spy(() => false)
  editing(check)
  navigate('/login')
  await settled()
  expect(check.calls.length).toEqual(1)
  expect(globalThis.location.pathname).toEqual('/search')
  expect(renderedText(document.body)).toEqual('editing')
})

test('beforeLeave can answer later, and the navigation goes on when it allows', async () => {
  let answer = null
  const check = spy(() => new Promise((resolve) => (answer = resolve)))
  editing(check)
  navigate('/login')
  navigate('/reports')
  await settled()
  expect(check.calls.length).toEqual(1)
  expect(renderedText(document.body)).toEqual('editing')
  answer(true)
  await settled()
  expect(globalThis.location.pathname).toEqual('/login')
  expect(renderedText(document.body)).toEqual('login page')
})

test('a navigation that keeps the route never asks beforeLeave', async () => {
  const check = spy(() => false)
  editing(check)
  navigate('/search#results')
  navigate('/search')
  await settled()
  expect(check.calls.length).toEqual(0)
})

const traversals = (count) =>
  new Promise((resolve) => {
    let left = count
    const seen = () => {
      left -= 1
      if (left > 0) return
      globalThis.removeEventListener('popstate', seen)
      setTimeout(resolve)
    }
    globalThis.addEventListener('popstate', seen)
  })

test('the back button waits for beforeLeave and puts the screen back when it refuses', async () => {
  let allow = false
  const check = spy(() => allow)
  navigate('/reports')
  editing(check)
  navigate('/login')
  await settled()
  expect(globalThis.location.pathname).toEqual('/search')

  const refused = traversals(2)
  globalThis.history.back()
  await refused
  expect(check.calls.length).toEqual(2)
  expect(globalThis.location.pathname).toEqual('/search')
  expect(renderedText(document.body)).toEqual('editing')

  allow = true
  const allowed = traversals(3)
  globalThis.history.back()
  await allowed
  expect(check.calls.length).toEqual(3)
  expect(renderedText(document.body)).not.toEqual('editing')
  expect(useRoute().get().path).toEqual(globalThis.location.pathname)
})

test('beforeLeave ends when its component unmounts', async () => {
  const check = spy(() => false)
  editing(check)
  document.body.replaceChildren()
  await settled()
  navigate('/login')
  await settled()
  expect(check.calls.length).toEqual(0)
  expect(globalThis.location.pathname).toEqual('/login')
})

test('a beforeLeave that throws keeps the screen and logs the error', async () => {
  const error = spy(console, 'error', () => {})
  editing(() => {
    throw new Error('no draft store')
  })
  navigate('/login')
  await settled()
  expect(globalThis.location.pathname).toEqual('/search')
  expect(error.calls.some((call) => call.join(' ').includes('beforeLeave failed'))).toBeTruthy()
})

test('a guard redirect after an allowed leave does not ask again', async () => {
  const check = spy(() => true)
  const shell = component('r-leave-shell', {
    setup: (self, options) => {
      beforeLeave(self, check)
      initState(self, 'rguard.session', false)
      return div(router(options))
    },
  })
  const app = guarded()
  navigate('/login')
  mount(document.body, shell({ map: app, access, screens: { [app.login]: () => div('login') } }))
  navigate('/inbox')
  await settled()
  await settled()
  expect(check.calls.length).toEqual(1)
  expect(globalThis.location.pathname).toEqual('/login')
})

test('beforeLeave validates its arguments', () => {
  expect(() => beforeLeave(null, () => true)).toThrow("'self' must be the self")
  const probe = component('r-leave-probe', {
    setup: (self) => {
      beforeLeave(self, true)
      return div()
    },
  })
  const error = spy(console, 'error', () => {})
  mount(document.body, probe())
  expect(
    error.calls.some((call) => call.join(' ').includes("'check' must be a function")),
  ).toBeTruthy()
})

test('the screen region scrolls to the top on a push and back to its place on a back', async () => {
  const app = demo()
  const tall = (text) => {
    const screen = div(text)
    screen.style.blockSize = '1000px'
    return screen
  }
  let region
  const frame = component('r-scroll-frame', {
    setup: (self) => {
      region = div(
        router({
          map: app,
          screens: { [app.search]: () => tall('search'), [app.login]: () => tall('login') },
        }),
      )
      region.style.blockSize = '200px'
      region.style.overflow = 'auto'
      screenRegion(self, region)
      return region
    },
  })
  navigate('/search')
  mount(document.body, frame())
  await nextFrame()
  region.scrollTop = 120
  expect(region.scrollTop).toEqual(120)
  navigate('/login')
  await nextFrame()
  expect(renderedText(document.body)).toEqual('login')
  expect(region.scrollTop).toEqual(0)
  const returned = traversals(1)
  globalThis.history.back()
  await returned
  await nextFrame()
  expect(renderedText(document.body)).toEqual('search')
  expect(region.scrollTop).toEqual(120)
})

test('screenRegion validates its arguments', () => {
  const frame = component('r-bad-frame', {
    setup: (self) => {
      expect(() => screenRegion(self, 'main')).toThrow('the element must be the box')
      expect(() => screenRegion(self, div(), { effect: 'spin' })).toThrow("'effect' must be one of")
      return div()
    },
  })
  expect(() => screenRegion({}, div())).toThrow("'self' must be the self")
  mount(document.body, frame())
})

test('a navigation in the same task wins over the redirect that a guard queued', async () => {
  const app = guarded()
  navigate('/inbox')
  mountGuarded(
    {
      map: app,
      access,
      screens: {
        [app.inbox]: () => div('inbox'),
        [app.login]: () => div('login'),
        [app.forbidden]: () => div('done'),
      },
    },
    { roles: [] },
  )
  session.set(null)
  navigate('/forbidden', { replace: true })
  await settled()
  expect(globalThis.location.pathname).toEqual('/forbidden')
  expect(renderedText(document.body)).toEqual('done')
})

test('a guard that allows again before its redirect runs keeps the screen', async () => {
  const app = guarded()
  navigate('/inbox')
  mountGuarded(
    {
      map: app,
      access,
      screens: { [app.inbox]: () => div('inbox'), [app.login]: () => div('login') },
    },
    { roles: [] },
  )
  session.set(null)
  session.set({ roles: [] })
  await settled()
  expect(globalThis.location.pathname).toEqual('/inbox')
  expect(renderedText(document.body)).toEqual('inbox')
})

test('handle.href takes a query and can give an absolute URL', () => {
  const app = demo()
  expect(
    app.search.href({}, { query: { q: 'milk & honey', tag: ['a', 'b'], page: null } }),
  ).toEqual('/search?q=milk+%26+honey&tag=a&tag=b')
  expect(app.search.href(undefined, { query: {} })).toEqual('/search')
  expect(app.todos.$id.href({ id: '7' }, { absolute: true })).toEqual(
    `${globalThis.location.origin}/todos/7`,
  )
  globalThis.__IMP_ENV__ = { IMP_ROUTING: 'hash' }
  expect(app.search.href({}, { query: { q: 'x' } })).toEqual('#/search?q=x')
  globalThis.__IMP_ENV__ = {}
  expect(() => app.search.href({}, { hash: 'x' })).toThrow("'hash' is not an option")
})

test('a node that holds only a param is no page - its URL is not found and its crumb is text', () => {
  const app = appMap({ join: { $key: {} }, other: {} })
  navigate('/join')
  mountRouter({
    map: app,
    screens: { [app.join.$key]: ({ params }) => div(`join ${params.key}`) },
    notFound: () => div('not found'),
  })
  expect(renderedText(document.body)).toEqual('not found')
  navigate('/join/abc')
  expect(renderedText(document.body)).toEqual('join abc')
  const crumbs = mapNav(app).current.get().crumbs
  expect(crumbs.map((crumb) => crumb.href)).toEqual([null, '/join/abc'])
})

test('crumbLabel names the param crumb of the screen with the data it loaded', async () => {
  const app = appMap({ teams: { $teamId: { settings: {} } } })
  let name
  const team = component('r-crumb-team', {
    setup: (self) => {
      name = initState(self, 'rcrumb.name', 'Platform')
      crumbLabel(self, name)
      return div('team')
    },
  })
  const settings = component('r-crumb-settings', { setup: () => div('settings') })
  navigate('/teams/t1')
  mountRouter({
    map: app,
    screens: {
      [app.teams]: () => div('teams'),
      [app.teams.$teamId]: () => team(),
      [app.teams.$teamId.settings]: () => settings(),
    },
    title: ({ crumbs }) => crumbs.join(' / '),
  })
  await settled()
  expect(document.title).toEqual('Teams / Platform')
  name.set('Core')
  expect(document.title).toEqual('Teams / Core')
  navigate('/teams/t1/settings')
  await settled()
  expect(document.title).toEqual('Teams / Core / Settings')
  navigate('/teams/t2/settings')
  await settled()
  expect(document.title).toEqual('Teams / t2 / Settings')
})

test('crumbLabel outside a param screen warns', async () => {
  const app = appMap({ teams: {} })
  const warn = spy(console, 'warn', () => {})
  const plain = component('r-crumb-plain', {
    setup: (self) => {
      crumbLabel(self, 'Nope')
      return div('plain')
    },
  })
  navigate('/teams')
  mountRouter({ map: app, screens: { [app.teams]: () => plain() } })
  await settled()
  expect(
    warn.calls.some(([line]) => String(line).includes('is not inside a screen of a param')),
  ).toEqual(true)
})
