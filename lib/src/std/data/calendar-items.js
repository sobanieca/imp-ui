import { impLogger } from '../../logger.js'
import { paletteNames } from '../../theme-colors.js'
import {
  addDays,
  compareDays,
  formatLocalRange,
  isDateOnly,
  isSameDay,
  MINUTES_IN_DAY,
  minutesOf,
  parseDateTime,
  startOfDay,
} from '../shared/dates.js'

const NAME = 'calendar'

const DEFAULT_MINUTES = 60

const SHORTEST_BLOCK_MINUTES = 30

const MILLISECONDS_IN_MINUTE = 60000

const DAY_RANGE = { month: 'short', day: 'numeric' }

const TIME_RANGE = { timeStyle: 'short' }

const MOMENT_RANGE = { ...DAY_RANGE, hour: 'numeric', minute: '2-digit' }

const lastDayOf = ({ start, end, allDay }) => {
  if (allDay || end.getTime() === start.getTime()) return startOfDay(end)
  return startOfDay(new Date(end.getTime() - 1))
}

const normalizeItem = (entry, index) => {
  if (!entry || typeof entry !== 'object' || entry.title === undefined) {
    impLogger.warn(`${NAME}: an item is not an object with a 'title' and a 'start' - skipping it`)
    return []
  }
  const start = parseDateTime(entry.start)
  if (start === null) {
    impLogger.warn(
      `${NAME}: the item '${entry.title}' needs a 'start' like '2026-09-21' or '2026-09-21T09:00' - skipping it`,
    )
    return []
  }
  const allDay = isDateOnly(entry.start)
  const fallbackEnd = allDay
    ? start
    : new Date(start.getTime() + DEFAULT_MINUTES * MILLISECONDS_IN_MINUTE)
  let end = entry.end === undefined || entry.end === null ? fallbackEnd : parseDateTime(entry.end)
  if (end === null || end.getTime() < start.getTime()) {
    impLogger.warn(
      `${NAME}: the item '${entry.title}' has an 'end' that is not a date after its 'start' - using the default length`,
    )
    end = fallbackEnd
  }
  const color = entry.color === undefined || entry.color === null ? null : String(entry.color)
  if (color !== null && !paletteNames().includes(color)) {
    impLogger.warn(
      `${NAME}: the item '${entry.title}' has the color '${color}', which is not a palette name - using the primary color`,
    )
  }
  const item = {
    key: entry.id === undefined ? String(index) : String(entry.id),
    id: entry.id === undefined ? index : entry.id,
    source: entry,
    title: String(entry.title),
    start,
    end,
    allDay,
    color: color !== null && paletteNames().includes(color) ? color : null,
  }
  return [{ ...item, firstDay: startOfDay(start), lastDay: lastDayOf(item) }]
}

const byStart = (first, second) =>
  Number(second.allDay) - Number(first.allDay)
  || first.start.getTime() - second.start.getTime()
  || second.end.getTime() - first.end.getTime()

export const normalizeItems = (value) => {
  if (value === undefined || value === null) return []
  if (!Array.isArray(value)) {
    impLogger.warn(`${NAME}: 'items' must be an array of { id, title, start, end } - showing none`)
    return []
  }
  return value.flatMap(normalizeItem).sort(byStart)
}

export const itemsOn = (items, day) =>
  items.filter(
    (item) => compareDays(item.firstDay, day) <= 0 && compareDays(item.lastDay, day) >= 0,
  )

export const describeItemTime = (item, allDayWord) => {
  if (item.allDay) {
    return isSameDay(item.start, item.end)
      ? allDayWord
      : `${allDayWord}, ${formatLocalRange(item.start, item.end, DAY_RANGE)}`
  }
  const sameDay = isSameDay(item.firstDay, item.lastDay)
  return formatLocalRange(item.start, item.end, sameDay ? TIME_RANGE : MOMENT_RANGE)
}

const segmentOn = (item, day) => {
  const nextDay = addDays(day, 1)
  const startMinutes = item.start.getTime() < day.getTime() ? 0 : minutesOf(item.start)
  const endMinutes = item.end.getTime() >= nextDay.getTime() ? MINUTES_IN_DAY : minutesOf(item.end)
  return {
    item,
    startMinutes,
    endMinutes: Math.min(
      MINUTES_IN_DAY,
      Math.max(endMinutes, startMinutes + SHORTEST_BLOCK_MINUTES),
    ),
  }
}

const packCluster = (cluster) => {
  const columnEnds = []
  const placed = cluster.map((segment) => {
    const free = columnEnds.findIndex((end) => end <= segment.startMinutes)
    const column = free === -1 ? columnEnds.length : free
    columnEnds[column] = segment.endMinutes
    return { ...segment, column }
  })
  return placed.map((segment) => ({ ...segment, columns: columnEnds.length }))
}

export const timedSegmentsOn = (items, day) => {
  const segments = itemsOn(items, day)
    .filter((item) => !item.allDay)
    .map((item) => segmentOn(item, day))
    .sort(
      (first, second) =>
        first.startMinutes - second.startMinutes || second.endMinutes - first.endMinutes,
    )
  const clusters = []
  let clusterEnd = -1
  for (const segment of segments) {
    if (segment.startMinutes >= clusterEnd) clusters.push([])
    clusters.at(-1).push(segment)
    clusterEnd = Math.max(clusterEnd, segment.endMinutes)
  }
  return clusters.flatMap(packCluster)
}
