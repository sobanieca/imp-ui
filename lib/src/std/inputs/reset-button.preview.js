import { form, resetButton, submitButton, textField } from 'imp/std/inputs'
import { div } from 'imp/html'

export const name = 'Reset button'
export const group = 'Inputs'
export const description =
  "Run 'imp skill std/resetButton' to learn what resetButton can do before using it."

export const besideSubmit = form(
  { initialValues: { name: 'Ada' }, onSubmit: () => {} },
  textField({ field: 'name', label: 'Name' }),
  div(
    { style: 'display: flex; flex-direction: row; gap: var(--imp-space-2, 8px)' },
    submitButton('Save'),
    resetButton('Start over'),
  ),
)
export const alone = form(
  { initialValues: { name: 'Ada' } },
  textField({ field: 'name', label: 'Name' }),
  resetButton('Start over'),
)
