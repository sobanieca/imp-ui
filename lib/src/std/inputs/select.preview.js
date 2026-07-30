import { form, select } from 'imp/std/inputs'

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
