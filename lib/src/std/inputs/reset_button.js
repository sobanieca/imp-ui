import { createFormButton } from './form_button.js'

export const resetButton = (...args) =>
  createFormButton('resetButton', {
    action: 'reset',
    defaultVariant: 'default',
    tracksSubmitting: false,
  })(...args)
