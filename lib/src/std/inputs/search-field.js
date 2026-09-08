import { createTextComponent } from './text-input.js'

export const searchField = (...args) =>
  createTextComponent('searchField', { tag: 'input', type: 'search' })(...args)
