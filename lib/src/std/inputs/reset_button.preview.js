import { form, resetButton, submitButton, textField } from 'imp/std/inputs'
import { stack } from 'imp/std/layout'

export const name = 'Reset button'
export const category = 'Inputs'
export const description =
  "Run 'imp skill std/resetButton' to learn what resetButton can do before using it."

export const besideSubmit = form(
  { initialValues: { name: 'Ada' }, onSubmit: () => {} },
  textField({ field: 'name', label: 'Name' }),
  stack({ direction: 'row', gap: 2 }, submitButton('Save'), resetButton('Start over')),
)
export const alone = form(
  { initialValues: { name: 'Ada' } },
  textField({ field: 'name', label: 'Name' }),
  resetButton('Start over'),
)
