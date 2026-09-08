import { createFormButton } from './form-button.js'

export const submitButton = (...args) =>
  createFormButton('submitButton', {
    action: 'submit',
    defaultVariant: 'primary',
    tracksSubmitting: true,
  })(...args)
