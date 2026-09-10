import { searchField } from 'imp/std/inputs'
import { groups } from '../preview-groups.js'

export const name = 'Search field'
export const group = groups.inputs

export const standalone = {
  scenario: 'Standalone',
  component: searchField({ ariaLabel: 'Search invoices', placeholder: 'Search...' }),
}
export const withLabel = {
  scenario: 'With a label',
  component: searchField({ label: 'Find an invoice', value: 'unpaid' }),
}
