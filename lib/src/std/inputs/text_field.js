import { createTextComponent } from './text_input.js'

export const textField = (...args) =>
  createTextComponent('textField', { tag: 'input', type: 'text', extraProps: ['type'] })(...args)
