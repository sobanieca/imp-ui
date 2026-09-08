import { createTextComponent } from './text-input.js'

export const textArea = (...args) =>
  createTextComponent('textArea', { tag: 'textarea', extraProps: ['rows'] })(...args)
