import { component } from 'imp'
import { luPencil } from 'imp/icons'
import { button, icon, menuButton, text } from 'imp/std'
import { flex } from 'imp/std/layout'
import { table } from 'imp/std/data'
import { tag } from 'imp/std/display'
import { textField } from 'imp/std/inputs'
import { stack } from 'imp/std/layout'
import { initState } from 'imp/state'
import { groups } from '../preview-groups.js'

export const name = 'Table'
export const group = groups.data

const CUSTOMERS = [
  'Northwind',
  'Acme Rail',
  'Blue Harbor',
  'Cobalt Labs',
  'Delta Foods',
  'Evergreen',
]

const STATUSES = ['Paid', 'Open', 'Overdue']

const STATUS_COLORS = { Paid: 'green', Open: 'blue', Overdue: 'red' }

const invoice = (index) => ({
  id: `inv-${index}`,
  number: `INV-${1000 + index}`,
  customer: CUSTOMERS[index % CUSTOMERS.length],
  total: 120 + ((index * 337) % 4200),
  status: STATUSES[index % STATUSES.length],
})

const invoices = (count, from = 0) =>
  Array.from({ length: count }, (_, step) => invoice(from + step))

const money = (amount) =>
  new Intl.NumberFormat('en', { style: 'currency', currency: 'EUR' }).format(amount)

const plainColumns = () => [
  { key: 'number', label: 'Number' },
  { key: 'customer', label: 'Customer' },
  { key: 'total', label: 'Total', align: 'end', render: (row) => money(row.total) },
  { key: 'status', label: 'Status' },
]

const sortableColumns = () => [
  { key: 'number', label: 'Number', sortable: true },
  { key: 'customer', label: 'Customer', sortable: true },
  { key: 'total', label: 'Total', align: 'end', sortable: true, render: (row) => money(row.total) },
  { key: 'status', label: 'Status', sortable: true },
]

export const basic = {
  scenario: 'Basic',
  component: table({ label: 'Invoices', columns: plainColumns(), rows: invoices(6) }),
}

export const sortable = {
  scenario: 'Sortable',
  component: table({ label: 'Invoices', columns: sortableColumns(), rows: invoices(8) }),
}

export const selection = {
  scenario: 'Selection',
  component: component('table-selection-demo', {
    setup: (self) => {
      const selected = initState(self, 'demo.table.selected', ['inv-1'])
      return stack(
        { gap: 3 },
        table({
          label: 'Invoices',
          columns: sortableColumns(),
          rows: invoices(6),
          selection: 'multiple',
          selected,
        }),
        text(
          { tone: 'secondary', size: 'sm' },
          selected.text((keys) => `Selected: ${keys.join(', ')}`),
        ),
      )
    },
  })(),
}

export const singleSelection = {
  scenario: 'Single selection',
  component: table({
    label: 'Invoices',
    columns: plainColumns(),
    rows: invoices(5),
    selection: 'single',
    selected: ['inv-2'],
  }),
}

export const filtered = {
  scenario: 'Filter from a search field',
  component: component('table-filter-demo', {
    setup: (self) => {
      const query = initState(self, 'demo.table.query', '')
      return stack(
        { gap: 3 },
        textField({
          type: 'search',
          value: query,
          ariaLabel: 'Filter the invoices',
          placeholder: 'Filter',
        }),
        table({ label: 'Invoices', columns: sortableColumns(), rows: invoices(12), filter: query }),
      )
    },
  })(),
}

export const infiniteScroll = {
  scenario: 'Infinite scroll',
  component: component('table-scroll-demo', {
    setup: (self) => {
      const rows = initState(self, 'demo.table.rows', invoices(20))
      const hasMore = initState(self, 'demo.table.more', true)
      const onLoadMore = async () => {
        await new Promise((resolve) => setTimeout(resolve, 900))
        rows.set((loaded) => [...loaded, ...invoices(20, loaded.length)])
        hasMore.set(rows.get().length < 100)
      }
      const host = table({
        label: 'Invoices',
        columns: sortableColumns(),
        rows,
        hasMore,
        onLoadMore,
      })
      host.style.setProperty('--imp-table-max-block-size', '22rem')
      return host
    },
  })(),
}

export const customCells = {
  scenario: 'Custom cells',
  component: table({
    label: 'Invoices',
    columns: [
      { key: 'number', label: 'Number', sortable: true },
      { key: 'customer', label: 'Customer', sortable: true },
      {
        key: 'total',
        label: 'Total',
        align: 'end',
        sortable: true,
        render: (row) => money(row.total),
      },
      {
        key: 'status',
        label: 'Status',
        sortable: true,
        render: (row) => tag({ color: STATUS_COLORS[row.status], size: 'sm' }, row.status),
      },
      {
        key: 'actions',
        label: 'Actions',
        align: 'end',
        render: (row) =>
          flex(
            { joined: true },
            button(
              { size: 'sm', square: true, label: `Edit ${row.number}` },
              icon(luPencil, { size: 'sm' }),
            ),
            menuButton({
              size: 'sm',
              label: `Actions for ${row.number}`,
              items: [{ id: 'copy', label: 'Duplicate' }, { id: 'void', label: 'Void' }],
            }),
          ),
      },
    ],
    rows: invoices(6),
  }),
}

export const empty = {
  scenario: 'Empty',
  component: table({ label: 'Invoices', columns: plainColumns(), rows: [] }),
}
