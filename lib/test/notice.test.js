import { component, mount } from 'imp'
import { initHttpClient } from 'imp/http'
import { luRocket } from 'imp/icons'
import { initState } from 'imp/state'
import { button } from 'imp/std'
import { notice } from 'imp/std/feedback'
import { beforeEach, expect, spy, test } from 'imp/test'
import { renderedText } from './shadow.js'

const stateHost = component('notice-state-host', { setup: (self, render) => render(self) })

const mounted = (host) => {
  mount(document.body, host)
  return host
}

const inner = (host, selector) => host.shadowRoot.querySelector(selector)

const nested = (host) => inner(host, 'imp-notice')

const closeControl = (host) => inner(inner(host, '.close imp-button'), 'button')

const isClosed = (host) => inner(host, '.root').classList.contains('closed')

const click = (node) => node.dispatchEvent(new MouseEvent('click', { bubbles: true }))

const warnings = () => spy(console, 'warn', () => {})

const warned = (warn, text) => warn.calls.some(([first]) => String(first).includes(text))

const failure = (promise) =>
  promise.then(
    () => null,
    (error) => error,
  )

const failingFetch = () =>
  spy(globalThis, 'fetch', () => new Response('', { status: 503, statusText: 'Unavailable' }))

const clientNotice = (props) => {
  let api
  const host = mounted(
    stateHost((self) => {
      api = initHttpClient(self, 'test.api', { baseUrl: 'https://api.test' })
      return notice({ client: 'test.api', ...props })
    }),
  )
  return { api, panel: nested(host) }
}

beforeEach(() => {
  document.body.replaceChildren()
})

test('notice is a status region with its title and its content', () => {
  const host = mounted(notice({ title: 'A new version is ready' }, 'Reload the page.'))
  expect(host.localName).toEqual('imp-notice')
  expect(inner(host, '.region').getAttribute('role')).toEqual('status')
  expect(inner(host, '.title').textContent).toEqual('A new version is ready')
  expect(renderedText(inner(host, '.description'))).toEqual('Reload the page.')
  expect(inner(host, '.root').getAttribute('class')).toContain('kind-info')
  expect(isClosed(host)).toEqual(false)
})

test('a warning and an error are alerts, an info and a success are statuses', () => {
  const roleOf = (kind) =>
    inner(mounted(notice({ kind, title: 'Words' })), '.region').getAttribute('role')
  expect(roleOf('info')).toEqual('status')
  expect(roleOf('success')).toEqual('status')
  expect(roleOf('warning')).toEqual('alert')
  expect(roleOf('error')).toEqual('alert')
})

test('the kind icon is decorative, and icon replaces it', () => {
  const host = mounted(notice({ kind: 'error', title: 'Could not save' }))
  expect(inner(host, '.icon').getAttribute('aria-hidden')).toEqual('true')
  const drawn = (node) => inner(inner(node, '.icon imp-icon'), 'svg').innerHTML
  expect(drawn(mounted(notice({ icon: luRocket, title: 'Faster' })))).not.toEqual(drawn(host))
})

test('notice keeps its actions inside the description', () => {
  const host = mounted(
    notice({ kind: 'warning', title: 'Trial ends' }, 'Add a card.', button('Add payment')),
  )
  expect(inner(host, '.description imp-button')).not.toEqual(null)
})

test('notice has no close button until it is dismissible', () => {
  expect(inner(mounted(notice({ title: 'Plain' })), '.close')).toEqual(null)
})

test('the close button is a named native button that dismisses the notice', () => {
  const dismissed = []
  const host = mounted(
    notice({
      kind: 'error',
      title: 'Could not save',
      dismissible: true,
      events: { dismiss: (event) => dismissed.push(event.detail.open) },
    }),
  )
  const control = closeControl(host)
  expect(control.localName).toEqual('button')
  expect(control.getAttribute('aria-label')).toEqual('Dismiss')
  expect(inner(host, '.region .close')).toEqual(null)
  click(control)
  expect(isClosed(host)).toEqual(true)
  expect(dismissed).toEqual([false])
  expect(inner(host, '.region').isConnected).toEqual(true)
})

test('open follows a state, and a dismiss writes false back', () => {
  let open
  const host = mounted(
    stateHost((self) => {
      open = initState(self, 'notice.open', false)
      return notice({ kind: 'error', title: 'Could not save', open, dismissible: true })
    }),
  )
  const region = inner(nested(host), '.region')
  expect(isClosed(nested(host))).toEqual(true)
  open.set(true)
  expect(isClosed(nested(host))).toEqual(false)
  expect(inner(nested(host), '.region') === region).toEqual(true)
  click(closeControl(nested(host)))
  expect(open.get()).toEqual(false)
  expect(isClosed(nested(host))).toEqual(true)
})

test('a live title updates in place', () => {
  let title
  const host = mounted(
    stateHost((self) => {
      title = initState(self, 'notice.title', '2 files failed')
      return notice({ kind: 'warning', title })
    }),
  )
  title.set('3 files failed')
  expect(inner(nested(host), '.title').textContent).toEqual('3 files failed')
})

test('notice warns about a bad kind and an unknown prop', () => {
  const warn = warnings()
  const host = mounted(notice({ kind: 'fatal', title: 'Words', closable: true }))
  expect(inner(host, '.root').getAttribute('class')).toContain('kind-info')
  expect(warned(warn, "'kind' must be one of")).toBeTruthy()
  expect(warned(warn, "unknown prop 'closable'")).toBeTruthy()
})

test('notice with a client shows the last error of that client, and hides with none', async () => {
  failingFetch()
  const { api, panel } = clientNotice()
  expect(isClosed(panel)).toEqual(true)
  expect(inner(panel, '.region').getAttribute('role')).toEqual('alert')
  expect(inner(panel, '.root').getAttribute('class')).toContain('kind-error')
  const error = await failure(api.get('/users'))
  expect(isClosed(panel)).toEqual(false)
  expect(inner(panel, '.title').textContent).toEqual(error.message)
  expect(inner(panel, '.title').textContent).toContain('GET https://api.test/users answered 503')
})

test('a dismiss of a client notice hides it until the next failure', async () => {
  failingFetch()
  const dismissed = []
  const { api, panel } = clientNotice({ events: { dismiss: () => dismissed.push(true) } })
  await failure(api.get('/users'))
  click(closeControl(panel))
  expect(isClosed(panel)).toEqual(true)
  expect(dismissed).toEqual([true])
  expect(api.lastError.get()).toEqual(null)
  await failure(api.get('/users'))
  expect(isClosed(panel)).toEqual(false)
})

test('a client notice with its own title shows the error under it', async () => {
  failingFetch()
  const { api, panel } = clientNotice({ title: 'Could not load the users' })
  const error = await failure(api.get('/users'))
  expect(inner(panel, '.title').textContent).toEqual('Could not load the users')
  expect(inner(panel, '.detail').textContent).toEqual(error.message)
})

test('a client notice clears when a later call succeeds', async () => {
  let failing = true
  spy(globalThis, 'fetch', () =>
    failing
      ? new Response('', { status: 500 })
      : new Response('{}', { status: 200, headers: { 'content-type': 'application/json' } }),
  )
  const { api, panel } = clientNotice()
  await failure(api.get('/users'))
  expect(isClosed(panel)).toEqual(false)
  failing = false
  await api.get('/users')
  expect(isClosed(panel)).toEqual(true)
})

test('notice stays closed and reports a client that nothing provides', () => {
  const error = spy(console, 'error', () => {})
  const host = mounted(notice({ client: 'missing.api' }))
  expect(isClosed(host)).toEqual(true)
  expect(
    error.calls.some(([first]) => String(first).includes("no http client 'missing.api'")),
  ).toBeTruthy()
})
