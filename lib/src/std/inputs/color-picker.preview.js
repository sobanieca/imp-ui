import { colorPicker, form, submitForm } from 'imp/std/inputs'
import { button } from 'imp/std'
import { groups } from '../preview-groups.js'

export const name = 'Color picker'
export const group = groups.inputs

export const basic = {
  scenario: 'Basic',
  component: colorPicker({ value: '#3b6fe0', label: 'Brand colour' }),
}

export const empty = {
  scenario: 'Empty, with help',
  component: colorPicker({
    value: undefined,
    label: 'Accent',
    help: 'Type a hex value, or press the swatch',
  }),
}

export const inForm = {
  scenario: 'In a form with validation',
  component: form(
    {
      initialValues: { brand: '#3b6fe0', accent: 'teal' },
      onSubmit: (values) => console.log(values),
    },
    colorPicker({ field: 'brand', label: 'Brand colour', required: true }),
    colorPicker({ field: 'accent', label: 'Accent', help: 'The stored value is not a colour' }),
    button({ variant: 'primary', events: { click: submitForm } }, 'Save'),
  ),
}

export const disabled = {
  scenario: 'Disabled',
  component: colorPicker({ value: '#e11d48', label: 'Danger', disabled: true }),
}
