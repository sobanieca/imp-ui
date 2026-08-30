import { searchField } from 'imp/std/inputs'

export const name = 'Search field'
export const category = 'Inputs'
export const description =
  "Run 'imp skill std/searchField' to learn what searchField can do before using it."

export const standalone = searchField({ ariaLabel: 'Search invoices', placeholder: 'Search...' })
export const withLabel = searchField({ label: 'Find an invoice', value: 'unpaid' })
