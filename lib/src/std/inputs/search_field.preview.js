import { searchField } from 'imp/std/inputs'

export const standalone = searchField({ ariaLabel: 'Search invoices', placeholder: 'Search…' })
export const withLabel = searchField({ label: 'Find an invoice', value: 'unpaid' })
