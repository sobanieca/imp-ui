import { firstDayOfWeek } from '../shared/dates.js'

const MS_PER_DAY = 86400000

const DAYS_PER_WEEK = 7

const ISO_DATE = /^(\d{4})-(\d{2})-(\d{2})$/

const LONGEST_DAY_SPAN = 35

const LONGEST_WEEK_SPAN = 182

export const dateOfDay = (day) => new Date(day * MS_PER_DAY)

const dayOfParts = (year, monthIndex, date) => Date.UTC(year, monthIndex, date) / MS_PER_DAY

const isoOfDay = (day) => dateOfDay(day).toISOString().slice(0, 10)

export const parseDay = (text) => {
  const match = typeof text === 'string' ? ISO_DATE.exec(text) : null
  if (match === null) return null
  const [year, month, date] = match.slice(1).map(Number)
  const day = dayOfParts(year, month - 1, date)
  return isoOfDay(day) === text ? day : null
}

export const today = () => {
  const now = new Date()
  return dayOfParts(now.getFullYear(), now.getMonth(), now.getDate())
}

const startOfWeek = (day) =>
  day - (dateOfDay(day).getUTCDay() - firstDayOfWeek() + DAYS_PER_WEEK) % DAYS_PER_WEEK

const startOfMonth = (day) => {
  const date = dateOfDay(day)
  return dayOfParts(date.getUTCFullYear(), date.getUTCMonth(), 1)
}

const startOfNextMonth = (day) => {
  const date = dateOfDay(day)
  return dayOfParts(date.getUTCFullYear(), date.getUTCMonth() + 1, 1)
}

const startOfNextYear = (day) => dayOfParts(dateOfDay(day).getUTCFullYear() + 1, 0, 1)

const split = (start, end, boundaryAfter) => {
  const parts = []
  let cursor = start
  while (cursor < end) {
    const next = Math.min(end, boundaryAfter(cursor))
    parts.push({ start: cursor, days: next - cursor })
    cursor = next
  }
  return parts
}

export const scaleForSpan = (firstDay, lastDay) => {
  const span = lastDay - firstDay + 1
  if (span <= LONGEST_DAY_SPAN) return 'day'
  return span <= LONGEST_WEEK_SPAN ? 'week' : 'month'
}

const RANGES = {
  day: (firstDay, lastDay) => [firstDay, lastDay + 1],
  week: (firstDay, lastDay) => [startOfWeek(firstDay), startOfWeek(lastDay) + DAYS_PER_WEEK],
  month: (firstDay, lastDay) => [startOfMonth(firstDay), startOfNextMonth(lastDay)],
}

const UNIT_BOUNDARIES = {
  day: (day) => day + 1,
  week: (day) => day + DAYS_PER_WEEK,
  month: startOfNextMonth,
}

export const timelineOf = (scale, firstDay, lastDay) => {
  const [start, end] = RANGES[scale](firstDay, lastDay)
  return {
    start,
    days: end - start,
    units: split(start, end, UNIT_BOUNDARIES[scale]),
    spans: split(start, end, scale === 'month' ? startOfNextYear : startOfNextMonth),
  }
}
