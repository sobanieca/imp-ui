import { form, passwordField } from 'imp/std/inputs'

export const name = 'Password field'
export const category = 'Inputs'
export const description =
  "Run 'imp skill std/passwordField' to learn what passwordField can do before using it."

const wrap = (...fields) => form({ initialValues: { password: '' } }, ...fields)

export const basic = wrap(passwordField({ field: 'password', label: 'Password' }))
export const withRules = wrap(
  passwordField({
    field: 'password',
    label: 'Password',
    required: true,
    minLength: 12,
    help: 'At least 12 characters',
  }),
)
