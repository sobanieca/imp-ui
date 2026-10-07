import { component, mount } from 'imp'
import { form, treeSelect } from 'imp/std/inputs'
import { initState, useState } from 'imp/state'
import { beforeEach, expect, spy, test } from 'imp/test'

const PAGES = [
  {
    value: '/users',
    label: '/users',
    children: [
      { value: '/users/{id}/details', label: '/users/{id}/details' },
      { value: '/users/invites', label: '/users/invites' },
      {
        value: '/users/{id}/orders',
        label: '/users/{id}/orders',
        children: [{ value: '/users/{id}/orders/{order}', label: '/users/{id}/orders/{order}' }],
      },
    ],
  },
  { value: '/settings', label: '/settings' },
]

const mounted = (host) => {
  mount(document.body, host)
  return host
}

const inner = (host, selector) => host.shadowRoot.querySelector(selector)

const innerAll = (host, selector) => [...host.shadowRoot.querySelectorAll(selector)]

const triggerOf = (host) => inner(host, '#control')

const searchOf = (host) => inner(host, '#search')

const isOpen = (host) => triggerOf(host).getAttribute('aria-expanded') === 'true'

const itemOf = (host, value) =>
  innerAll(host, '[role="treeitem"]').find((node) =>
    node.querySelector(':scope > .row .item-label').textContent === value
  )

const rowOf = (host, value) => itemOf(host, value).querySelector(':scope > .row')

const shownLabels = (host) =>
  innerAll(host, '[role="treeitem"]')
    .filter((node) => !node.closest('[hidden]'))
    .map((node) => node.querySelector(':scope > .row .item-label').textContent)

const focusedLabel = (host) =>
  host.shadowRoot.activeElement?.querySelector(':scope > .row .item-label')?.textContent ?? null

const invoke = (node) => {
  node.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, composed: true }))
  node.dispatchEvent(new MouseEvent('click', { bubbles: true, composed: true }))
}

const click = (node) => node.dispatchEvent(new MouseEvent('click', { bubbles: true }))

const press = (node, key) => {
  const event = new KeyboardEvent('keydown', {
    key,
    bubbles: true,
    composed: true,
    cancelable: true,
  })
  node.dispatchEvent(event)
  return event
}

const type = (input, text) => {
  input.value = text
  input.dispatchEvent(new Event('input', { bubbles: true }))
}

const warnings = () => spy(console, 'warn', () => {})

const warned = (warn, text) => warn.calls.some(([first]) => String(first).includes(text))

const stateHost = component('tree-select-state-host', {
  setup: (self, render) => render(self),
})

const withState = (initial, props = {}) => {
  let state
  const host = mounted(stateHost((self) => {
    state = initState(self, 'test.pages', initial)
    return treeSelect({ value: state, label: 'Pages', items: PAGES, ...props })
  }))
  return { state, picker: host.shadowRoot.querySelector('imp-tree-select') }
}

beforeEach(() => {
  document.body.replaceChildren()
  document.documentElement.setAttribute('lang', 'en')
})

test('treeSelect renders a labelled trigger that opens a dialog with a named tree', () => {
  const host = mounted(treeSelect({ label: 'Pages', items: PAGES, placeholder: 'All pages' }))
  expect(host.localName).toEqual('imp-tree-select')
  const trigger = triggerOf(host)
  expect(trigger.localName).toEqual('button')
  expect(trigger.getAttribute('aria-haspopup')).toEqual('dialog')
  expect(trigger.getAttribute('aria-expanded')).toEqual('false')
  expect(inner(host, 'label').getAttribute('for')).toEqual('control')
  expect(inner(host, 'label').textContent).toContain('Pages')
  expect(inner(host, '#value').textContent).toEqual('All pages')
  expect(trigger.getAttribute('aria-describedby')).toContain('value')
  const panel = inner(host, '#panel')
  expect(panel.getAttribute('popover')).toEqual('auto')
  expect(panel.getAttribute('role')).toEqual('dialog')
  const tree = inner(host, '[role="tree"]')
  expect(tree.getAttribute('aria-multiselectable')).toEqual('true')
  expect(tree.getAttribute('aria-labelledby')).toEqual('label')
  expect(inner(host, '#label').textContent).toContain('Pages')
  expect(searchOf(host).getAttribute('aria-label')).toEqual('Search')
  invoke(trigger)
  expect(isOpen(host)).toEqual(true)
  expect(host.shadowRoot.activeElement).toEqual(searchOf(host))
})

test('every row is a treeitem with a level, a name, a checked state, and parents expand', () => {
  const host = mounted(treeSelect({ label: 'Pages', items: PAGES }))
  const users = itemOf(host, '/users')
  expect(users.getAttribute('aria-level')).toEqual('1')
  expect(users.getAttribute('aria-expanded')).toEqual('true')
  expect(users.getAttribute('aria-checked')).toEqual('false')
  const label = host.shadowRoot.getElementById(users.getAttribute('aria-labelledby'))
  expect(label.textContent).toEqual('/users')
  const orders = itemOf(host, '/users/{id}/orders')
  expect(orders.getAttribute('aria-level')).toEqual('2')
  expect(itemOf(host, '/users/{id}/orders/{order}').getAttribute('aria-level')).toEqual('3')
  expect(itemOf(host, '/settings').hasAttribute('aria-expanded')).toEqual(false)
  expect(innerAll(host, '[role="group"]').length).toEqual(2)
  expect(shownLabels(host).length).toEqual(6)
})

test('a click on a parent cycles all, then only itself, then nothing', () => {
  const { state, picker } = withState([])
  const users = itemOf(picker, '/users')
  click(rowOf(picker, '/users'))
  expect(state.get()).toEqual([
    '/users',
    '/users/{id}/details',
    '/users/invites',
    '/users/{id}/orders',
    '/users/{id}/orders/{order}',
  ])
  expect(users.dataset.mark).toEqual('all')
  expect(users.getAttribute('aria-checked')).toEqual('true')
  expect(inner(picker, `#${users.getAttribute('aria-describedby')}`).textContent).toEqual(
    'Everything below is selected too',
  )
  expect(itemOf(picker, '/users/{id}/orders').dataset.mark).toEqual('all')
  expect(itemOf(picker, '/users/invites').dataset.mark).toEqual('checked')
  click(rowOf(picker, '/users'))
  expect(state.get()).toEqual(['/users'])
  expect(users.dataset.mark).toEqual('checked')
  expect(users.getAttribute('aria-checked')).toEqual('true')
  expect(inner(picker, `#${users.getAttribute('aria-describedby')}`).textContent).toEqual(
    'Only this item is selected',
  )
  expect(itemOf(picker, '/users/invites').getAttribute('aria-checked')).toEqual('false')
  click(rowOf(picker, '/users'))
  expect(state.get()).toEqual([])
  expect(users.dataset.mark).toEqual('none')
  expect(users.getAttribute('aria-checked')).toEqual('false')
})

test('a parent with some chosen descendants is mixed, and a click selects everything', () => {
  const { state, picker } = withState(['/users/invites'])
  const users = itemOf(picker, '/users')
  expect(users.dataset.mark).toEqual('mixed')
  expect(users.getAttribute('aria-checked')).toEqual('mixed')
  click(rowOf(picker, '/users'))
  expect(state.get().length).toEqual(5)
  expect(users.dataset.mark).toEqual('all')
})

test('a leaf toggles, and the value keeps the order of the tree', () => {
  const { state, picker } = withState([])
  click(rowOf(picker, '/settings'))
  click(rowOf(picker, '/users/invites'))
  expect(state.get()).toEqual(['/users/invites', '/settings'])
  expect(itemOf(picker, '/settings').getAttribute('aria-checked')).toEqual('true')
  click(rowOf(picker, '/settings'))
  expect(state.get()).toEqual(['/users/invites'])
  expect(itemOf(picker, '/users').dataset.mark).toEqual('mixed')
})

test('the trigger shows the placeholder, one label, or the first label and a count', () => {
  const { state, picker } = withState([], { placeholder: 'All pages' })
  const shown = () => inner(picker, '#value').textContent
  expect(shown()).toEqual('All pages')
  expect(inner(picker, '#value').classList.contains('placeholder')).toEqual(true)
  state.set(['/settings'])
  expect(shown()).toEqual('/settings')
  state.set(['/users', '/users/invites', '/settings'])
  expect(shown()).toEqual('/users +2')
  expect(inner(picker, '.count').textContent).toEqual('3 selected')
})

test('the search is a case-insensitive contains match that keeps the ancestors', () => {
  const host = mounted(treeSelect({ label: 'Pages', items: PAGES }))
  invoke(triggerOf(host))
  type(searchOf(host), 'ORDER')
  expect(shownLabels(host)).toEqual([
    '/users',
    '/users/{id}/orders',
    '/users/{id}/orders/{order}',
  ])
  expect(itemOf(host, '/users/{id}/orders').querySelector('mark').textContent).toEqual('order')
  type(searchOf(host), 'invites')
  expect(shownLabels(host)).toEqual(['/users', '/users/invites'])
  expect(inner(host, '.status').textContent).toEqual('')
  type(searchOf(host), 'nothing like this')
  expect(shownLabels(host)).toEqual([])
  expect(inner(host, '.status').textContent).toEqual('No matches')
  type(searchOf(host), '')
  expect(shownLabels(host).length).toEqual(6)
})

test('a filter shows the ancestors of a match expanded even when they were folded', () => {
  const host = mounted(treeSelect({ label: 'Pages', items: PAGES }))
  invoke(triggerOf(host))
  click(itemOf(host, '/users').querySelector('.toggle'))
  expect(itemOf(host, '/users').getAttribute('aria-expanded')).toEqual('false')
  expect(shownLabels(host)).toEqual(['/users', '/settings'])
  type(searchOf(host), 'details')
  expect(itemOf(host, '/users').getAttribute('aria-expanded')).toEqual('true')
  expect(shownLabels(host)).toEqual(['/users', '/users/{id}/details'])
})

test('the keyboard moves through the tree and applies the click cycle', () => {
  const { state, picker } = withState([])
  invoke(triggerOf(picker))
  const step = (key) => press(picker.shadowRoot.activeElement, key)
  step('ArrowDown')
  expect(focusedLabel(picker)).toEqual('/users')
  expect(itemOf(picker, '/users').tabIndex).toEqual(0)
  step('ArrowDown')
  expect(focusedLabel(picker)).toEqual('/users/{id}/details')
  step('ArrowLeft')
  expect(focusedLabel(picker)).toEqual('/users')
  step('ArrowLeft')
  expect(itemOf(picker, '/users').getAttribute('aria-expanded')).toEqual('false')
  step('ArrowDown')
  expect(focusedLabel(picker)).toEqual('/settings')
  step('Home')
  expect(focusedLabel(picker)).toEqual('/users')
  step('ArrowRight')
  expect(itemOf(picker, '/users').getAttribute('aria-expanded')).toEqual('true')
  step('ArrowRight')
  expect(focusedLabel(picker)).toEqual('/users/{id}/details')
  step('End')
  expect(focusedLabel(picker)).toEqual('/settings')
  step(' ')
  expect(state.get()).toEqual(['/settings'])
  step('Home')
  step('Enter')
  expect(state.get().length).toEqual(6)
  step('Enter')
  expect(state.get()).toEqual(['/users', '/settings'])
  step('ArrowUp')
  expect(picker.shadowRoot.activeElement).toEqual(searchOf(picker))
  expect(innerAll(picker, '[role="treeitem"][tabindex="0"]').length).toEqual(1)
})

test('in a right-to-left context ArrowLeft expands and ArrowRight collapses', () => {
  const host = mounted(treeSelect({ label: 'Pages', items: PAGES }))
  invoke(triggerOf(host))
  press(searchOf(host), 'ArrowDown')
  spy(globalThis, 'getComputedStyle', () => ({ direction: 'rtl' }))
  press(host.shadowRoot.activeElement, 'ArrowRight')
  expect(itemOf(host, '/users').getAttribute('aria-expanded')).toEqual('false')
  press(host.shadowRoot.activeElement, 'ArrowLeft')
  expect(itemOf(host, '/users').getAttribute('aria-expanded')).toEqual('true')
  press(host.shadowRoot.activeElement, 'ArrowLeft')
  expect(focusedLabel(host)).toEqual('/users/{id}/details')
})

test('Enter in the search moves into the tree and does not reach the form', () => {
  const host = mounted(treeSelect({ label: 'Pages', items: PAGES }))
  invoke(triggerOf(host))
  type(searchOf(host), 'settings')
  const event = press(searchOf(host), 'Enter')
  expect(event.defaultPrevented).toEqual(true)
  expect(focusedLabel(host)).toEqual('/settings')
})

test('ArrowDown on the trigger opens the panel, and Escape returns the focus', () => {
  const host = mounted(treeSelect({ label: 'Pages', items: PAGES }))
  triggerOf(host).focus()
  press(triggerOf(host), 'ArrowDown')
  expect(isOpen(host)).toEqual(true)
  expect(host.shadowRoot.activeElement).toEqual(searchOf(host))
  press(searchOf(host), 'ArrowDown')
  press(host.shadowRoot.activeElement, 'Escape')
  expect(isOpen(host)).toEqual(false)
  expect(host.shadowRoot.activeElement).toEqual(triggerOf(host))
})

test('the clear buttons empty the value, and required has no trigger clear button', () => {
  const { state, picker } = withState(['/settings'])
  const clearBox = inner(picker, '.clear')
  expect(clearBox.hidden).toEqual(false)
  clearBox.querySelector('imp-button').shadowRoot.querySelector('button').click()
  expect(state.get()).toEqual([])
  expect(clearBox.hidden).toEqual(true)
  const required = mounted(treeSelect({ label: 'Pages', items: PAGES, required: true }))
  expect(inner(required, '.clear')).toEqual(null)
  expect(triggerOf(required).getAttribute('aria-required')).toEqual('true')
})

test('items can be a state, and the tree follows it', () => {
  let items
  const host = mounted(stateHost((self) => {
    items = initState(self, 'test.items', [{ value: 'a', label: 'Alpha' }])
    return treeSelect({ label: 'Pages', items, value: ['b'] })
  }))
  const picker = host.shadowRoot.querySelector('imp-tree-select')
  expect(inner(picker, '#value').textContent).toEqual('b')
  items.set([{ value: 'a', label: 'Alpha' }, { value: 'b', label: 'Beta' }])
  expect(inner(picker, '#value').textContent).toEqual('Beta')
  expect(shownLabels(picker)).toEqual(['Alpha', 'Beta'])
})

test('a field inside a form reads and writes an array, and required validates it', () => {
  let values
  const reader = component('tree-select-reader', {
    setup: (self) => {
      values = useState(self, 'imp.form')
      return document.createTextNode('')
    },
  })
  const host = mounted(form(
    { initialValues: { pages: [] } },
    treeSelect({ field: 'pages', label: 'Pages', items: PAGES, required: true }),
    reader(),
  ))
  const picker = inner(host, 'imp-tree-select')
  click(rowOf(picker, '/settings'))
  expect(values.get().pages).toEqual(['/settings'])
  click(rowOf(picker, '/settings'))
  expect(values.get().pages).toEqual([])
  expect(triggerOf(picker).getAttribute('aria-invalid')).toEqual('true')
  expect(inner(picker, '.error').textContent.length > 0).toEqual(true)
})

test('a disabled treeSelect blocks the trigger and the click cycle', () => {
  const { state, picker } = withState(['/settings'], { disabled: true })
  expect(triggerOf(picker).disabled).toEqual(true)
  click(rowOf(picker, '/settings'))
  expect(state.get()).toEqual(['/settings'])
  expect(inner(picker, '.clear').hidden).toEqual(true)
})

test('treeSelect warns about bad items and continues', () => {
  const warn = warnings()
  const host = mounted(treeSelect({
    label: 'Pages',
    items: [{ value: 'a', label: 'A' }, { value: 'a', label: 'Again' }, { label: 'none' }],
  }))
  expect(warned(warn, "two items share the value 'a'")).toEqual(true)
  expect(warned(warn, "an item is not an object with a 'value'")).toEqual(true)
  expect(shownLabels(host)).toEqual(['A'])
})
