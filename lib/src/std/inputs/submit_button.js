import { createFormButton } from './form_button.js'

export const submitButton = createFormButton('imp-submit-button', 'submitButton', {
  action: 'submit',
  defaultVariant: 'primary',
  tracksSubmitting: true,
})
