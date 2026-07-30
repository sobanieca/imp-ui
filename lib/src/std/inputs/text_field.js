import { createTextComponent } from './text_input.js'

export const textField = createTextComponent('imp-text-field', 'textField', {
  tag: 'input',
  type: 'text',
  extraProps: ['type'],
})
