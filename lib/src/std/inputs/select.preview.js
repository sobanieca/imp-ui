import { form, select } from 'imp/std/inputs'

export const name = 'Select'
export const group = 'Inputs'
export const description = "Run 'imp skill std/select' to learn what select can do before using it."

const wrap = (...fields) => form({ initialValues: { plan: 'pro', country: undefined } }, ...fields)

export const basic = wrap(
  select({ field: 'plan', label: 'Plan', options: ['free', 'pro', 'team'] }),
)
export const withPlaceholder = wrap(
  select({
    field: 'country',
    label: 'Country',
    placeholder: 'Choose a country',
    options: [{ value: 'pl', label: 'Poland' }, { value: 'gb', label: 'United Kingdom' }],
  }),
)
export const withLongLabels = form(
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
)
export const withDisabledOption = wrap(
  select({
    field: 'plan',
    label: 'Plan',
    options: [{ value: 'free', label: 'Free' }, {
      value: 'team',
      label: 'Team (sold out)',
      disabled: true,
    }],
  }),
)
