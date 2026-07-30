import { checkbox, form } from 'imp/std/inputs'

const wrap = (...fields) => form({ initialValues: { terms: false, alerts: true } }, ...fields)

export const unchecked = wrap(checkbox({ field: 'terms', label: 'I accept the terms' }))
export const checked = wrap(checkbox({ field: 'alerts', label: 'Email me about outages' }))
export const required = wrap(
  checkbox({ field: 'terms', label: 'I accept the terms', required: true }),
)
export const disabled = wrap(checkbox({ field: 'terms', label: 'Locked', disabled: true }))
