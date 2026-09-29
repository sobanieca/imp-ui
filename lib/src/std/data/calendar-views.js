import { div, el, span } from '../../api/html.js'
import {
  addDays,
  compareDays,
  formatDate,
  formatDateTime,
  formatLocal,
  isSameDay,
  isSameMonth,
  MINUTES_IN_DAY,
  minutesOf,
  monthMatrix,
  parseDate,
  today,
  weekdayNames,
  weekOf,
  withTime,
} from '../shared/dates.js'
import { describeItemTime, itemsOn, timedSegmentsOn } from './calendar-items.js'

const SHOWN_CHIPS = 3

const HOURS_IN_DAY = 24

const SLOT_MINUTES = 30

const SLOT_LENGTH_MINUTES = 60

const FIRST_SHOWN_HOUR = 7

const TIME_FORMAT = { timeStyle: 'short' }

const FULL_DAY_FORMAT = { dateStyle: 'full' }

const percentOfDay = (minutes) => `${(minutes / MINUTES_IN_DAY) * 100}%`

const eventButton = ({ item, day, kind, words, onSelect }, ...content) => {
  const node = el(
    'button',
    {
      type: 'button',
      class: ['event', kind, item.color === null ? null : `color-${item.color}`],
      'aria-label': `${item.title}, ${describeItemTime(item, words.allDay)}`,
      events: { click: () => onSelect(item) },
    },
    ...content,
  )
  node.dataset.key = `event:${item.key}:${formatDate(day)}`
  return node
}

const eventChip = (context) => {
  const { item, day } = context
  const startsHere = !item.allDay && isSameDay(item.start, day)
  return eventButton(
    { ...context, kind: 'chip' },
    startsHere ? span({ class: 'event-time' }, formatLocal(item.start, TIME_FORMAT)) : null,
    span({ class: 'event-title' }, item.title),
  )
}

const dayButton = ({ day, className, onSlot }, ...content) => {
  const node = el(
    'button',
    {
      type: 'button',
      class: className,
      'aria-label': formatLocal(day, FULL_DAY_FORMAT),
      events: { click: () => onSlot({ start: formatDate(day), allDay: true }) },
    },
    ...content,
  )
  node.dataset.key = `day:${formatDate(day)}`
  if (isSameDay(day, today())) node.setAttribute('aria-current', 'date')
  return node
}

const moreButton = ({ day, count, words, onMore }) => {
  const node = el(
    'button',
    {
      type: 'button',
      class: 'more',
      'aria-label': words.more(count),
      events: { click: () => onMore(day) },
    },
    span({ class: 'full', 'aria-hidden': 'true' }, words.more(count)),
    span({ class: 'brief', 'aria-hidden': 'true' }, `+${count}`),
  )
  node.dataset.key = `more:${formatDate(day)}`
  return node
}

const eventBar = (context) => {
  const { item, from, continuesBefore, continuesAfter } = context
  const node = eventButton(
    { ...context, day: from, kind: 'bar' },
    span({ class: 'event-title' }, item.title),
  )
  node.classList.toggle('from-before', continuesBefore)
  node.classList.toggle('to-after', continuesAfter)
  return node
}

const gridPlaced = (node, { row, column, columns = 1 }) => {
  node.style.setProperty('grid-row', String(row))
  node.style.setProperty('grid-column', `${column + 1} / span ${columns}`)
  return node
}

const LANE_ROW_OFFSET = 2

const weekSegments = (items, week) => {
  const first = week[0]
  const last = week.at(-1)
  const indexOf = (day) => week.findIndex((shown) => isSameDay(shown, day))
  return items
    .filter((item) =>
      compareDays(item.firstDay, last) <= 0 && compareDays(item.lastDay, first) >= 0
    )
    .map((item) => {
      const from = compareDays(item.firstDay, first) < 0 ? first : item.firstDay
      const to = compareDays(item.lastDay, last) > 0 ? last : item.lastDay
      const column = indexOf(from)
      return {
        item,
        from,
        to,
        column,
        span: indexOf(to) - column + 1,
        continuesBefore: compareDays(item.firstDay, first) < 0,
        continuesAfter: compareDays(item.lastDay, last) > 0,
        multiDay: !isSameDay(item.firstDay, item.lastDay),
      }
    })
    .sort((one, other) =>
      one.column - other.column || other.span - one.span ||
      Number(other.multiDay) - Number(one.multiDay)
    )
}

const assignLanes = (segments) => {
  const laneEnds = []
  return segments.map((segment) => {
    const free = laneEnds.findIndex((end) => end < segment.column)
    const lane = free === -1 ? laneEnds.length : free
    laneEnds[lane] = segment.column + segment.span - 1
    return { ...segment, lane }
  })
}

const coversColumn = (segment, column) =>
  column >= segment.column && column < segment.column + segment.span

const layoutWeek = (items, week) => {
  const laid = assignLanes(weekSegments(items, week))
  const overflowing = week.map((_day, column) =>
    laid.some((segment) => segment.lane >= SHOWN_CHIPS && coversColumn(segment, column))
  )
  const isShown = (segment) =>
    segment.lane < SHOWN_CHIPS - 1 ||
    (segment.lane === SHOWN_CHIPS - 1 &&
      week.every((_day, column) => !coversColumn(segment, column) || !overflowing[column]))
  const shown = laid.filter(isShown)
  const hidden = week.map((_day, column) =>
    laid.filter((segment) => !isShown(segment) && coversColumn(segment, column)).length
  )
  return { shown, hidden }
}

const monthWeek = (context, week) => {
  const { shown, hidden } = layoutWeek(context.items, week)
  const nodes = week.flatMap((day, column) => {
    const outside = isSameMonth(day, context.date) ? null : 'outside'
    const cell = gridPlaced(div({ class: ['cell', outside], 'aria-hidden': 'true' }), {
      row: '1 / -1',
      column,
    })
    cell.dataset.date = formatDate(day)
    const number = gridPlaced(
      dayButton(
        { ...context, day, className: ['day-number', outside] },
        formatLocal(day, { day: 'numeric' }),
      ),
      { row: 1, column },
    )
    const starting = shown
      .filter((segment) => segment.column === column)
      .sort((one, other) => one.lane - other.lane)
      .map((segment) => {
        const render = segment.multiDay ? eventBar : eventChip
        const node = render({ ...context, ...segment, day: segment.from })
        node.dataset.from = formatDate(segment.from)
        node.dataset.to = formatDate(segment.to)
        return gridPlaced(node, {
          row: segment.lane + LANE_ROW_OFFSET,
          column,
          columns: segment.span,
        })
      })
    const more = hidden[column] === 0 ? null : gridPlaced(
      moreButton({ ...context, day, count: hidden[column] }),
      { row: SHOWN_CHIPS - 1 + LANE_ROW_OFFSET, column },
    )
    return [cell, number, ...starting, more].filter(Boolean)
  })
  return div({ class: 'week' }, ...nodes)
}

export const renderMonth = (context) => {
  const shortNames = weekdayNames('short', context.firstDay)
  const narrowNames = weekdayNames('narrow', context.firstDay)
  return [
    div(
      { class: 'weekdays', 'aria-hidden': 'true' },
      ...shortNames.map((name, index) =>
        div(
          { class: 'weekday' },
          span({ class: 'short' }, name),
          span({ class: 'narrow' }, narrowNames[index]),
        )
      ),
    ),
    div(
      { class: 'month-grid' },
      ...monthMatrix(context.date, context.firstDay).map((week) => monthWeek(context, week)),
    ),
  ]
}

const SLOTS_IN_DAY = MINUTES_IN_DAY / SLOT_MINUTES

const SLOT_FORMAT = {
  weekday: 'long',
  day: 'numeric',
  month: 'long',
  hour: 'numeric',
  minute: '2-digit',
}

const slotStart = (day, index) => withTime(day, { hours: 0, minutes: index * SLOT_MINUTES })

const slotExists = (day, index) => minutesOf(slotStart(day, index)) === index * SLOT_MINUTES

const existingSlot = (day, index, step) => {
  for (let at = index; at >= 0 && at < SLOTS_IN_DAY; at += step) {
    if (slotExists(day, at)) return at
  }
  for (let at = index - step; at >= 0 && at < SLOTS_IN_DAY; at -= step) {
    if (slotExists(day, at)) return at
  }
  return null
}

const slotKey = (day, index) => `slot:${formatDateTime(slotStart(day, index))}`

const slotButton = (context, day, index, resting) => {
  const start = slotStart(day, index)
  const end = withTime(day, { hours: 0, minutes: index * SLOT_MINUTES + SLOT_LENGTH_MINUTES })
  const node = el('button', {
    type: 'button',
    class: 'slot',
    tabindex: resting ? '0' : '-1',
    'aria-label': formatLocal(start, SLOT_FORMAT),
    events: {
      click: () =>
        context.onSlot({ start: formatDateTime(start), end: formatDateTime(end), allDay: false }),
    },
  })
  node.style.setProperty('inset-block-start', percentOfDay(index * SLOT_MINUTES))
  node.style.setProperty('block-size', percentOfDay(SLOT_MINUTES))
  node.dataset.key = slotKey(day, index)
  node.dataset.slot = String(index)
  node.dataset.date = formatDate(day)
  return node
}

const isRightToLeft = (element) => getComputedStyle(element).direction === 'rtl'

const slotMove = (key, rightToLeft) => {
  if (key === 'ArrowUp') return { slots: -1, days: 0 }
  if (key === 'ArrowDown') return { slots: 1, days: 0 }
  if (key === 'ArrowLeft') return { slots: 0, days: rightToLeft ? 1 : -1 }
  if (key === 'ArrowRight') return { slots: 0, days: rightToLeft ? -1 : 1 }
  if (key === 'Home') return { to: 0, step: 1 }
  if (key === 'End') return { to: SLOTS_IN_DAY - 1, step: -1 }
  return null
}

const targetSlot = (day, index, move) => {
  if (move.to !== undefined) return existingSlot(day, move.to, move.step)
  if (move.slots === 0) return existingSlot(day, index, 1)
  const next = Math.min(SLOTS_IN_DAY - 1, Math.max(0, index + move.slots))
  return existingSlot(day, next, move.slots)
}

const moveSlotFocus = (context, event) => {
  const from = event.target
  if (!from.classList?.contains('slot')) return
  if (event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) return
  const move = slotMove(event.key, isRightToLeft(from))
  if (move === null) return
  event.preventDefault()
  const day = addDays(parseDate(from.dataset.date), move.days ?? 0)
  const key = slotKey(day, targetSlot(day, Number(from.dataset.slot), move))
  const grid = from.closest('.time-body')
  const next = grid.querySelector(`.slot[data-key='${key}']`)
  if (next === null) {
    context.onStepTo(day, key)
    return
  }
  from.setAttribute('tabindex', '-1')
  next.setAttribute('tabindex', '0')
  next.focus()
}

const eventBlock = (context, day, { item, startMinutes, endMinutes, column, columns }) => {
  const node = eventButton(
    { ...context, item, day, kind: 'block' },
    span({ class: 'event-title' }, item.title),
    span({ class: 'event-time' }, describeItemTime(item, context.words.allDay)),
  )
  node.style.setProperty('inset-block-start', percentOfDay(startMinutes))
  node.style.setProperty('block-size', percentOfDay(endMinutes - startMinutes))
  node.style.setProperty('inset-inline-start', `${(column / columns) * 100}%`)
  node.style.setProperty('inline-size', `${100 / columns}%`)
  return node
}

const dayColumn = (context, day, restingSlot) => {
  const isToday = isSameDay(day, today())
  const nowLine = isToday ? div({ class: 'now', 'aria-hidden': 'true' }) : null
  nowLine?.style.setProperty('inset-block-start', percentOfDay(minutesOf(new Date())))
  const resting = isSameDay(day, context.date) ? existingSlot(day, restingSlot, 1) : -1
  const node = div(
    { class: ['column', isToday ? 'today' : null] },
    ...Array.from({ length: SLOTS_IN_DAY }, (_unused, index) => index)
      .filter((index) => slotExists(day, index))
      .map((index) => slotButton(context, day, index, index === resting)),
    ...timedSegmentsOn(context.items, day).map((segment) => eventBlock(context, day, segment)),
    nowLine,
  )
  node.dataset.date = formatDate(day)
  return node
}

const HOUR_LABEL_FORMAT = { hour: 'numeric', timeZone: 'UTC' }

const hourLabels = () =>
  Array.from(
    { length: HOURS_IN_DAY },
    (_unused, hour) =>
      div(
        { class: 'hour' },
        hour === 0 ? null : formatLocal(new Date(Date.UTC(2000, 0, 1, hour)), HOUR_LABEL_FORMAT),
      ),
  )

const placed = (node, row, index) => {
  node.style.setProperty('grid-row', String(row))
  node.style.setProperty('grid-column', String(index + 2))
  return node
}

export const daysShown = (view, date, firstDay) => view === 'week' ? weekOf(date, firstDay) : [date]

export const renderTimeGrid = (context) => {
  const days = daysShown(context.view, context.date, context.firstDay)
  const head = div(
    { class: ['time-head', `days-${days.length}`] },
    div({ class: 'corner', 'aria-hidden': 'true' }, context.words.allDay),
    ...days.map((day, index) =>
      placed(
        div(
          { class: 'day-head' },
          dayButton(
            { ...context, day, className: 'day-button' },
            formatLocal(day, { weekday: 'short', day: 'numeric' }),
          ),
        ),
        1,
        index,
      )
    ),
    ...days.map((day, index) =>
      placed(
        div(
          { class: 'all-day' },
          ...itemsOn(context.items, day)
            .filter((item) => item.allDay)
            .map((item) => eventChip({ ...context, item, day })),
        ),
        2,
        index,
      )
    ),
  )
  const restingSlot = Math.min(
    SLOTS_IN_DAY - 1,
    Math.floor((firstShownMinutes(context) + SLOT_MINUTES) / SLOT_MINUTES),
  )
  const body = div(
    {
      class: ['time-body', `days-${days.length}`],
      events: { keydown: (event) => moveSlotFocus(context, event) },
    },
    div({ class: 'hours', 'aria-hidden': 'true' }, ...hourLabels()),
    ...days.map((day) => dayColumn(context, day, restingSlot)),
  )
  return [head, body]
}

export const firstShownMinutes = (context) => {
  const days = daysShown(context.view, context.date, context.firstDay)
  const starts = days.flatMap((day) =>
    timedSegmentsOn(context.items, day)
      .map(({ startMinutes }) => startMinutes)
      .filter((minutes) => minutes > 0)
  )
  const earliest = Math.min(FIRST_SHOWN_HOUR * 60, ...starts)
  return Math.max(0, earliest - SLOT_MINUTES)
}

export const placeNowLine = (holder) =>
  holder.querySelector('.now')?.style.setProperty(
    'inset-block-start',
    percentOfDay(minutesOf(new Date())),
  )
