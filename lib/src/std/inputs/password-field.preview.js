import { form, passwordField } from 'imp/std/inputs'
import { groups } from '../preview-groups.js'

export const name = 'Password field'
export const group = groups.inputs

const wrap = (...fields) => form({ initialValues: { password: '' } }, ...fields)

export const basic = {
  scenario: 'Basic',
  component: wrap(passwordField({ field: 'password', label: 'Password' })),
}
export const withRules = {
  scenario: 'With rules',
  component: wrap(
    passwordField({
      field: 'password',
      label: 'Password',
      required: true,
      minLength: 12,
      help: 'At least 12 characters',
    }),
  ),
}
