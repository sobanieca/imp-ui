import { createTextComponent } from './text_input.js'

export const searchField = (...args) =>
  createTextComponent('searchField', { tag: 'input', type: 'search' })(...args)
