import { lang } from '../../api/i18n.js'
import { impLogger } from '../../logger.js'

const DATE_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/

const DATE_TIME_PATTERN = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::\d{2}(?:\.\d+)?)?$/

const TIME_PATTERN = /^(\d{2}):(\d{2})/

const DAYS_IN_WEEK = 7

const WEEKS_IN_MATRIX = 6

export const MINUTES_IN_DAY = 1440

const formatters = new Map()

const pad = (value, length = 2) => String(value).padStart(length, '0')

const buildLocal = (year, month, day, hours = 0, minutes = 0) => {
  const date = new Date(0)
  date.setFullYear(year, month - 1, day)
  date.setHours(hours, minutes, 0, 0)
  const sameDay = date.getFullYear() === year && date.getMonth() === month - 1 &&
    date.getDate() === day
  return sameDay ? date : null
}

export const parseDate = (text) => {
  const match = DATE_PATTERN.exec(String(text ?? ''))
  if (match === null) return null
  const [year, month, day] = match.slice(1).map(Number)
  return buildLocal(year, month, day)
}

export const parseDateTime = (text) => {
  const match = DATE_TIME_PATTERN.exec(String(text ?? ''))
  if (match === null) return parseDate(text)
  const [year, month, day, hours, minutes] = match.slice(1).map(Number)
  if (hours > 23 || minutes > 59) return null
  return buildLocal(year, month, day, hours, minutes)
}

export const isDateOnly = (text) => DATE_PATTERN.test(String(text ?? ''))

export const formatDate = (date) =>
  `${pad(date.getFullYear(), 4)}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`

export const formatTime = (date) => `${pad(date.getHours())}:${pad(date.getMinutes())}`

export const formatDateTime = (date) => `${formatDate(date)}T${formatTime(date)}`

export const parseTime = (text) => {
  const match = TIME_PATTERN.exec(String(text ?? ''))
  if (match === null) return null
  const [hours, minutes] = match.slice(1).map(Number)
  return hours > 23 || minutes > 59 ? null : { hours, minutes }
}

export const startOfDay = (date) =>
  buildLocal(date.getFullYear(), date.getMonth() + 1, date.getDate())

export const withTime = (date, { hours, minutes }) => {
  const next = startOfDay(date)
  next.setHours(hours, minutes, 0, 0)
  return next
}

export const today = () => startOfDay(new Date())

export const minutesOf = (date) => date.getHours() * 60 + date.getMinutes()

export const addDays = (date, amount) => {
  const next = new Date(date)
  next.setDate(date.getDate() + amount)
  return next
}

const daysInMonth = (year, monthIndex) => new Date(year, monthIndex + 1, 0).getDate()

export const addMonths = (date, amount) => {
  const target = new Date(date)
  target.setDate(1)
  target.setMonth(date.getMonth() + amount)
  target.setDate(Math.min(date.getDate(), daysInMonth(target.getFullYear(), target.getMonth())))
  return target
}

export const startOfMonth = (date) => buildLocal(date.getFullYear(), date.getMonth() + 1, 1)

export const compareDays = (first, second) =>
  Math.sign(startOfDay(first).getTime() - startOfDay(second).getTime())

export const isSameDay = (first, second) =>
  Boolean(first) && Boolean(second) && compareDays(first, second) === 0

export const isSameMonth = (first, second) =>
  first.getFullYear() === second.getFullYear() && first.getMonth() === second.getMonth()

export const isWithinDays = (date, min, max) =>
  !(min && compareDays(date, min) < 0) && !(max && compareDays(date, max) > 0)

export const clampDay = (date, min, max) => {
  if (min && compareDays(date, min) < 0) return startOfDay(min)
  if (max && compareDays(date, max) > 0) return startOfDay(max)
  return date
}

export const firstDayOfWeek = (language = lang.get()) => {
  try {
    return new Intl.Locale(language).getWeekInfo().firstDay % DAYS_IN_WEEK
  } catch (failure) {
    impLogger.debug(`dates: '${language}' has no week data - the week starts on Monday`, failure)
    return 1
  }
}

export const startOfWeek = (date, firstDay = firstDayOfWeek()) =>
  addDays(startOfDay(date), -((date.getDay() - firstDay + DAYS_IN_WEEK) % DAYS_IN_WEEK))

export const weekOf = (date, firstDay = firstDayOfWeek()) => {
  const start = startOfWeek(date, firstDay)
  return Array.from({ length: DAYS_IN_WEEK }, (_unused, index) => addDays(start, index))
}

export const monthMatrix = (date, firstDay = firstDayOfWeek()) => {
  const start = startOfWeek(startOfMonth(date), firstDay)
  return Array.from(
    { length: WEEKS_IN_MATRIX },
    (_unused, week) => weekOf(addDays(start, week * DAYS_IN_WEEK), firstDay),
  )
}

const formatterFor = (options, language) => {
  const key = `${language}|${JSON.stringify(options)}`
  if (!formatters.has(key)) {
    let formatter
    try {
      formatter = new Intl.DateTimeFormat(language, options)
    } catch (failure) {
      impLogger.debug(`dates: '${language}' is not a language Intl reads - using 'en'`, failure)
      formatter = new Intl.DateTimeFormat('en', options)
    }
    formatters.set(key, formatter)
  }
  return formatters.get(key)
}

export const formatLocal = (date, options, language = lang.get()) =>
  formatterFor(options, language).format(date)

export const formatLocalRange = (start, end, options, language = lang.get()) =>
  formatterFor(options, language).formatRange(start, end)

export const weekdayNames = (width = 'short', firstDay = firstDayOfWeek(), language = lang.get()) =>
  weekOf(today(), firstDay).map((day) => formatLocal(day, { weekday: width }, language))
