import { createTextComponent } from './text-input.js'

export const passwordField = (...args) =>
  createTextComponent('passwordField', { tag: 'input', type: 'password' })(...args)
