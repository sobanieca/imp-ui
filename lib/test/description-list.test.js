import { component, mount } from 'imp'
import { descriptionList, tag } from 'imp/std/display'
import { beforeEach, expect, spy, test } from 'imp/test'
import { renderedText } from './shadow.js'
import { initState } from 'imp/state'

const stateHost = component('description-list-state-host', {
  setup: (self, render) => render(self),
})

const mounted = (host) => {
  mount(document.body, host)
  return host
}

const inner = (host, selector) => host.shadowRoot.querySelector(selector)

const all = (host, selector) => [...host.shadowRoot.querySelectorAll(selector)]

const warnings = () => spy(console, 'warn', () => {})

const warned = (warn, text) => warn.calls.some(([first]) => String(first).includes(text))

const items = () => [
  { term: 'Customer', details: 'Acme Inc.' },
  { term: 'Status', details: tag({ color: 'green' }, 'Paid') },
  { term: 'Seats', details: 12 },
]

beforeEach(() => {
  document.body.replaceChildren()
})

test('descriptionList renders a real dl with a group of dt and dd per item', () => {
  const host = mounted(descriptionList({ items: items() }))
  expect(host.localName).toEqual('imp-description-list')
  const list = inner(host, 'dl')
  expect([...list.children].map((group) => group.localName)).toEqual(['div', 'div', 'div'])
  for (const group of list.children) {
    expect([...group.children].map((part) => part.localName)).toEqual(['dt', 'dd'])
  }
  expect(all(host, 'dt').map(renderedText)).toEqual(['Customer', 'Status', 'Seats'])
  expect(renderedText(all(host, 'dd')[0])).toEqual('Acme Inc.')
  expect(renderedText(all(host, 'dd')[2])).toEqual('12')
})

test('descriptionList takes a component as the details', () => {
  const host = mounted(descriptionList({ items: items() }))
  const pill = all(host, 'dd')[1].querySelector('imp-tag')
  expect(renderedText(pill)).toEqual('Paid')
})

test('descriptionList takes an array of parts as the details', () => {
  const host = mounted(descriptionList({
    items: [{ term: 'Labels', details: [tag('Draft'), tag('Internal')] }],
  }))
  expect(inner(host, 'dd').querySelectorAll('imp-tag').length).toEqual(2)
})

test('descriptionList is horizontal with one column by default', () => {
  const list = inner(mounted(descriptionList({ items: items() })), 'dl')
  expect(list.classList.contains('horizontal')).toBeTruthy()
  expect(list.classList.contains('columns-1')).toBeTruthy()
})

test('descriptionList takes a layout and a number of columns', () => {
  const list = inner(
    mounted(descriptionList({ items: items(), layout: 'vertical', columns: 3 })),
    'dl',
  )
  expect(list.classList.contains('vertical')).toBeTruthy()
  expect(list.classList.contains('columns-3')).toBeTruthy()
})

test('live details and a live term update the text in place', () => {
  let notes
  let term
  const outer = mounted(stateHost((self) => {
    notes = initState(self, 'descriptionList.notes', 'Pays by card')
    term = initState(self, 'descriptionList.term', 'Notes')
    return descriptionList({ items: [{ term, details: notes }] })
  }))
  const host = outer.shadowRoot.querySelector('imp-description-list')
  const details = inner(host, 'dd')
  expect(renderedText(details)).toEqual('Pays by card')
  notes.set('Pays by bank transfer')
  term.set('Remarks')
  expect(renderedText(details)).toEqual('Pays by bank transfer')
  expect(renderedText(inner(host, 'dt'))).toEqual('Remarks')
  expect(inner(host, 'dd')).toEqual(details)
})

test('missing details leave an empty dd', () => {
  const host = mounted(descriptionList({ items: [{ term: 'Phone' }] }))
  expect(renderedText(inner(host, 'dd'))).toEqual('')
})

test('descriptionList warns about a bad layout, bad columns and bad items', () => {
  const warn = warnings()
  const host = mounted(
    descriptionList({ layout: 'grid', columns: 5, items: [{ details: 'No term' }, null] }, 'child'),
  )
  const list = inner(host, 'dl')
  expect(warned(warn, "'layout' must be one of")).toBeTruthy()
  expect(warned(warn, "'columns' must be one of")).toBeTruthy()
  expect(warned(warn, "not an object with a 'term'")).toBeTruthy()
  expect(warned(warn, 'takes no content')).toBeTruthy()
  expect(list.classList.contains('horizontal')).toBeTruthy()
  expect(list.classList.contains('columns-1')).toBeTruthy()
  expect(list.children.length).toEqual(0)
  mounted(descriptionList({ items: 'Customer' }))
  expect(warned(warn, "'items' must be an array")).toBeTruthy()
})

test('descriptionList warns about an unknown prop', () => {
  const warn = warnings()
  mounted(descriptionList({ items: items(), bordered: true }))
  expect(warned(warn, "unknown prop 'bordered'")).toBeTruthy()
})
