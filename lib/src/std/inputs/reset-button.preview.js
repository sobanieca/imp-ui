import { form, resetButton, submitButton, textField } from 'imp/std/inputs'
import { div } from 'imp/html'
import { groups } from '../preview-groups.js'

export const name = 'Reset button'
export const group = groups.inputs

export const besideSubmit = {
  scenario: 'Beside the submit button',
  component: form(
    { initialValues: { name: 'Ada' }, onSubmit: () => {} },
    textField({ field: 'name', label: 'Name' }),
    div(
      { style: 'display: flex; flex-direction: row; gap: var(--imp-space-2, 8px)' },
      submitButton('Save'),
      resetButton('Start over'),
    ),
  ),
}
export const alone = {
  scenario: 'Alone',
  component: form(
    { initialValues: { name: 'Ada' } },
    textField({ field: 'name', label: 'Name' }),
    resetButton('Start over'),
  ),
}
