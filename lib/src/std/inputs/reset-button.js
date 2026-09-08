import { createFormButton } from './form-button.js'

export const resetButton = (...args) =>
  createFormButton('resetButton', {
    action: 'reset',
    defaultVariant: 'default',
    tracksSubmitting: false,
  })(...args)
