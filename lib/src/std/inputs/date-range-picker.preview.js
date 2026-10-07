import { dateRangePicker, form, submitForm } from 'imp/std/inputs'
import { button } from 'imp/std'
import { groups } from '../preview-groups.js'

export const name = 'Date range picker'
export const group = groups.inputs

const pad = (value) => String(value).padStart(2, '0')

const isoOf = (day) => `${day.getFullYear()}-${pad(day.getMonth() + 1)}-${pad(day.getDate())}`

const momentOf = (day) =>
  `${isoOf(day)}T${pad(day.getHours())}:${pad(day.getMinutes())}:${pad(day.getSeconds())}`

const shifted = ({ days = 0, months = 0, years = 0 }) => {
  const day = new Date()
  day.setFullYear(day.getFullYear() - years, day.getMonth() - months, day.getDate() - days)
  return isoOf(day)
}

const secondsAgo = (seconds) => momentOf(new Date(Date.now() - seconds * 1000))

const lastPeriod = (value, label, back) => ({
  value,
  label,
  range: { start: shifted(back), end: shifted({}) },
})

const lastMoments = (value, label, seconds) => ({
  value,
  label,
  range: { start: secondsAgo(seconds), end: secondsAgo(0) },
})

const presets = () => [
  lastPeriod('7d', 'Last 7 days', { days: 6 }),
  lastPeriod('30d', 'Last 30 days', { days: 29 }),
  lastPeriod('3m', 'Last 3 months', { months: 3 }),
  lastPeriod('6m', 'Last 6 months', { months: 6 }),
  lastPeriod('1y', 'Last year', { years: 1 }),
  lastPeriod('5y', 'Last 5 years', { years: 5 }),
]

const recentPresets = () => [
  lastMoments('60s', 'Last 60 seconds', 60),
  lastMoments('5m', 'Last 5 minutes', 5 * 60),
  lastMoments('1h', 'Last hour', 60 * 60),
  lastMoments('24h', 'Last 24 hours', 24 * 60 * 60),
]

export const relative = {
  scenario: 'Relative range',
  component: () =>
    dateRangePicker({ value: { preset: '30d' }, label: 'Period', presets: presets() }),
}

export const custom = {
  scenario: 'Custom range',
  component: () =>
    dateRangePicker({
      value: { start: shifted({ days: 20 }), end: shifted({ days: 6 }) },
      label: 'Period',
      presets: presets(),
      max: shifted({}),
      help: 'Pick the first day, then the last day, and press Apply.',
    }),
}

export const plain = {
  scenario: 'Without presets',
  component: () =>
    dateRangePicker({
      value: { start: shifted({ days: -5 }), end: shifted({ days: -9 }) },
      label: 'Hotel stay',
      min: shifted({}),
    }),
}

export const withTime = {
  scenario: 'With times',
  component: () =>
    dateRangePicker({
      value: { preset: '5m' },
      label: 'Log window',
      presets: recentPresets(),
      time: true,
    }),
}

export const empty = {
  scenario: 'Empty',
  component: () => dateRangePicker({ label: 'Period', presets: presets() }),
}

export const insideForm = {
  scenario: 'Inside a form',
  component: () =>
    form(
      { initialValues: { period: { preset: '7d' } }, onSubmit: (values) => console.log(values) },
      dateRangePicker({
        field: 'period',
        label: 'Report period',
        presets: presets(),
        required: true,
      }),
      button({ variant: 'primary', events: { click: submitForm } }, 'Run report'),
    ),
}

export const disabled = {
  scenario: 'Disabled',
  component: () =>
    dateRangePicker({
      value: { preset: '1y' },
      label: 'Period',
      presets: presets(),
      disabled: true,
    }),
}
