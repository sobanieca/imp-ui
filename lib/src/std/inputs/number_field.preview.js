import { form, numberField } from 'imp/std/inputs'

export const name = 'Number field'
export const category = 'Inputs'
export const description =
  "Run 'imp skill std/numberField' to learn what numberField can do before using it."

const wrap = (...fields) => form({ initialValues: { quantity: 1, price: 9.99 } }, ...fields)

export const basic = wrap(numberField({ field: 'quantity', label: 'Quantity' }))
export const bounded = wrap(numberField({ field: 'quantity', label: 'Quantity', min: 1, max: 99 }))
export const fractional = wrap(numberField({ field: 'price', label: 'Price', step: 0.01, min: 0 }))
