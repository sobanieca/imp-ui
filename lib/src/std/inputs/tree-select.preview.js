import { form, submitForm, treeSelect } from 'imp/std/inputs'
import { button } from 'imp/std'
import { groups } from '../preview-groups.js'

export const name = 'Tree select'
export const group = groups.inputs

const PAGES = [
  { value: '/', label: '/' },
  {
    value: '/users',
    label: '/users',
    children: [
      { value: '/users/{id}/details', label: '/users/{id}/details' },
      { value: '/users/invites', label: '/users/invites' },
      {
        value: '/users/{id}/orders',
        label: '/users/{id}/orders',
        children: [
          { value: '/users/{id}/orders/{order}', label: '/users/{id}/orders/{order}' },
          { value: '/users/{id}/orders/returns', label: '/users/{id}/orders/returns' },
        ],
      },
    ],
  },
  {
    value: '/reports',
    label: '/reports',
    children: [
      { value: '/reports/traffic', label: '/reports/traffic' },
      { value: '/reports/errors', label: '/reports/errors' },
    ],
  },
  {
    value: '/settings',
    label: '/settings',
    children: [
      { value: '/settings/billing', label: '/settings/billing' },
      { value: '/settings/team', label: '/settings/team' },
    ],
  },
]

export const pages = {
  scenario: 'Pages of an app',
  component: treeSelect({
    value: [],
    label: 'Pages',
    placeholder: 'All pages',
    searchPlaceholder: 'Filter pages',
    items: PAGES,
    help:
      'A first press on a parent selects it with everything below. A second press keeps only the parent.',
  }),
}

export const chosen = {
  scenario: 'With a selection',
  component: treeSelect({
    value: [
      '/users',
      '/users/{id}/details',
      '/users/invites',
      '/users/{id}/orders',
      '/users/{id}/orders/{order}',
      '/users/{id}/orders/returns',
      '/settings/billing',
    ],
    label: 'Pages',
    items: PAGES,
  }),
}

export const insideForm = {
  scenario: 'Inside a form',
  component: form(
    { initialValues: { pages: [] }, onSubmit: (values) => console.log(values) },
    treeSelect({ field: 'pages', label: 'Pages', items: PAGES, required: true }),
    button({ variant: 'primary', events: { click: submitForm } }, 'Apply filter'),
  ),
}

export const disabled = {
  scenario: 'Disabled',
  component: treeSelect({ value: ['/reports'], label: 'Pages', items: PAGES, disabled: true }),
}
