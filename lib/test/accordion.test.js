import { component, mount } from 'imp'
import { accordion } from 'imp/std/display'
import { button } from 'imp/std'
import { beforeEach, expect, spy, test } from 'imp/test'
import { renderedText } from './shadow.js'
import { initState } from 'imp/state'

const stateHost = component('accordion-state-host', { setup: (self, render) => render(self) })

const mounted = (host) => {
  mount(document.body, host)
  return host
}

const inner = (host, selector) => host.shadowRoot.querySelector(selector)

const all = (host, selector) => [...host.shadowRoot.querySelectorAll(selector)]

const warnings = () => spy(console, 'warn', () => {})

const warned = (warn, text) => warn.calls.some(([first]) => String(first).includes(text))

const items = () => [
  { id: 'shipping', title: 'Shipping', content: 'Two working days.', open: true },
  { id: 'returns', title: 'Returns', content: 'Send it back within 30 days.' },
  { id: 'warranty', title: 'Warranty', content: button('Read the terms') },
]

const setOpen = (section, open) => {
  section.open = open
  section.dispatchEvent(new Event('toggle'))
}

beforeEach(() => {
  document.body.replaceChildren()
})

test('accordion renders native details with a summary per item', () => {
  const host = mounted(accordion({ items: items() }))
  expect(host.localName).toEqual('imp-accordion')
  const sections = all(host, 'details')
  expect(sections.length).toEqual(3)
  for (const section of sections) {
    expect(section.firstElementChild.localName).toEqual('summary')
  }
  expect(renderedText(sections[0].querySelector('.title'))).toEqual('Shipping')
  expect(renderedText(sections[1].querySelector('.content'))).toEqual(
    'Send it back within 30 days.',
  )
  expect(sections[2].querySelector('.content imp-button')).toBeTruthy()
})

test('accordion opens the items that say so, once, at mount', () => {
  const host = mounted(accordion({ items: items() }))
  expect(all(host, 'details').map((section) => section.hasAttribute('open'))).toEqual([
    true,
    false,
    false,
  ])
})

test('an exclusive accordion shares one native name between its details', () => {
  const host = mounted(accordion({ items: items() }))
  const names = all(host, 'details').map((section) => section.getAttribute('name'))
  expect(names[0]).toBeTruthy()
  expect(new Set(names).size).toEqual(1)
})

test('a multiple accordion has no name, so every section opens on its own', () => {
  const host = mounted(accordion({
    multiple: true,
    items: items().map((item) => ({ ...item, open: true })),
  }))
  const sections = all(host, 'details')
  expect(sections.map((section) => section.hasAttribute('name'))).toEqual([false, false, false])
  expect(sections.map((section) => section.hasAttribute('open'))).toEqual([true, true, true])
})

test('an exclusive accordion keeps only the first open item and says so', () => {
  const warn = warnings()
  const host = mounted(accordion({ items: items().map((item) => ({ ...item, open: true })) }))
  expect(all(host, 'details').map((section) => section.hasAttribute('open'))).toEqual([
    true,
    false,
    false,
  ])
  expect(warned(warn, "more than one item is 'open'")).toBeTruthy()
})

test('the chevron is decoration, so the summary is named by its title', () => {
  const host = mounted(accordion({ items: items() }))
  const summary = inner(host, 'summary')
  const drawing = summary.querySelector('imp-icon').shadowRoot.querySelector('svg')
  expect(drawing.getAttribute('aria-hidden')).toEqual('true')
  expect(renderedText(summary)).toEqual('Shipping')
})

test('accordion reports a toggle on the host with the id and the open state', () => {
  const seen = []
  const host = mounted(
    accordion({ items: items(), events: { toggle: (event) => seen.push(event.detail) } }),
  )
  const sections = all(host, 'details')
  sections[0].dispatchEvent(new Event('toggle'))
  expect(seen).toEqual([])
  setOpen(sections[1], true)
  setOpen(sections[0], false)
  expect(seen).toEqual([{ id: 'returns', open: true }, { id: 'shipping', open: false }])
})

test('a toggle from an accordion inside a section does not reach the outer listener', () => {
  const seen = []
  const nested = accordion({ items: [{ id: 'inner', title: 'Inner', content: 'Deep.' }] })
  const host = mounted(accordion({
    items: [{ id: 'outer', title: 'Outer', content: nested, open: true }],
    events: { toggle: (event) => seen.push(event.detail.id) },
  }))
  setOpen(inner(nested, 'details'), true)
  expect(seen).toEqual([])
  setOpen(inner(host, 'details'), false)
  expect(seen).toEqual(['outer'])
})

test('a live title updates the summary in place', () => {
  let title
  const outer = mounted(stateHost((self) => {
    title = initState(self, 'accordion.title', 'Shipping')
    return accordion({ items: [{ id: 'shipping', title, content: 'Two working days.' }] })
  }))
  const host = outer.shadowRoot.querySelector('imp-accordion')
  const summary = inner(host, 'summary')
  title.set('Delivery')
  expect(renderedText(summary)).toEqual('Delivery')
  expect(inner(host, 'summary')).toEqual(summary)
})

test('an item without an id takes its index', () => {
  const seen = []
  const host = mounted(accordion({
    items: [{ title: 'First', content: 'One.' }],
    events: { toggle: (event) => seen.push(event.detail.id) },
  }))
  setOpen(inner(host, 'details'), true)
  expect(seen).toEqual(['0'])
})

test('accordion warns about bad items, content and an unknown prop', () => {
  const warn = warnings()
  const host = mounted(accordion({ items: [{ content: 'No title.' }], animated: true }, 'child'))
  expect(all(host, 'details').length).toEqual(0)
  expect(warned(warn, "not an object with a 'title'")).toBeTruthy()
  expect(warned(warn, 'takes no content')).toBeTruthy()
  expect(warned(warn, "unknown prop 'animated'")).toBeTruthy()
  mounted(accordion({ items: 'shipping' }))
  expect(warned(warn, "'items' must be an array")).toBeTruthy()
})
