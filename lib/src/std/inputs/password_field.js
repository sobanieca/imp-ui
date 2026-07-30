import { createTextComponent } from './text_input.js'

export const passwordField = createTextComponent('imp-password-field', 'passwordField', {
  tag: 'input',
  type: 'password',
})
