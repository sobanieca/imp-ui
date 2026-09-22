import { form, textField } from 'imp/std/inputs'
import { groups } from '../preview-groups.js'

export const name = 'Text field'
export const group = groups.inputs

const wrap = (...fields) =>
  form(
    { initialValues: { name: 'Ada', email: '', password: '', query: '', seats: 3, note: '' } },
    ...fields,
  )

export const withLabel = {
  scenario: 'With a label',
  component: wrap(textField({ field: 'name', label: 'Full name' })),
}
export const required = {
  scenario: 'Required',
  component: wrap(textField({ field: 'name', label: 'Full name', required: true })),
}
export const withHelp = {
  scenario: 'With help text',
  component: wrap(
    textField({ field: 'email', label: 'Email', type: 'email', help: 'We never share it' }),
  ),
}
export const withPlaceholder = {
  scenario: 'With a placeholder',
  component: wrap(
    textField({ field: 'email', label: 'Email', placeholder: 'you@example.com' }),
  ),
}
export const password = {
  scenario: 'Password',
  component: wrap(
    textField({
      field: 'password',
      label: 'Password',
      type: 'password',
      autocomplete: 'new-password',
      minLength: 8,
    }),
  ),
}
export const search = {
  scenario: 'Search',
  component: wrap(
    textField({ field: 'query', ariaLabel: 'Search', type: 'search', placeholder: 'Search' }),
  ),
}
export const number = {
  scenario: 'Number',
  component: wrap(
    textField({ field: 'seats', label: 'Seats', type: 'number', min: 1, max: 50, step: 1 }),
  ),
}
export const multiLine = {
  scenario: 'Multi-line',
  component: wrap(
    textField({ field: 'note', label: 'Notes', rows: 4, help: 'A sentence or two is plenty' }),
  ),
}
export const stepper = {
  scenario: 'Number with a stepper',
  component: wrap(
    textField({ field: 'seats', label: 'Seats', type: 'number', stepper: true, min: 1, max: 12 }),
  ),
}
export const disabled = {
  scenario: 'Disabled',
  component: wrap(textField({ field: 'name', label: 'Full name', disabled: true })),
}
export const unlabelled = {
  scenario: 'Unlabelled',
  component: wrap(textField({ field: 'name', ariaLabel: 'Full name' })),
}

const taken = ['ada', 'grace']

export const withAsyncCheck = {
  scenario: 'With an async check',
  component: form(
    { initialValues: { username: '' } },
    textField({
      field: 'username',
      label: 'Username',
      help: 'Checked when you leave the field',
      required: true,
      validateAsync: (value) =>
        new Promise((resolve) =>
          setTimeout(() => resolve(taken.includes(value) ? 'That name is taken' : null), 800)
        ),
    }),
  ),
}
