import { form, resetButton, select, submitButton, textField } from 'imp/std/inputs'
import { row } from 'imp/std/layout'

const fields = () => [
  textField({ field: 'user.firstName', label: 'First name', required: true }),
  textField({ field: 'user.email', label: 'Email', type: 'email', help: 'We never share it' }),
  select({ field: 'plan', label: 'Plan', options: ['free', 'pro', 'team'] }),
]

const values = { user: { firstName: 'Ada', email: 'ada@example.com' }, plan: 'pro' }

export const vertical = form(
  { initialValues: values, onSubmit: (submitted) => console.log(submitted) },
  ...fields(),
  row({ gap: 2 }, submitButton('Save'), resetButton('Start over')),
)
export const horizontal = form({ initialValues: values, layout: 'horizontal' }, ...fields())
export const inline = form(
  { initialValues: { term: '' }, layout: 'inline' },
  textField({ field: 'term', label: 'Search' }),
  submitButton('Go'),
)
export const empty = form(
  { initialValues: { name: '' } },
  textField({ field: 'name', label: 'Name', required: true }),
  submitButton('Save'),
)
