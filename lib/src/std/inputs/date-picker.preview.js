import { datePicker, form, submitButton, textField } from 'imp/std/inputs'
import { groups } from '../preview-groups.js'

export const name = 'Date picker'
export const group = groups.inputs

const pad = (value) => String(value).padStart(2, '0')

const isoDay = (offset) => {
  const day = new Date()
  day.setDate(day.getDate() + offset)
  return `${day.getFullYear()}-${pad(day.getMonth() + 1)}-${pad(day.getDate())}`
}

export const single = {
  scenario: 'Single date',
  component: () => datePicker({ value: isoDay(3), label: 'Due date' }),
}

export const empty = {
  scenario: 'Empty with a placeholder',
  component: () => datePicker({ label: 'Birthday', placeholder: 'Choose a day' }),
}

export const range = {
  scenario: 'Date range',
  component: () =>
    datePicker({
      value: { start: isoDay(5), end: isoDay(9) },
      label: 'Stay',
      range: true,
      help: 'The first press sets the start. The second press sets the end.',
    }),
}

export const withTime = {
  scenario: 'Date with a time',
  component: () => datePicker({ value: `${isoDay(1)}T14:30`, label: 'Starts at', time: true }),
}

export const limited = {
  scenario: 'Between min and max',
  component: () =>
    datePicker({
      label: 'Delivery day',
      placeholder: 'Within the next two weeks',
      min: isoDay(1),
      max: isoDay(14),
      required: true,
    }),
}

export const insideForm = {
  scenario: 'Inside a form',
  component: () =>
    form(
      {
        initialValues: { title: 'Team offsite', day: undefined, stay: undefined },
        onSubmit: (values) => console.log(values),
      },
      textField({ field: 'title', label: 'Title', required: true }),
      datePicker({ field: 'day', label: 'Day', required: true, min: isoDay(0) }),
      datePicker({ field: 'stay', label: 'Hotel stay', range: true }),
      submitButton('Save'),
    ),
}

export const disabled = {
  scenario: 'Disabled',
  component: () => datePicker({ value: isoDay(0), label: 'Invoice date', disabled: true }),
}
