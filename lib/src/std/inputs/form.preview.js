import { form, resetForm, select, submitForm, textField } from 'imp/std/inputs'
import { button } from 'imp/std'
import { div } from 'imp/html'
import { groups } from '../preview-groups.js'

export const name = 'Form'
export const group = groups.inputs

const fields = () => [
  textField({ field: 'user.firstName', label: 'First name', required: true }),
  textField({ field: 'user.email', label: 'Email', type: 'email', help: 'We never share it' }),
  select({ field: 'plan', label: 'Plan', options: ['free', 'pro', 'team'] }),
]

const values = { user: { firstName: 'Ada', email: 'ada@example.com' }, plan: 'pro' }

export const vertical = {
  scenario: 'Vertical',
  component: form(
    { initialValues: values, onSubmit: (submitted) => console.log(submitted) },
    ...fields(),
    div(
      { style: 'display: flex; flex-direction: row; gap: var(--imp-space-2, 8px)' },
      button({ variant: 'primary', events: { click: submitForm } }, 'Save'),
      button({ events: { click: resetForm } }, 'Start over'),
    ),
  ),
}
export const horizontal = {
  scenario: 'Horizontal',
  component: form({ initialValues: values, layout: 'horizontal' }, ...fields()),
}
export const inline = {
  scenario: 'Inline',
  component: form(
    { initialValues: { term: '' }, layout: 'inline' },
    textField({ field: 'term', label: 'Search' }),
    button({ variant: 'primary', events: { click: submitForm } }, 'Go'),
  ),
}
export const empty = {
  scenario: 'Empty',
  component: form(
    { initialValues: { name: '' } },
    textField({ field: 'name', label: 'Name', required: true }),
    button({ variant: 'primary', events: { click: submitForm } }, 'Save'),
  ),
}
