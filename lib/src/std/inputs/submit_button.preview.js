import { form, submitButton, textField } from 'imp/std/inputs'

const wrap = (...children) =>
  form(
    { initialValues: { name: 'Ada' }, onSubmit: () => {} },
    textField({ field: 'name', label: 'Name' }),
    ...children,
  )

export const primary = wrap(submitButton('Save changes'))
export const small = wrap(submitButton({ size: 'sm' }, 'Save'))
export const ghost = wrap(submitButton({ variant: 'ghost' }, 'Save'))
export const slowSubmit = form(
  {
    initialValues: { name: 'Ada' },
    onSubmit: () => new Promise((resolve) => setTimeout(resolve, 2000)),
  },
  textField({ field: 'name', label: 'Name' }),
  submitButton('Save slowly'),
)
