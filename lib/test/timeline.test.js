import { component, mount } from 'imp'
import { setLang } from 'imp/i18n'
import { luTruck } from 'imp/icons'
import { timeline } from 'imp/std/data'
import { initState } from 'imp/state'
import { afterEach, beforeEach, expect, spy, test } from 'imp/test'
import { renderedText } from './shadow.js'

const stateHost = component('timeline-state-host', { setup: (self, render) => render(self) })

const mounted = (host) => {
  mount(document.body, host)
  return host
}

const shadow = (host, selector) => host.shadowRoot.querySelector(selector)

const all = (host, selector) => [...host.shadowRoot.querySelectorAll(selector)]

const click = (node) =>
  node.dispatchEvent(new MouseEvent('click', { bubbles: true, composed: true, cancelable: true }))

const warnings = () => spy(console, 'warn', () => {})

const warned = (warn, text) => warn.calls.some(([first]) => String(first).includes(text))

const history = () => [
  { id: 'placed', time: '2026-09-21T09:12:00Z', title: 'Order placed', color: 'blue' },
  { id: 'shipped', time: '2026-09-23T07:05:00Z', title: 'Shipped', icon: luTruck },
  { id: 'due', time: '2026-09-30', title: 'Invoice due', description: 'Net 7' },
]

beforeEach(async () => {
  document.body.replaceChildren()
  await setLang('en')
})

afterEach(() => document.body.replaceChildren())

test('timeline renders a labelled ordered list with one event for each item', () => {
  const host = mounted(timeline({ label: 'Order history', items: history() }))
  expect(host.localName).toEqual('imp-timeline')
  const events = shadow(host, 'ol')
  expect(events.getAttribute('role')).toEqual('list')
  expect(events.getAttribute('aria-label')).toEqual('Order history')
  expect(all(host, 'li').map((event) => renderedText(event.querySelector('.title')))).toEqual([
    'Order placed',
    'Shipped',
    'Invoice due',
  ])
  expect(renderedText(all(host, 'li')[2].querySelector('.description'))).toEqual('Net 7')
})

test('timeline writes each time into a time element with a machine-readable value', () => {
  const host = mounted(timeline({ label: 'Order history', items: history() }))
  const [placed, , due] = all(host, 'time')
  expect(placed.getAttribute('datetime')).toEqual('2026-09-21T09:12:00.000Z')
  expect(placed.textContent).toEqual(
    new Intl.DateTimeFormat('en', { dateStyle: 'medium', timeStyle: 'short' })
      .format(new Date('2026-09-21T09:12:00Z')),
  )
  expect(due.getAttribute('datetime')).toEqual('2026-09-30')
  expect(due.textContent).toEqual('Sep 30, 2026')
})

test('timeline formats the times again when the language changes', async () => {
  const host = mounted(timeline({ label: 'Order history', items: history() }))
  await setLang('pl')
  expect(all(host, 'time')[2].textContent).toEqual(
    new Intl.DateTimeFormat('pl', { dateStyle: 'medium', timeZone: 'UTC' })
      .format(new Date('2026-09-30')),
  )
})

test('timeline draws an icon or a dot in a marker that a screen reader skips', () => {
  const host = mounted(timeline({ label: 'Order history', items: history() }))
  const [placed, shipped] = all(host, '.marker')
  expect(placed.getAttribute('aria-hidden')).toEqual('true')
  expect(placed.querySelector('.dot') !== null).toEqual(true)
  expect(placed.classList.contains('color-blue')).toEqual(true)
  expect(shipped.querySelector('imp-icon') !== null).toEqual(true)
  expect(shipped.classList.contains('color-neutral')).toEqual(true)
})

test('timeline renders a real button for the title and reports select', () => {
  const chosen = []
  const host = mounted(timeline({
    label: 'Order history',
    items: history(),
    events: { select: (event) => chosen.push(event.detail.id) },
  }))
  const title = shadow(host, 'li .title')
  expect(title.localName).toEqual('button')
  click(title)
  expect(chosen).toEqual(['placed'])
})

test('timeline renders a link for an item with an href, and plain text otherwise', () => {
  const host = mounted(timeline({
    label: 'Order history',
    items: [{ id: 'placed', title: 'Order placed', href: '/orders/7' }, {
      id: 'paid',
      title: 'Paid',
    }],
  }))
  const [link, plain] = all(host, 'li .title')
  expect(link.localName).toEqual('a')
  expect(link.getAttribute('href')).toEqual('/orders/7')
  expect(plain.localName).toEqual('span')
})

test('timeline draws the actions of each event', () => {
  const host = mounted(timeline({
    label: 'Order history',
    items: history(),
    actions: (item) => {
      const node = document.createElement('button')
      node.textContent = `Open ${item.title}`
      return node
    },
  }))
  expect(all(host, '.actions button').map((node) => node.textContent)).toEqual([
    'Open Order placed',
    'Open Shipped',
    'Open Invoice due',
  ])
})

test('timeline follows a state of items and keeps an unchanged event', async () => {
  let items
  const host = mounted(stateHost((self) => {
    items = initState(self, 'test.timeline.items', history())
    return timeline({ label: 'Order history', items })
  }))
  const inner = host.shadowRoot.querySelector('imp-timeline')
  const first = inner.shadowRoot.querySelector('li')
  items.set((loaded) => [...loaded, { id: 'closed', time: '2026-10-01', title: 'Closed' }])
  await Promise.resolve()
  const events = [...inner.shadowRoot.querySelectorAll('li')]
  expect(events.length).toEqual(4)
  expect(events[0]).toEqual(first)
  expect(renderedText(events[3].querySelector('.title'))).toEqual('Closed')
})

test('timeline shows an empty state with no items', () => {
  const host = mounted(timeline({ label: 'Order history', items: [] }))
  expect(shadow(host, '.empty').hidden).toEqual(false)
  expect(shadow(host, 'imp-empty-state') !== null).toEqual(true)
})

test('timeline warns about a missing label, a bad time, an unknown color and a missing id', () => {
  const warn = warnings()
  mounted(timeline({
    items: [
      { id: 'a', title: 'A', time: 'soon' },
      { id: 'b', title: 'B', color: 'chartreuse' },
      { title: 'C' },
    ],
  }))
  expect(warned(warn, "pass a 'label'")).toEqual(true)
  expect(warned(warn, "the time 'soon'")).toEqual(true)
  expect(warned(warn, "the color 'chartreuse'")).toEqual(true)
  expect(warned(warn, "has no 'id'")).toEqual(true)
})
