import { component, mount } from 'imp'
import { steps } from 'imp/std/navigation'
import { beforeEach, expect, spy, test } from 'imp/test'
import { renderedText } from './shadow.js'
import { initState } from 'imp/state'

const stateHost = component('steps-state-host', { setup: (self, render) => render(self) })

const mounted = (host) => {
  mount(document.body, host)
  return host
}

const inner = (host, selector) => host.shadowRoot.querySelector(selector)

const all = (host, selector) => [...host.shadowRoot.querySelectorAll(selector)]

const click = (node) => node.dispatchEvent(new MouseEvent('click', { bubbles: true }))

const warnings = () => spy(console, 'warn', () => {})

const warned = (warn, text) => warn.calls.some(([first]) => String(first).includes(text))

const items = () => [
  { id: 'cart', label: 'Cart' },
  { id: 'address', label: 'Address', description: 'Where we ship to' },
  { id: 'payment', label: 'Payment' },
]

const phases = (host) =>
  all(host, 'li').map((step) =>
    ['done', 'current', 'upcoming'].find((phase) => step.classList.contains(phase))
  )

const stateWords = (host) => all(host, '.state').map(renderedText)

const shownMarks = (host) =>
  all(host, '.marker').map((marker) =>
    [...marker.children].filter((mark) => !mark.hidden).map((mark) => mark.localName)
  )

beforeEach(() => {
  document.body.replaceChildren()
})

test('steps renders an ordered list named by its label', () => {
  const host = mounted(steps({ label: 'Checkout', items: items(), current: 'address' }))
  expect(host.localName).toEqual('imp-steps')
  const list = inner(host, 'ol')
  expect(list.getAttribute('aria-label')).toEqual('Checkout')
  expect(list.getAttribute('role')).toEqual('list')
  expect([...list.children].map((step) => step.localName)).toEqual(['li', 'li', 'li'])
  expect(all(host, '.label').map(renderedText)).toEqual(['Cart', 'Address', 'Payment'])
  expect(renderedText(inner(host, '.description'))).toEqual('Where we ship to')
})

test('items before the current one are done, and items after it are upcoming', () => {
  const host = mounted(steps({ label: 'Checkout', items: items(), current: 'address' }))
  expect(phases(host)).toEqual(['done', 'current', 'upcoming'])
  expect(all(host, 'li').map((step) => step.getAttribute('aria-current'))).toEqual([
    null,
    'step',
    null,
  ])
})

test('a screen reader gets the state of each step in words', () => {
  const host = mounted(steps({ label: 'Checkout', items: items(), current: 'address' }))
  expect(stateWords(host)).toEqual(['Completed', 'Current', 'Upcoming'])
})

test('a done step shows a check, and every other step shows its number', () => {
  const host = mounted(steps({ label: 'Checkout', items: items(), current: 'address' }))
  expect(shownMarks(host)).toEqual([['imp-icon'], ['span'], ['span']])
  expect(all(host, '.number').map(renderedText)).toEqual(['1', '2', '3'])
  for (const marker of all(host, '.marker')) {
    expect(marker.getAttribute('aria-hidden')).toEqual('true')
  }
})

test('steps starts at the first item when there is no current', () => {
  const host = mounted(steps({ label: 'Checkout', items: items() }))
  expect(phases(host)).toEqual(['current', 'upcoming', 'upcoming'])
})

test('a live current moves the steps in place', () => {
  let current
  const outer = mounted(stateHost((self) => {
    current = initState(self, 'steps.current', 'cart')
    return steps({ label: 'Checkout', items: items(), current })
  }))
  const host = outer.shadowRoot.querySelector('imp-steps')
  const first = inner(host, 'li')
  expect(phases(host)).toEqual(['current', 'upcoming', 'upcoming'])
  current.set('payment')
  expect(phases(host)).toEqual(['done', 'done', 'current'])
  expect(stateWords(host)).toEqual(['Completed', 'Completed', 'Current'])
  expect(all(host, 'li')[2].getAttribute('aria-current')).toEqual('step')
  expect(inner(host, 'li')).toEqual(first)
})

test('without a select listener no step is a button', () => {
  const host = mounted(steps({ label: 'Checkout', items: items(), current: 'payment' }))
  expect(all(host, 'button').length).toEqual(0)
})

test('with a select listener a done step is a native button that reports its id', () => {
  const seen = []
  const host = mounted(steps({
    label: 'Checkout',
    items: items(),
    current: 'payment',
    events: { select: (event) => seen.push(event.detail) },
  }))
  const shown = all(host, 'button').filter((control) => !control.hidden)
  expect(shown.length).toEqual(2)
  expect(shown[0].getAttribute('type')).toEqual('button')
  expect(renderedText(shown[0])).toContain('Cart')
  expect(renderedText(shown[0])).toContain('Completed')
  click(shown[1])
  expect(seen).toEqual([{ id: 'address', index: 1 }])
})

test('the current step and an upcoming step are never an operable button', () => {
  let current
  const outer = mounted(stateHost((self) => {
    current = initState(self, 'steps.current', 'address')
    return steps({
      label: 'Checkout',
      items: items(),
      current,
      events: { select: () => {} },
    })
  }))
  const host = outer.shadowRoot.querySelector('imp-steps')
  const hiddenButtons = () => all(host, 'button').map((control) => control.hidden)
  expect(hiddenButtons()).toEqual([false, true, true])
  expect(all(host, 'button')[1].childNodes.length).toEqual(0)
  current.set('cart')
  expect(hiddenButtons()).toEqual([true, true, true])
  expect(renderedText(all(host, 'li')[0])).toContain('Cart')
})

test('a select event from a descendant does not reach the listener', () => {
  const seen = []
  const host = mounted(steps({
    label: 'Checkout',
    items: items(),
    current: 'payment',
    events: { select: (event) => seen.push(event.detail.id) },
  }))
  inner(host, '.label').dispatchEvent(
    new CustomEvent('select', { bubbles: true, composed: true, detail: { id: 'stray' } }),
  )
  expect(seen).toEqual([])
})

test('a failed step shows a cross and says Error', () => {
  const host = mounted(steps({
    label: 'Checkout',
    current: 'payment',
    items: items().map((item) => (item.id === 'payment' ? { ...item, status: 'error' } : item)),
  }))
  const failed = all(host, 'li')[2]
  expect(failed.classList.contains('error')).toBeTruthy()
  expect(stateWords(host)).toEqual(['Completed', 'Completed', 'Error'])
  expect(shownMarks(host)[2]).toEqual(['imp-icon'])
  expect(failed.querySelector('.marker').children[2].hidden).toEqual(false)
})

test('a live status marks and clears the failure', () => {
  let status
  const outer = mounted(stateHost((self) => {
    status = initState(self, 'steps.status', null)
    return steps({
      label: 'Checkout',
      current: 'cart',
      items: [{ id: 'cart', label: 'Cart', status }, { id: 'pay', label: 'Pay' }],
    })
  }))
  const host = outer.shadowRoot.querySelector('imp-steps')
  expect(stateWords(host)).toEqual(['Current', 'Upcoming'])
  status.set('error')
  expect(stateWords(host)).toEqual(['Error', 'Upcoming'])
  status.set(null)
  expect(stateWords(host)).toEqual(['Current', 'Upcoming'])
})

test('steps takes an orientation', () => {
  const list = inner(
    mounted(steps({ label: 'Checkout', items: items(), orientation: 'vertical' })),
    'ol',
  )
  expect(list.classList.contains('vertical')).toBeTruthy()
})

test('steps warns about bad props and keeps its defaults', () => {
  const warn = warnings()
  const host = mounted(
    steps({
      items: [...items(), { id: 'cart', label: 'Again' }, { id: 'none' }],
      current: 'shipping',
      orientation: 'diagonal',
      size: 'lg',
    }, 'child'),
  )
  expect(warned(warn, "'orientation' must be one of")).toBeTruthy()
  expect(warned(warn, "'current' is 'shipping'")).toBeTruthy()
  expect(warned(warn, "two items share the id 'cart'")).toBeTruthy()
  expect(warned(warn, "not an object with a 'label'")).toBeTruthy()
  expect(warned(warn, "needs a 'label'")).toBeTruthy()
  expect(warned(warn, 'takes no content')).toBeTruthy()
  expect(warned(warn, "unknown prop 'size'")).toBeTruthy()
  expect(inner(host, 'ol').classList.contains('horizontal')).toBeTruthy()
  expect(phases(host)).toEqual(['current', 'upcoming', 'upcoming', 'upcoming'])
})

test('an unknown item status is logged and ignored', () => {
  const warn = warnings()
  const host = mounted(steps({
    label: 'Checkout',
    items: [{ id: 'cart', label: 'Cart', status: 'warning' }],
  }))
  expect(warned(warn, "'status' must be 'error'")).toBeTruthy()
  expect(inner(host, 'li').classList.contains('error')).toEqual(false)
})
