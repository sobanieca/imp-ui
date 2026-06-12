import { fire, mount, waitFor } from '../imp/testing.js'
import { assert, assertEquals } from 'jsr:@std/assert@^1'
import { currentRoute, div, h1, link, navigate, p, route, router, span } from '../imp/imp.js'

// Routes are app-global — register once for this file.
route('/', () => h1('home'))
route('/about', () => p('about'))
route(
  '/todos/:id',
  ({ params, query }) => div([`todo ${params.id}`, query.tab ? ` tab=${query.tab}` : '']),
)
route('/lazy', () => Promise.resolve({ default: () => span('lazy page') }))
route('*', () => p('not found'))

Deno.test('router: matches, params, query, wildcard, lazy', async () => {
  navigate('/')
  const view = mount(() => div(router()))
  assertEquals(view.el.textContent, 'home')

  navigate('/about')
  assertEquals(view.el.textContent, 'about')

  navigate('/todos/42?tab=details')
  assertEquals(view.el.textContent, 'todo 42 tab=details')
  assertEquals(currentRoute().path, '/todos/42')
  assertEquals(currentRoute().query.tab, 'details')

  navigate('/no/such/page')
  assertEquals(view.el.textContent, 'not found')

  navigate('/lazy')
  await waitFor(() => view.el.textContent === 'lazy page')

  view.unmount()
  navigate('/')
})

Deno.test('router: outlet swap disposes the old page scope', () => {
  navigate('/')
  let clicks = 0
  route('/clicky', () => div({ id: 'clicky', events: { click: () => clicks++ } }, 'clicky'))
  const view = mount(() => div(router()))
  navigate('/clicky')
  const page = view.query('#clicky')
  fire(page, 'click')
  assertEquals(clicks, 1)
  navigate('/')
  fire(page, 'click') // listener aborted with the route scope
  assertEquals(clicks, 1)
  view.unmount()
})

Deno.test('link: left click navigates client-side', () => {
  navigate('/')
  const view = mount(() => div([link({ href: '/about' }, 'go'), router()]))
  fire(view.query('a'), 'click', { button: 0 })
  assertEquals(currentRoute().path, '/about')
  assert(view.el.textContent.includes('about'))
  view.unmount()
  navigate('/')
})

Deno.test('link: modified clicks and external hrefs are left alone', () => {
  navigate('/')
  const view = mount(() =>
    div([
      link({ href: '/about', id: 'in' }, 'in'),
      link({ href: 'https://example.com', id: 'out' }, 'out'),
    ])
  )
  fire(view.query('#in'), 'click', { button: 0, ctrlKey: true })
  assertEquals(currentRoute().path, '/') // browser would open a new tab
  // external link: handler must not preventDefault/navigate
  fire(view.query('#out'), 'click', { button: 0 })
  assertEquals(currentRoute().path, '/')
  view.unmount()
})
