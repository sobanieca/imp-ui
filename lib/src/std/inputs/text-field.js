import { createTextComponent } from './text-input.js'

export const textField = (...args) =>
  createTextComponent('textField', { tag: 'input', type: 'text', extraProps: ['type'] })(...args)
