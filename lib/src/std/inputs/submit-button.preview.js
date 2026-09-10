import { form, submitButton, textField } from 'imp/std/inputs'
import { groups } from '../preview-groups.js'

export const name = 'Submit button'
export const group = groups.inputs

const wrap = (...children) =>
  form(
    { initialValues: { name: 'Ada' }, onSubmit: () => {} },
    textField({ field: 'name', label: 'Name' }),
    ...children,
  )

export const primary = { scenario: 'Primary', component: wrap(submitButton('Save changes')) }
export const small = { scenario: 'Small', component: wrap(submitButton({ size: 'sm' }, 'Save')) }
export const ghost = {
  scenario: 'Ghost',
  component: wrap(submitButton({ variant: 'ghost' }, 'Save')),
}
export const slowSubmit = {
  scenario: 'Slow submit',
  component: form(
    {
      initialValues: { name: 'Ada' },
      onSubmit: () => new Promise((resolve) => setTimeout(resolve, 2000)),
    },
    textField({ field: 'name', label: 'Name' }),
    submitButton('Save slowly'),
  ),
}
