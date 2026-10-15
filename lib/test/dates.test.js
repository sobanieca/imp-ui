import { expect, test } from 'imp/test'
import {
  addDays,
  addMonths,
  clampDay,
  compareDays,
  firstDayOfWeek,
  formatDate,
  formatDateTime,
  formatLocal,
  isDateOnly,
  isSameDay,
  isWithinDays,
  minutesOf,
  monthMatrix,
  parseDate,
  parseDateTime,
  parseTime,
  startOfWeek,
  weekdayNames,
  withTime,
} from '../src/std/shared/dates.js'

const MONDAY = 1

const SUNDAY = 0

test('parseDate builds a local day from an ISO calendar date', () => {
  const date = parseDate('2026-09-21')
  expect([date.getFullYear(), date.getMonth(), date.getDate()]).toEqual([2026, 8, 21])
  expect([date.getHours(), date.getMinutes()]).toEqual([0, 0])
})

test('parseDate refuses text that is not a real calendar date', () => {
  expect(parseDate('2026-02-30')).toEqual(null)
  expect(parseDate('2026-13-01')).toEqual(null)
  expect(parseDate('21.09.2026')).toEqual(null)
  expect(parseDate('2026-09-21T10:00')).toEqual(null)
  expect(parseDate(undefined)).toEqual(null)
})

test('parseDateTime reads a local date-time and falls back to a plain date', () => {
  const moment = parseDateTime('2026-09-21T14:30')
  expect([moment.getDate(), moment.getHours(), moment.getMinutes()]).toEqual([21, 14, 30])
  expect(parseDateTime('2026-09-21T14:30:15').getMinutes()).toEqual(30)
  expect(parseDateTime('2026-09-21').getHours()).toEqual(0)
  expect(parseDateTime('2026-09-21T24:00')).toEqual(null)
  expect(parseDateTime('2026-09-21T10:61')).toEqual(null)
})

test('formatDate and formatDateTime give the text that the parsers read', () => {
  expect(formatDate(parseDate('2026-01-05'))).toEqual('2026-01-05')
  expect(formatDateTime(parseDateTime('2026-01-05T07:05'))).toEqual('2026-01-05T07:05')
  expect(formatDate(parseDate('0099-03-04'))).toEqual('0099-03-04')
})

test('isDateOnly tells a calendar date from a date-time', () => {
  expect(isDateOnly('2026-09-21')).toEqual(true)
  expect(isDateOnly('2026-09-21T09:00')).toEqual(false)
})

test('parseTime and withTime put a time of day on a day', () => {
  expect(parseTime('09:45')).toEqual({ hours: 9, minutes: 45 })
  expect(parseTime('25:00')).toEqual(null)
  expect(parseTime('')).toEqual(null)
  const moment = withTime(parseDate('2026-09-21'), { hours: 9, minutes: 45 })
  expect(formatDateTime(moment)).toEqual('2026-09-21T09:45')
  expect(minutesOf(moment)).toEqual(585)
})

test('addDays crosses a month and a year', () => {
  expect(formatDate(addDays(parseDate('2026-09-30'), 1))).toEqual('2026-10-01')
  expect(formatDate(addDays(parseDate('2026-01-01'), -1))).toEqual('2025-12-31')
  expect(formatDate(addDays(parseDate('2026-03-28'), 2))).toEqual('2026-03-30')
})

test('addMonths keeps the day and clamps it to the length of the month', () => {
  expect(formatDate(addMonths(parseDate('2026-01-31'), 1))).toEqual('2026-02-28')
  expect(formatDate(addMonths(parseDate('2028-01-31'), 1))).toEqual('2028-02-29')
  expect(formatDate(addMonths(parseDate('2026-03-15'), -3))).toEqual('2025-12-15')
  expect(formatDate(addMonths(parseDate('2026-09-21'), 12))).toEqual('2027-09-21')
})

test('compareDays and isSameDay ignore the time of day', () => {
  const morning = parseDateTime('2026-09-21T08:00')
  const evening = parseDateTime('2026-09-21T22:00')
  expect(compareDays(morning, evening)).toEqual(0)
  expect(isSameDay(morning, evening)).toEqual(true)
  expect(compareDays(morning, parseDate('2026-09-22'))).toEqual(-1)
  expect(compareDays(parseDate('2026-09-22'), morning)).toEqual(1)
  expect(isSameDay(null, morning)).toEqual(false)
})

test('clampDay and isWithinDays keep a day between min and max', () => {
  const min = parseDate('2026-09-10')
  const max = parseDate('2026-09-20')
  expect(formatDate(clampDay(parseDate('2026-09-01'), min, max))).toEqual('2026-09-10')
  expect(formatDate(clampDay(parseDate('2026-09-25'), min, max))).toEqual('2026-09-20')
  expect(formatDate(clampDay(parseDate('2026-09-15'), min, max))).toEqual('2026-09-15')
  expect(formatDate(clampDay(parseDate('2026-09-01'), null, null))).toEqual('2026-09-01')
  expect(isWithinDays(parseDate('2026-09-10'), min, max)).toEqual(true)
  expect(isWithinDays(parseDate('2026-09-21'), min, max)).toEqual(false)
  expect(isWithinDays(parseDate('2026-09-21'), min, null)).toEqual(true)
})

test('firstDayOfWeek follows the locale', () => {
  expect(firstDayOfWeek('en-US')).toEqual(SUNDAY)
  expect(firstDayOfWeek('pl')).toEqual(MONDAY)
  expect(firstDayOfWeek('ar-EG')).toEqual(6)
  expect(firstDayOfWeek('not a language')).toEqual(MONDAY)
})

test('startOfWeek goes back to the first day of the week', () => {
  expect(formatDate(startOfWeek(parseDate('2026-09-23'), MONDAY))).toEqual('2026-09-21')
  expect(formatDate(startOfWeek(parseDate('2026-09-23'), SUNDAY))).toEqual('2026-09-20')
  expect(formatDate(startOfWeek(parseDate('2026-09-21'), MONDAY))).toEqual('2026-09-21')
  expect(formatDate(startOfWeek(parseDate('2026-09-20'), MONDAY))).toEqual('2026-09-14')
})

test('monthMatrix is six weeks of seven days that hold the whole month', () => {
  const matrix = monthMatrix(parseDate('2026-09-21'), MONDAY)
  expect(matrix.length).toEqual(6)
  expect(matrix.every((week) => week.length === 7)).toEqual(true)
  expect(formatDate(matrix[0][0])).toEqual('2026-08-31')
  expect(formatDate(matrix[0][1])).toEqual('2026-09-01')
  expect(formatDate(matrix[5][6])).toEqual('2026-10-11')
  const sundayFirst = monthMatrix(parseDate('2026-09-21'), SUNDAY)
  expect(formatDate(sundayFirst[0][0])).toEqual('2026-08-30')
})

test('monthMatrix has no gap and no double day across a clock change', () => {
  const days = monthMatrix(parseDate('2026-03-15'), MONDAY).flat().map(formatDate)
  expect(new Set(days).size).toEqual(42)
  expect(days.includes('2026-03-29')).toEqual(true)
})

test('weekday names and formatted dates come from Intl in the given language', () => {
  expect(weekdayNames('short', MONDAY, 'en')).toEqual([
    'Mon',
    'Tue',
    'Wed',
    'Thu',
    'Fri',
    'Sat',
    'Sun',
  ])
  expect(weekdayNames('long', SUNDAY, 'pl')[0]).toEqual('niedziela')
  expect(formatLocal(parseDate('2026-09-21'), { month: 'long', year: 'numeric' }, 'en')).toEqual(
    'September 2026',
  )
})
