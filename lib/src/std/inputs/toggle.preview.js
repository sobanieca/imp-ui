import { form, toggle } from 'imp/std/inputs'

export const name = 'Toggle'
export const group = 'Inputs'
export const description = "Run 'imp skill std/toggle' to learn what toggle can do before using it."

const wrap = (...fields) => form({ initialValues: { notifications: true, beta: false } }, ...fields)

export const on = wrap(toggle({ field: 'notifications', label: 'Notifications' }))
export const off = wrap(toggle({ field: 'beta', label: 'Beta features' }))
export const withHelp = wrap(
  toggle({ field: 'beta', label: 'Beta features', help: 'Things may break' }),
)
export const disabled = wrap(toggle({ field: 'beta', label: 'Beta features', disabled: true }))
