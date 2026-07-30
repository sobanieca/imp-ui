import { form, radioGroup } from 'imp/std/inputs'

const wrap = (...fields) =>
  form({ initialValues: { size: 'medium', billing: 'yearly' } }, ...fields)

export const vertical = wrap(
  radioGroup({ field: 'size', label: 'Size', options: ['small', 'medium', 'large'] }),
)
export const horizontal = wrap(
  radioGroup({
    field: 'billing',
    label: 'Billing period',
    orientation: 'horizontal',
    options: [{ value: 'monthly', label: 'Monthly' }, { value: 'yearly', label: 'Yearly' }],
  }),
)
