import { createCheckable } from './checkable.js'

export const toggle = (...args) =>
  createCheckable('toggle', { role: 'switch', extraClass: 'switch' })(...args)
