import { form, numberField } from 'imp/std/inputs'
import { groups } from '../preview-groups.js'

export const name = 'Number field'
export const group = groups.inputs

const wrap = (...fields) => form({ initialValues: { quantity: 1, price: 9.99 } }, ...fields)

export const basic = {
  scenario: 'Basic',
  component: wrap(numberField({ field: 'quantity', label: 'Quantity' })),
}
export const bounded = {
  scenario: 'Bounded',
  component: wrap(numberField({ field: 'quantity', label: 'Quantity', min: 1, max: 99 })),
}
export const fractional = {
  scenario: 'Fractional',
  component: wrap(numberField({ field: 'price', label: 'Price', step: 0.01, min: 0 })),
}
