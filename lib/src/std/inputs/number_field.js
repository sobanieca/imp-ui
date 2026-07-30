import { createTextComponent } from './text_input.js'

export const numberField = createTextComponent('imp-number-field', 'numberField', {
  tag: 'input',
  type: 'number',
  numeric: true,
  extraProps: ['step'],
})
