import { form, textField } from 'imp/std/inputs'

const wrap = (...fields) => form({ initialValues: { name: 'Ada', email: '' } }, ...fields)

export const withLabel = wrap(textField({ field: 'name', label: 'Full name' }))
export const required = wrap(textField({ field: 'name', label: 'Full name', required: true }))
export const withHelp = wrap(
  textField({ field: 'email', label: 'Email', type: 'email', help: 'We never share it' }),
)
export const withPlaceholder = wrap(
  textField({ field: 'email', label: 'Email', placeholder: 'you@example.com' }),
)
export const disabled = wrap(textField({ field: 'name', label: 'Full name', disabled: true }))
export const unlabelled = wrap(textField({ field: 'name', ariaLabel: 'Full name' }))

const taken = ['ada', 'grace']

export const withAsyncCheck = form(
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
)
