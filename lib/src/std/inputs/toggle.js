import { createCheckable } from './checkable.js'

export const toggle = createCheckable('imp-toggle', 'toggle', {
  role: 'switch',
  extraClass: 'switch',
})
