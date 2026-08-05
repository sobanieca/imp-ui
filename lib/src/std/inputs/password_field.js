import { createTextComponent } from './text_input.js'

export const passwordField = (...args) =>
  createTextComponent('passwordField', { tag: 'input', type: 'password' })(...args)
