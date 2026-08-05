import { createTextComponent } from './text_input.js'

export const textArea = (...args) =>
  createTextComponent('textArea', { tag: 'textarea', extraProps: ['rows'] })(...args)
