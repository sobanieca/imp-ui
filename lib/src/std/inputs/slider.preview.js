import { form, slider, submitButton } from 'imp/std/inputs'
import { groups } from '../preview-groups.js'

export const name = 'Slider'
export const group = groups.inputs

export const basic = {
  scenario: 'Basic',
  component: slider({ value: 40, label: 'Volume' }),
}

export const withStep = {
  scenario: 'With a step and a format',
  component: slider({
    value: 250,
    label: 'Budget',
    min: 0,
    max: 1000,
    step: 50,
    format: (value) => `${value} EUR`,
    help: 'The budget for each month',
  }),
}

export const withoutValue = {
  scenario: 'Without the value',
  component: slider({ value: 3, ariaLabel: 'Zoom', min: 1, max: 5, showValue: false }),
}

export const inForm = {
  scenario: 'In a form with validation',
  component: form(
    { initialValues: { volume: 90 }, onSubmit: (values) => console.log(values) },
    slider({
      field: 'volume',
      label: 'Volume',
      step: 5,
      format: (value) => `${value}%`,
      validate: (value) => (value > 80 ? 'Keep the volume at 80% or less' : null),
    }),
    submitButton('Save'),
  ),
}

export const disabled = {
  scenario: 'Disabled',
  component: slider({ value: 60, label: 'Brightness', disabled: true }),
}
