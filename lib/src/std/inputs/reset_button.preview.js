import { form, resetButton, submitButton, textField } from 'imp/std/inputs'
import { row } from 'imp/std/layout'

export const besideSubmit = form(
  { initialValues: { name: 'Ada' }, onSubmit: () => {} },
  textField({ field: 'name', label: 'Name' }),
  row({ gap: 2 }, submitButton('Save'), resetButton('Start over')),
)
export const alone = form(
  { initialValues: { name: 'Ada' } },
  textField({ field: 'name', label: 'Name' }),
  resetButton('Start over'),
)
