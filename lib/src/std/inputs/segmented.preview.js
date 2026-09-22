import { form, segmented, submitButton } from 'imp/std/inputs'
import { stack } from 'imp/std/layout'
import {
  luBold,
  luItalic,
  luTextAlignCenter,
  luTextAlignEnd,
  luTextAlignStart,
  luUnderline,
} from 'imp/icons'
import { groups } from '../preview-groups.js'

export const name = 'Segmented'
export const group = groups.inputs

const VIEWS = ['List', 'Board', 'Calendar']

const FORMATS = [
  { value: 'bold', label: 'Bold', icon: luBold },
  { value: 'italic', label: 'Italic', icon: luItalic },
  { value: 'underline', label: 'Underline', icon: luUnderline },
]

export const single = {
  scenario: 'Single',
  component: segmented({ value: 'Board', label: 'View', options: VIEWS }),
}

export const multiple = {
  scenario: 'Multiple',
  component: segmented({
    value: ['sat', 'sun'],
    label: 'Delivery days',
    multiple: true,
    options: [
      { value: 'fri', label: 'Fri' },
      { value: 'sat', label: 'Sat' },
      { value: 'sun', label: 'Sun' },
    ],
  }),
}

export const icons = {
  scenario: 'Icons',
  component: stack(
    { gap: 4 },
    segmented({ value: ['bold'], ariaLabel: 'Text format', multiple: true, options: FORMATS }),
    segmented({
      value: 'start',
      ariaLabel: 'Alignment',
      options: [
        { value: 'start', label: 'Align to the start', icon: luTextAlignStart },
        { value: 'center', label: 'Align to the center', icon: luTextAlignCenter },
        { value: 'end', label: 'Align to the end', icon: luTextAlignEnd },
      ],
    }),
  ),
}

export const sizes = {
  scenario: 'Sizes',
  component: stack(
    { gap: 4 },
    segmented({ value: 'Month', ariaLabel: 'Small range', size: 'sm', options: ['Week', 'Month'] }),
    segmented({ value: 'Month', ariaLabel: 'Medium range', options: ['Week', 'Month'] }),
    segmented({ value: 'Month', ariaLabel: 'Large range', size: 'lg', options: ['Week', 'Month'] }),
  ),
}

export const block = {
  scenario: 'Block',
  component: segmented({
    value: 'monthly',
    label: 'Billing period',
    block: true,
    options: [{ value: 'monthly', label: 'Monthly' }, { value: 'yearly', label: 'Yearly' }],
  }),
}

export const inForm = {
  scenario: 'In a form with validation',
  component: form(
    { initialValues: { view: undefined, formats: [] }, onSubmit: (values) => console.log(values) },
    segmented({ field: 'view', label: 'Default view', options: VIEWS, required: true }),
    segmented({
      field: 'formats',
      label: 'Format',
      help: 'Choose at least one format',
      multiple: true,
      required: true,
      options: FORMATS,
    }),
    submitButton('Save'),
  ),
}

export const disabled = {
  scenario: 'Disabled',
  component: stack(
    { gap: 4 },
    segmented({ value: 'Board', label: 'View', options: VIEWS, disabled: true }),
    segmented({
      value: 'pro',
      label: 'Plan',
      options: [
        { value: 'free', label: 'Free' },
        { value: 'pro', label: 'Pro' },
        { value: 'team', label: 'Team (sold out)', disabled: true },
      ],
    }),
  ),
}
