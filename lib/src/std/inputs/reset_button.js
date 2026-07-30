import { createFormButton } from './form_button.js'

export const resetButton = createFormButton('imp-reset-button', 'resetButton', {
  action: 'reset',
  defaultVariant: 'default',
  tracksSubmitting: false,
})
