import { createTextComponent } from './text_input.js'

export const textArea = createTextComponent('imp-text-area', 'textArea', {
  tag: 'textarea',
  extraProps: ['rows'],
})
