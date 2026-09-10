import { form, textField } from 'imp/std/inputs'
import { groups } from '../preview-groups.js'

export const name = 'Text field'
export const group = groups.inputs

const wrap = (...fields) => form({ initialValues: { name: 'Ada', email: '' } }, ...fields)

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
