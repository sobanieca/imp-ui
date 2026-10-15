import { checkbox, form } from 'imp/std/inputs'
import { groups } from '../preview-groups.js'

export const name = 'Checkbox'
export const group = groups.inputs

const wrap = (...fields) => form({ initialValues: { terms: false, alerts: true } }, ...fields)

export const unchecked = {
  scenario: 'Unchecked',
  component: wrap(checkbox({ field: 'terms', label: 'I accept the terms' })),
}
export const checked = {
  scenario: 'Checked',
  component: wrap(checkbox({ field: 'alerts', label: 'Email me about outages' })),
}
export const required = {
  scenario: 'Required',
  component: wrap(checkbox({ field: 'terms', label: 'I accept the terms', required: true })),
}
export const disabled = {
  scenario: 'Disabled',
  component: wrap(checkbox({ field: 'terms', label: 'Locked', disabled: true })),
}
