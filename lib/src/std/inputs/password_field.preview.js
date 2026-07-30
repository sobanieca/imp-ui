import { form, passwordField } from 'imp/std/inputs'

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
