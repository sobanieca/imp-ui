import { component, init, mount } from 'imp'
import { span } from 'imp/html'
import { emptyState } from 'imp/std/display'
import { list, table, timeline } from 'imp/std/data'
import { initState } from 'imp/state'
import { luInbox, luSearchX, luUsers } from 'imp/icons'
import { afterEach, expect, spy, test } from 'imp/test'
import * as general from 'imp/std'
import * as layout from 'imp/std/layout'
import * as inputs from 'imp/std/inputs'
import * as display from 'imp/std/display'
import * as feedback from 'imp/std/feedback'
import * as data from 'imp/std/data'
import * as shell from 'imp/std/shell'
import { renderedText } from './shadow.js'

const NOT_COMPONENTS = ['FormError', 'dismiss', 'notify', 'resetForm', 'submitForm']

const stateHost = component('defaults-state-host', { setup: (self, render) => render(self) })

const mounted = (host) => {
  mount(document.body, host)
  return host
}

const shadow = (host, selector) => host.shadowRoot.querySelector(selector)

const warnings = () => spy(console, 'warn', () => {})

const warned = (warn, text) => warn.calls.some(([first]) => String(first).includes(text))

const rejection = async (run) => {
  try {
    await run()
    return ''
  } catch (error) {
    return error.message
  }
}

const emptyOf = (host, selector) => shadow(host, selector).querySelector('imp-empty-state')

const drawsIcon = (state) => shadow(state, '.icon imp-icon') !== null

const drawsImage = (state) => shadow(state, '.image') !== null

afterEach(() => init({ defaults: {} }))

test('a std component takes a prop from init({ defaults }) when the call leaves it out', async () => {
  await init({ defaults: { emptyState: { icon: luInbox, title: 'Nothing yet' } } })
  const state = mounted(emptyState())
  expect(drawsIcon(state)).toEqual(true)
  expect(drawsImage(state)).toEqual(false)
  expect(renderedText(shadow(state, '.title'))).toEqual('Nothing yet')
})

test('a prop of the call wins over the default, and an undefined prop keeps the default', async () => {
  await init({ defaults: { emptyState: { title: 'Nothing yet' } } })
  expect(renderedText(shadow(mounted(emptyState({ title: 'No teams' })), '.title'))).toEqual(
    'No teams',
  )
  expect(renderedText(shadow(mounted(emptyState({ title: undefined })), '.title'))).toEqual(
    'Nothing yet',
  )
})

test('an image of the call replaces a default icon without a warning', async () => {
  await init({ defaults: { emptyState: { icon: luInbox } } })
  const warn = warnings()
  const state = mounted(emptyState({ image: span('art') }))
  expect(drawsImage(state)).toEqual(true)
  expect(drawsIcon(state)).toEqual(false)
  expect(warned(warn, "pass 'icon' or 'image'")).toEqual(false)
})

test('a default DOM node is copied for each instance', async () => {
  await init({ defaults: { emptyState: { image: span({ class: 'art' }, 'art') } } })
  const first = mounted(emptyState())
  const second = mounted(emptyState())
  expect(shadow(first, '.image .art') !== null).toEqual(true)
  expect(shadow(second, '.image .art') !== null).toEqual(true)
})

test('the empty state that a std component draws takes the defaults too', async () => {
  await init({ defaults: { emptyState: { icon: luInbox } } })
  const host = mounted(list({ label: 'Team members', items: [] }))
  expect(drawsIcon(emptyOf(host, '.empty'))).toEqual(true)
})

test('init({ defaults }) with an empty object removes the defaults', async () => {
  await init({ defaults: { emptyState: { icon: luInbox } } })
  await init({ defaults: {} })
  const state = mounted(emptyState())
  expect(drawsIcon(state)).toEqual(false)
  expect(drawsImage(state)).toEqual(true)
})

test('init({ defaults }) takes every standard component by its export name', async () => {
  const names = [general, layout, inputs, display, feedback, data, shell]
    .flatMap((barrel) => Object.keys(barrel))
    .filter((name) => !NOT_COMPONENTS.includes(name))
  const refused = []
  for (const name of names) {
    if ((await rejection(() => init({ defaults: { [name]: {} } }))) !== '') refused.push(name)
  }
  expect(refused).toEqual([])
})

test('init rejects defaults for an unknown component and a value that is not an object', async () => {
  expect(await rejection(() => init({ defaults: [] }))).toContain('keyed by component name')
  expect(await rejection(() => init({ defaults: { banner: {} } }))).toContain(
    "unknown component 'banner'",
  )
  expect(await rejection(() => init({ defaults: { button: 'sm' } }))).toContain(
    "props object for 'button'",
  )
})

test('an unknown prop in the defaults warns once and is left out', async () => {
  await init({ defaults: { emptyState: { colour: 'red', title: 'Nothing yet' } } })
  const warn = warnings()
  const state = mounted(emptyState())
  mounted(emptyState())
  expect(warn.calls.filter(([first]) => String(first).includes("'colour'")).length).toEqual(1)
  expect(renderedText(shadow(state, '.title'))).toEqual('Nothing yet')
})

test('list and timeline draw the empty state from their empty prop', () => {
  const people = mounted(
    list({ label: 'Team members', items: [], empty: { icon: luUsers, title: 'No people yet' } }),
  )
  expect(drawsIcon(emptyOf(people, '.empty'))).toEqual(true)
  expect(renderedText(shadow(people, '.empty'))).toEqual('No people yet')
  const history = mounted(timeline({ label: 'Order history', items: [], empty: span('Quiet') }))
  expect(renderedText(shadow(history, '.empty'))).toEqual('Quiet')
})

test('table draws its empty prop with no rows and its noResults prop when the filter hides all', () => {
  let query
  const outer = mounted(
    stateHost((self) => {
      query = initState(self, 'test.defaults.query', '')
      return table({
        label: 'Invoices',
        columns: [{ key: 'name', label: 'Name' }],
        rows: [{ id: 'a', name: 'alpha' }],
        filter: query,
        empty: { icon: luInbox, title: 'No invoices' },
        noResults: { icon: luSearchX, title: 'No invoice matches' },
      })
    }),
  )
  const host = outer.shadowRoot.querySelector('imp-table')
  query.set('nothing matches')
  expect(renderedText(shadow(host, 'tbody.empty'))).toEqual('No invoice matches')
  const blank = mounted(
    table({
      label: 'Invoices',
      columns: [{ key: 'name', label: 'Name' }],
      rows: [],
      empty: { icon: luInbox, title: 'No invoices' },
    }),
  )
  expect(renderedText(shadow(blank, 'tbody.empty'))).toEqual('No invoices')
})

test('an empty prop that is not props or a node warns and draws the default', () => {
  const warn = warnings()
  const host = mounted(list({ label: 'Team members', items: [], empty: 'None' }))
  expect(warned(warn, "'empty' must be the props of emptyState or a DOM node")).toEqual(true)
  expect(renderedText(shadow(host, '.empty'))).toEqual('Nothing here yet')
})
