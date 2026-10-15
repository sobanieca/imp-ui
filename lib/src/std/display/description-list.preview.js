import { descriptionList, tag } from 'imp/std/display'
import { link } from 'imp/std'
import { div } from 'imp/html'
import { groups } from '../preview-groups.js'

export const name = 'Description list'
export const group = groups.display

const invoiceItems = () => [
  { term: 'Customer', details: 'Acme Inc.' },
  { term: 'Invoice number', details: 'INV-2026-0142' },
  { term: 'Status', details: tag({ color: 'green', dot: true }, 'Paid') },
  { term: 'Issued', details: '21 September 2026' },
  {
    term: 'Contact',
    details: link({ href: 'mailto:billing@acme.example' }, 'billing@acme.example'),
  },
  {
    term: 'Notes',
    details: 'The customer pays by bank transfer. Send the reminder to the finance team only.',
  },
]

export const horizontal = {
  scenario: 'Horizontal',
  component: descriptionList({ items: invoiceItems() }),
}

export const vertical = {
  scenario: 'Vertical',
  component: descriptionList({ layout: 'vertical', items: invoiceItems() }),
}

export const twoColumns = {
  scenario: 'Two columns',
  component: descriptionList({ columns: 2, items: invoiceItems() }),
}

export const threeColumnsVertical = {
  scenario: 'Three columns, vertical',
  component: descriptionList({ columns: 3, layout: 'vertical', items: invoiceItems() }),
}

export const narrow = {
  scenario: 'In a narrow box',
  component: () =>
    div({ style: 'max-inline-size: 20rem' }, descriptionList({ items: invoiceItems() })),
}
