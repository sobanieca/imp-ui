import { component, mount } from 'imp'
import { table } from 'imp/std/data'
import { tag } from 'imp/std/display'
import { afterEach, beforeEach, expect, spy, test } from 'imp/test'
import { initState } from 'imp/state'
import { renderedText, settled } from './shadow.js'

const stateHost = component('table-state-host', { setup: (self, render) => render(self) })

const mounted = (host) => {
  mount(document.body, host)
  return host
}

const shadow = (host, selector) => host.shadowRoot.querySelector(selector)

const all = (host, selector) => [...host.shadowRoot.querySelectorAll(selector)]

const click = (node) =>
  node.dispatchEvent(new MouseEvent('click', { bubbles: true, composed: true }))

const warnings = () => spy(console, 'warn', () => {})

const warned = (warn, text) => warn.calls.some(([first]) => String(first).includes(text))

const invoices = () => [
  { id: 'a', number: 'INV-10', customer: 'Zeta', total: 900 },
  { id: 'b', number: 'INV-9', customer: 'alpha', total: 1200 },
  { id: 'c', number: 'INV-100', customer: 'Midas', total: 50 },
]

const columns = () => [
  { key: 'number', label: 'Number', sortable: true },
  { key: 'customer', label: 'Customer', sortable: true },
  { key: 'total', label: 'Total', align: 'end', sortable: true },
]

const bodyRows = (host) => all(host, 'tbody.rows tr')

const cellTexts = (host, index) =>
  bodyRows(host).map((row) => renderedText(row.querySelectorAll('td')[index]))

const pickers = (host) => all(host, 'tbody.rows input')

const observers = []

class ObserverStub {
  constructor(callback) {
    this.callback = callback
    this.targets = new Set()
    this.disconnected = false
    observers.push(this)
  }

  observe(target) {
    this.targets.add(target)
  }

  unobserve(target) {
    this.targets.delete(target)
  }

  disconnect() {
    this.disconnected = true
    this.targets.clear()
  }

  show(isIntersecting = true) {
    this.callback([...this.targets].map((target) => ({ target, isIntersecting })))
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

test('table renders real table markup with a caption and column headers', () => {
  const host = mounted(table({ label: 'Invoices', columns: columns(), rows: invoices() }))
  expect(host.localName).toEqual('imp-table')
  expect(renderedText(shadow(host, 'caption'))).toEqual('Invoices')
  const headers = all(host, 'thead th')
  expect(headers.map((header) => header.getAttribute('scope'))).toEqual(['col', 'col', 'col'])
  expect(headers.map((header) => renderedText(header))).toEqual(['Number', 'Customer', 'Total'])
  expect(bodyRows(host).length).toEqual(3)
  expect(cellTexts(host, 1)).toEqual(['Zeta', 'alpha', 'Midas'])
})

test('table sits in a labelled region that the keyboard can scroll', () => {
  const host = mounted(table({ label: 'Invoices', columns: columns(), rows: invoices() }))
  const region = shadow(host, '.region')
  expect(region.getAttribute('role')).toEqual('region')
  expect(region.getAttribute('aria-label')).toEqual('Invoices')
  expect(region.tabIndex).toEqual(0)
})

test('table writes the column label on every cell for the stacked layout', () => {
  const host = mounted(table({ label: 'Invoices', columns: columns(), rows: invoices() }))
  const cells = [...bodyRows(host)[0].querySelectorAll('td')]
  expect(cells.map((cell) => cell.getAttribute('data-label'))).toEqual([
    'Number',
    'Customer',
    'Total',
  ])
  expect(cells[2].classList.contains('align-end')).toEqual(true)
})

test('table warns about a missing label and about an unknown selection', () => {
  const warn = warnings()
  mounted(table({ columns: columns(), rows: invoices(), selection: 'many' }))
  expect(warned(warn, `pass a 'label'`)).toEqual(true)
  expect(warned(warn, `'selection' must be one of`)).toEqual(true)
})

test('table warns about a row with no key and skips it', () => {
  const warn = warnings()
  const host = mounted(
    table({ label: 'Invoices', columns: columns(), rows: [{ number: 'INV-1' }, ...invoices()] }),
  )
  expect(warned(warn, `has no 'id'`)).toEqual(true)
  expect(bodyRows(host).length).toEqual(3)
})

test('table sorts through a real button and cycles ascending, descending, none', () => {
  const host = mounted(table({ label: 'Invoices', columns: columns(), rows: invoices() }))
  const header = all(host, 'thead th')[1]
  const button = header.querySelector('button')
  expect(button.type).toEqual('button')
  expect(header.hasAttribute('aria-sort')).toEqual(false)
  click(button)
  expect(header.getAttribute('aria-sort')).toEqual('ascending')
  expect(cellTexts(host, 1)).toEqual(['alpha', 'Midas', 'Zeta'])
  click(button)
  expect(header.getAttribute('aria-sort')).toEqual('descending')
  expect(cellTexts(host, 1)).toEqual(['Zeta', 'Midas', 'alpha'])
  click(button)
  expect(header.hasAttribute('aria-sort')).toEqual(false)
  expect(cellTexts(host, 1)).toEqual(['Zeta', 'alpha', 'Midas'])
})

test('table compares numbers as numbers and text with numeric collation', () => {
  const host = mounted(table({ label: 'Invoices', columns: columns(), rows: invoices() }))
  click(all(host, 'thead th')[2].querySelector('button'))
  expect(cellTexts(host, 2)).toEqual(['50', '900', '1200'])
  click(all(host, 'thead th')[0].querySelector('button'))
  expect(cellTexts(host, 0)).toEqual(['INV-9', 'INV-10', 'INV-100'])
  expect(all(host, 'thead th')[2].hasAttribute('aria-sort')).toEqual(false)
})

test('table sorts by sortValue when the column gives one', () => {
  const host = mounted(table({
    label: 'Invoices',
    columns: [{
      key: 'customer',
      label: 'Customer',
      sortable: true,
      sortValue: (row) => row.customer.length,
    }],
    rows: invoices(),
  }))
  click(shadow(host, 'thead button'))
  expect(cellTexts(host, 0)).toEqual(['Zeta', 'alpha', 'Midas'])
})

test('table reports sort and leaves the order alone when the event is cancelled', () => {
  const sorts = []
  const host = mounted(table({
    label: 'Invoices',
    columns: columns(),
    rows: invoices(),
    events: {
      sort: (event) => {
        sorts.push(event.detail)
        event.preventDefault()
      },
    },
  }))
  click(all(host, 'thead th')[1].querySelector('button'))
  expect(sorts).toEqual([{ key: 'customer', direction: 'ascending' }])
  expect(all(host, 'thead th')[1].getAttribute('aria-sort')).toEqual('ascending')
  expect(cellTexts(host, 1)).toEqual(['Zeta', 'alpha', 'Midas'])
})

test('table renders a custom cell and keeps the plain text elsewhere', () => {
  const host = mounted(table({
    label: 'Invoices',
    columns: [
      { key: 'number', label: 'Number' },
      {
        key: 'customer',
        label: 'Customer',
        render: (row) => tag({ color: 'green' }, row.customer),
      },
    ],
    rows: invoices(),
  }))
  const cell = bodyRows(host)[0].querySelectorAll('td')[1]
  expect(cell.querySelector('imp-tag') !== null).toEqual(true)
  expect(renderedText(cell)).toEqual('Zeta')
})

test('table filters the rows live and shows the no results state', () => {
  let query
  const outer = mounted(stateHost((self) => {
    query = initState(self, 'test.table.query', '')
    return table({ label: 'Invoices', columns: columns(), rows: invoices(), filter: query })
  }))
  const host = outer.shadowRoot.querySelector('imp-table')
  expect(bodyRows(host).length).toEqual(3)
  query.set('ALP')
  expect(cellTexts(host, 1)).toEqual(['alpha'])
  expect(shadow(host, 'tbody.empty').hidden).toEqual(true)
  query.set('nothing matches')
  expect(bodyRows(host).length).toEqual(0)
  expect(shadow(host, 'tbody.empty').hidden).toEqual(false)
  expect(renderedText(shadow(host, 'tbody.empty'))).toEqual('No results')
  query.set('')
  expect(bodyRows(host).length).toEqual(3)
  expect(shadow(host, 'tbody.empty').hidden).toEqual(true)
})

test('table shows the empty state in a full-width cell when there are no rows', () => {
  const host = mounted(table({ label: 'Invoices', columns: columns(), rows: [] }))
  const cell = shadow(host, 'tbody.empty td')
  expect(cell.getAttribute('colspan')).toEqual('3')
  expect(renderedText(cell)).toEqual('Nothing here yet')
})

test('table keeps the row nodes of unchanged rows on a live update', () => {
  let rows
  const outer = mounted(stateHost((self) => {
    rows = initState(self, 'test.table.rows', invoices())
    return table({ label: 'Invoices', columns: columns(), rows })
  }))
  const host = outer.shadowRoot.querySelector('imp-table')
  const [first, second] = bodyRows(host)
  rows.set((loaded) => [
    loaded[0],
    { ...loaded[1], customer: 'Beta' },
    loaded[2],
    { id: 'd', number: 'INV-7', customer: 'Delta', total: 5 },
  ])
  const next = bodyRows(host)
  expect(next.length).toEqual(4)
  expect(next[0] === first).toEqual(true)
  expect(next[1] === second).toEqual(false)
  expect(cellTexts(host, 1)).toEqual(['Zeta', 'Beta', 'Midas', 'Delta'])
})

test('table selects many rows through named checkboxes and writes the state', () => {
  let selected
  const chosen = []
  const outer = mounted(stateHost((self) => {
    selected = initState(self, 'test.table.selected', ['b'])
    return table({
      label: 'Invoices',
      columns: columns(),
      rows: invoices(),
      selection: 'multiple',
      selected,
      events: { rowSelect: (event) => chosen.push(event.detail) },
    })
  }))
  const host = outer.shadowRoot.querySelector('imp-table')
  const boxes = pickers(host)
  expect(boxes.map((box) => box.type)).toEqual(['checkbox', 'checkbox', 'checkbox'])
  expect(boxes[0].getAttribute('aria-label')).toEqual('Select row INV-10')
  expect(boxes.map((box) => box.checked)).toEqual([false, true, false])
  expect(bodyRows(host).map((row) => row.getAttribute('aria-selected'))).toEqual([
    'false',
    'true',
    'false',
  ])
  boxes[0].checked = true
  boxes[0].dispatchEvent(new Event('change', { bubbles: true }))
  expect(selected.get()).toEqual(['b', 'a'])
  expect(chosen).toEqual([{ key: 'a', row: invoices()[0], selected: true }])
  selected.set(['c'])
  expect(pickers(host).map((box) => box.checked)).toEqual([false, false, true])
  expect(chosen.length).toEqual(1)
})

test('table select all covers the rows that show and reports a partial choice', () => {
  let selected
  const outer = mounted(stateHost((self) => {
    selected = initState(self, 'test.table.all', ['a'])
    return table({
      label: 'Invoices',
      columns: columns(),
      rows: invoices(),
      selection: 'multiple',
      selected,
    })
  }))
  const host = outer.shadowRoot.querySelector('imp-table')
  const everything = shadow(host, 'thead input')
  expect(renderedText(everything.closest('label'))).toEqual('Select all rows')
  expect(everything.indeterminate).toEqual(true)
  expect(everything.checked).toEqual(false)
  everything.checked = true
  everything.dispatchEvent(new Event('change', { bubbles: true }))
  expect(selected.get()).toEqual(['a', 'b', 'c'])
  expect(everything.indeterminate).toEqual(false)
  everything.checked = false
  everything.dispatchEvent(new Event('change', { bubbles: true }))
  expect(selected.get()).toEqual([])
})

test('table single selection uses one radio group and keeps one row', () => {
  const host = mounted(
    table({ label: 'Invoices', columns: columns(), rows: invoices(), selection: 'single' }),
  )
  const radios = pickers(host)
  expect(radios.map((radio) => radio.type)).toEqual(['radio', 'radio', 'radio'])
  expect(new Set(radios.map((radio) => radio.name)).size).toEqual(1)
  expect(shadow(host, 'thead input')).toEqual(null)
  click(bodyRows(host)[0].querySelectorAll('td')[1])
  click(bodyRows(host)[2].querySelectorAll('td')[1])
  expect(bodyRows(host).map((row) => row.getAttribute('aria-selected'))).toEqual([
    'false',
    'false',
    'true',
  ])
  expect(pickers(host).map((radio) => radio.checked)).toEqual([false, false, true])
})

test('table does not select a row from a click on a control inside it', () => {
  const host = mounted(table({
    label: 'Invoices',
    columns: [{
      key: 'number',
      label: 'Number',
      render: (row) => {
        const open = document.createElement('button')
        open.textContent = row.number
        return open
      },
    }],
    rows: invoices(),
    selection: 'multiple',
  }))
  click(bodyRows(host)[0].querySelector('button'))
  expect(bodyRows(host)[0].getAttribute('aria-selected')).toEqual('false')
})

test('table loads more rows when the sentinel shows and marks the region busy', async () => {
  let rows
  let hasMore
  let finish
  const loads = []
  const outer = mounted(stateHost((self) => {
    rows = initState(self, 'test.table.more.rows', invoices())
    hasMore = initState(self, 'test.table.more.flag', true)
    return table({
      label: 'Invoices',
      columns: columns(),
      rows,
      hasMore,
      onLoadMore: () => {
        loads.push(rows.get().length)
        return new Promise((resolve) => {
          finish = resolve
        })
      },
    })
  }))
  const host = outer.shadowRoot.querySelector('imp-table')
  const region = shadow(host, '.region')
  expect(observers.length).toEqual(1)
  expect(region.getAttribute('aria-busy')).toEqual('false')
  observers[0].show()
  await settled()
  expect(loads).toEqual([3])
  expect(region.getAttribute('aria-busy')).toEqual('true')
  expect(shadow(host, '[role="status"]').hidden).toEqual(false)
  observers[0].show()
  await settled()
  expect(loads).toEqual([3])
  rows.set((loaded) => [...loaded, { id: 'd', number: 'INV-7', customer: 'Delta', total: 5 }])
  hasMore.set(false)
  finish()
  await settled()
  expect(region.getAttribute('aria-busy')).toEqual('false')
  expect(shadow(host, '[role="status"]').hidden).toEqual(true)
  expect(bodyRows(host).length).toEqual(4)
  observers[0].show()
  await settled()
  expect(loads).toEqual([3])
})

test('table logs a failed load and loads again from the retry button', async () => {
  const errors = spy(console, 'error', () => {})
  let attempts = 0
  const host = mounted(table({
    label: 'Invoices',
    columns: columns(),
    rows: invoices(),
    hasMore: true,
    onLoadMore: () => {
      attempts++
      return attempts === 1 ? Promise.reject(new Error('offline')) : Promise.resolve()
    },
  }))
  observers[0].show()
  await settled()
  expect(errors.calls.some(([first]) => String(first).includes(`'onLoadMore' rejected`))).toEqual(
    true,
  )
  const failed = shadow(host, '[role="alert"]')
  expect(failed.hidden).toEqual(false)
  observers[0].show()
  await settled()
  expect(attempts).toEqual(1)
  click(failed.querySelector('imp-button').shadowRoot.querySelector('button'))
  await settled()
  expect(attempts).toEqual(2)
  expect(failed.hidden).toEqual(true)
})

test('table stops observing when it leaves the page', async () => {
  const host = mounted(table({
    label: 'Invoices',
    columns: columns(),
    rows: invoices(),
    hasMore: true,
    onLoadMore: () => Promise.resolve(),
  }))
  host.remove()
  await settled()
  expect(observers[0].disconnected).toEqual(true)
})

test('table warns about hasMore with no onLoadMore', () => {
  const warn = warnings()
  mounted(table({ label: 'Invoices', columns: columns(), rows: invoices(), hasMore: true }))
  expect(warned(warn, `'hasMore' needs an 'onLoadMore'`)).toEqual(true)
  expect(observers.length).toEqual(0)
})
