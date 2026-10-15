import { form, radioGroup } from 'imp/std/inputs'
import { groups } from '../preview-groups.js'

export const name = 'Radio group'
export const group = groups.inputs

const wrap = (...fields) =>
  form({ initialValues: { size: 'medium', billing: 'yearly' } }, ...fields)

export const vertical = {
  scenario: 'Vertical',
  component: wrap(
    radioGroup({ field: 'size', label: 'Size', options: ['small', 'medium', 'large'] }),
  ),
}
export const horizontal = {
  scenario: 'Horizontal',
  component: wrap(
    radioGroup({
      field: 'billing',
      label: 'Billing period',
      orientation: 'horizontal',
      options: [
        { value: 'monthly', label: 'Monthly' },
        { value: 'yearly', label: 'Yearly' },
      ],
    }),
  ),
}
