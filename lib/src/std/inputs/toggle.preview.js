import { form, toggle } from 'imp/std/inputs'
import { groups } from '../preview-groups.js'

export const name = 'Toggle'
export const group = groups.inputs

const wrap = (...fields) => form({ initialValues: { notifications: true, beta: false } }, ...fields)

export const on = {
  scenario: 'On',
  component: wrap(toggle({ field: 'notifications', label: 'Notifications' })),
}
export const off = {
  scenario: 'Off',
  component: wrap(toggle({ field: 'beta', label: 'Beta features' })),
}
export const withHelp = {
  scenario: 'With help text',
  component: wrap(toggle({ field: 'beta', label: 'Beta features', help: 'Things may break' })),
}
export const disabled = {
  scenario: 'Disabled',
  component: wrap(toggle({ field: 'beta', label: 'Beta features', disabled: true })),
}
