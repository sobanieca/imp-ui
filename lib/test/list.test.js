import { component, mount } from 'imp'
import { list } from 'imp/std/data'
import { button } from 'imp/std'
import { flex } from 'imp/std/layout'
import { luFileText } from 'imp/icons'
import { afterEach, beforeEach, expect, spy, test } from 'imp/test'
import { initState } from 'imp/state'
import { renderedText, settled } from './shadow.js'

const stateHost = component('list-state-host', { setup: (self, render) => render(self) })

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

const people = () => [
  { id: 'ada', title: 'Ada Lovelace', description: 'Engineering', name: 'Ada Lovelace' },
  { id: 'alan', title: 'Alan Turing', picture: '/alan.png', tag: { text: 'Admin', color: 'blue' } },
  { id: 'notes', title: 'Notes', icon: luFileText },
]

const observers = []

class ObserverStub {
  constructor(callback) {
    this.callback = callback
    this.targets = new Set()
    observers.push(this)
  }

  observe(target) {
    this.targets.add(target)
  }

  unobserve(target) {
    this.targets.delete(target)
  }

  disconnect() {
    this.targets.clear()
  }

  show() {
    this.callback([...this.targets].map((target) => ({ target, isIntersecting: true })))
  }
}

let nativeObserver

beforeEach(() => {
  document.body.replaceChildren()
  observers.length = 0
  nativeObserver = globalThis.IntersectionObserver
  globalThis.IntersectionObserver = ObserverStub
})

afterEach(() => {
  globalThis.IntersectionObserver = nativeObserver
})

test('list renders a labelled list with one row for each item', () => {
  const host = mounted(list({ label: 'Team members', items: people() }))
  expect(host.localName).toEqual('imp-list')
  const rows = shadow(host, 'ul')
  expect(rows.getAttribute('role')).toEqual('list')
  expect(rows.getAttribute('aria-label')).toEqual('Team members')
  expect(all(host, 'li').length).toEqual(3)
  expect(renderedText(shadow(host, 'li .title'))).toEqual('Ada Lovelace')
  expect(renderedText(shadow(host, 'li .description'))).toEqual('Engineering')
})

test('list shows initials, a picture or an icon as the leading visual', () => {
  const host = mounted(list({ label: 'Team members', items: people() }))
  const [ada, alan, notes] = all(host, 'li')
  expect(ada.querySelector('.avatar').textContent).toEqual('AL')
  expect(ada.querySelector('.avatar').getAttribute('aria-hidden')).toEqual('true')
  expect(alan.querySelector('.avatar img').getAttribute('src')).toEqual('/alan.png')
  expect(notes.querySelector('.visual imp-icon') !== null).toEqual(true)
})

test('list draws the tag of a row from plain data', () => {
  const host = mounted(list({ label: 'Team members', items: people() }))
  const drawn = all(host, 'li')[1].querySelector('imp-tag')
  expect(renderedText(drawn)).toEqual('Admin')
  expect(drawn.shadowRoot.querySelector('.color-blue') !== null).toEqual(true)
})

test('list renders the title of a row with no href as plain text by default', () => {
  const host = mounted(list({ label: 'Team members', items: people() }))
  expect(shadow(host, 'li .title').localName).toEqual('span')
  expect(all(host, 'li button').length).toEqual(0)
})

test('list renders a real button for the title and reports select', () => {
  const chosen = []
  const host = mounted(list({
    label: 'Team members',
    items: people(),
    events: { select: (event) => chosen.push(event.detail) },
  }))
  const title = shadow(host, 'li .title')
  expect(title.localName).toEqual('button')
  expect(title.type).toEqual('button')
  click(title)
  expect(chosen).toEqual([{ id: 'ada', item: people()[0] }])
})

test('list renders a real link for a row with an href and lets select cancel it', () => {
  const chosen = []
  const host = mounted(list({
    label: 'Pages',
    items: [{ id: 'home', title: 'Home', href: '/home' }],
    events: {
      select: (event) => {
        chosen.push(event.detail.id)
        event.preventDefault()
      },
    },
  }))
  const title = shadow(host, 'li .title')
  expect(title.localName).toEqual('a')
  expect(title.getAttribute('href')).toEqual('/home')
  const before = location.href
  click(title)
  expect(chosen).toEqual(['home'])
  expect(location.href).toEqual(before)
})

test('list puts the actions of a row beside it, outside the title control', () => {
  const host = mounted(list({
    label: 'Team members',
    items: people(),
    actions: (item) => {
      const remove = document.createElement('button')
      remove.textContent = `Remove ${item.id}`
      return remove
    },
    events: { select: () => {} },
  }))
  const row = shadow(host, 'li')
  const action = row.querySelector('.actions button')
  expect(action.textContent).toEqual('Remove ada')
  expect(row.querySelector('.title').contains(action)).toEqual(false)
})

test('list shows the empty state when there are no items', () => {
  const host = mounted(list({ label: 'Team members', items: [] }))
  expect(shadow(host, '.empty').hidden).toEqual(false)
  expect(renderedText(shadow(host, '.empty'))).toEqual('Nothing here yet')
})

test('list keeps the node of an unchanged row on a live update', () => {
  let items
  const outer = mounted(stateHost((self) => {
    items = initState(self, 'test.list.items', people().slice(0, 2))
    return list({ label: 'Team members', items })
  }))
  const host = outer.shadowRoot.querySelector('imp-list')
  const [first] = all(host, 'li')
  items.set((loaded) => [...loaded, { id: 'grace', title: 'Grace Hopper' }])
  const next = all(host, 'li')
  expect(next.length).toEqual(3)
  expect(next[0] === first).toEqual(true)
  items.set([])
  expect(all(host, 'li').length).toEqual(0)
  expect(shadow(host, '.empty').hidden).toEqual(false)
})

test('list loads more items when the sentinel shows and marks the list busy', async () => {
  let finish
  let loads = 0
  const host = mounted(list({
    label: 'Team members',
    items: people(),
    hasMore: true,
    onLoadMore: () => {
      loads++
      return new Promise((resolve) => {
        finish = resolve
      })
    },
  }))
  const rows = shadow(host, 'ul')
  observers[0].show()
  await settled()
  expect(loads).toEqual(1)
  expect(rows.getAttribute('aria-busy')).toEqual('true')
  finish()
  await settled()
  expect(rows.getAttribute('aria-busy')).toEqual('false')
})

test('a removed row hands the focus to the same action in the next row', () => {
  let items
  const host = mounted(stateHost((self) => {
    items = initState(self, 'list.focus', people())
    return list({
      label: 'People',
      items,
      actions: (item) =>
        flex(
          button({ label: `Edit ${item.id}` }, 'Edit'),
          button({ label: `Delete ${item.id}` }, 'Delete'),
        ),
    })
  }))
  const rows = shadow(host, 'imp-list')
  const deleteOf = (id) =>
    [...rows.shadowRoot.querySelectorAll('imp-flex')]
      .flatMap((node) => [...node.shadowRoot.querySelectorAll('imp-button')])
      .map((node) => node.shadowRoot.querySelector('button'))
      .find((node) => node.getAttribute('aria-label') === `Delete ${id}`)
  deleteOf('ada').focus()
  items.set(people().slice(1))
  const focused = deleteOf('alan')
  expect(focused.getRootNode().activeElement === focused).toEqual(true)
})

test('list warns about a missing label, a bad actions prop and an item with no id', () => {
  const warn = warnings()
  const host = mounted(list({ items: [{ title: 'No id' }], actions: 'edit' }))
  expect(warned(warn, `pass a 'label'`)).toEqual(true)
  expect(warned(warn, `'actions' must be a function`)).toEqual(true)
  expect(warned(warn, `has no 'id'`)).toEqual(true)
  expect(all(host, 'li').length).toEqual(0)
})
