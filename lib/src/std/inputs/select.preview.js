import { form, select } from 'imp/std/inputs'
import { groups } from '../preview-groups.js'

export const name = 'Select'
export const group = groups.inputs

const wrap = (...fields) => form({ initialValues: { plan: 'pro', country: undefined } }, ...fields)

export const basic = {
  scenario: 'Basic',
  component: wrap(select({ field: 'plan', label: 'Plan', options: ['free', 'pro', 'team'] })),
}
export const withPlaceholder = {
  scenario: 'With a placeholder',
  component: wrap(
    select({
      field: 'country',
      label: 'Country',
      placeholder: 'Choose a country',
      options: [
        { value: 'pl', label: 'Poland' },
        { value: 'gb', label: 'United Kingdom' },
      ],
    }),
  ),
}
export const withLongLabels = {
  scenario: 'With long labels',
  component: form(
    { initialValues: { timezone: 'cet' } },
    select({
      field: 'timezone',
      label: 'Timezone',
      options: [
        {
          value: 'cet',
          label:
            '(UTC+01:00) Central European Standard Time - Brussels, Copenhagen, Madrid, Paris, Warsaw',
        },
        {
          value: 'est',
          label:
            '(UTC-05:00) Eastern Standard Time - New York, Toronto, Montreal, Atlanta, Washington',
        },
      ],
    }),
  ),
}
export const withDisabledOption = {
  scenario: 'With a disabled option',
  component: wrap(
    select({
      field: 'plan',
      label: 'Plan',
      options: [
        { value: 'free', label: 'Free' },
        {
          value: 'team',
          label: 'Team (sold out)',
          disabled: true,
        },
      ],
    }),
  ),
}
