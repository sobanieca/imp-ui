import { div, el, li, span, ul } from '../../api/html.js'
import {
  formatDate,
  formatDateTime,
  formatLocal,
  isSameDay,
  isSameMonth,
  MINUTES_IN_DAY,
  minutesOf,
  monthMatrix,
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

const monthCell = (context, day) => {
  const { items, date } = context
  const found = itemsOn(items, day)
  const shown = found.length > SHOWN_CHIPS ? found.slice(0, SHOWN_CHIPS - 1) : found
  const node = div(
    {
      class: ['cell', isSameMonth(day, date) ? null : 'outside'],
    },
    dayButton({ ...context, day, className: 'day-number' }, formatLocal(day, { day: 'numeric' })),
    shown.length === 0
      ? null
      : ul({ class: 'chips' }, ...shown.map((item) => li(eventChip({ ...context, item, day })))),
    found.length === shown.length
      ? null
      : moreButton({ ...context, day, count: found.length - shown.length }),
  )
  node.dataset.date = formatDate(day)
  return node
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
      ...monthMatrix(context.date, context.firstDay).flat().map((day) => monthCell(context, day)),
    ),
  ]
}

const slotAt = (column, day, pointer) => {
  const box = column.getBoundingClientRect()
  const share = box.height === 0 ? 0 : (pointer.clientY - box.top) / box.height
  const slot = Math.floor((Math.min(Math.max(share, 0), 0.9999) * MINUTES_IN_DAY) / SLOT_MINUTES)
  const start = withTime(day, { hours: 0, minutes: slot * SLOT_MINUTES })
  const end = withTime(day, { hours: 0, minutes: slot * SLOT_MINUTES + SLOT_LENGTH_MINUTES })
  return { start: formatDateTime(start), end: formatDateTime(end), allDay: false }
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

const dayColumn = (context, day) => {
  const isToday = isSameDay(day, today())
  const nowLine = isToday ? div({ class: 'now', 'aria-hidden': 'true' }) : null
  nowLine?.style.setProperty('inset-block-start', percentOfDay(minutesOf(new Date())))
  const node = div(
    {
      class: ['column', isToday ? 'today' : null],
      events: {
        click: (event) => {
          if (event.target === node) context.onSlot(slotAt(node, day, event))
        },
      },
    },
    ...timedSegmentsOn(context.items, day).map((segment) => eventBlock(context, day, segment)),
    nowLine,
  )
  node.dataset.date = formatDate(day)
  return node
}

const hourLabels = (day) =>
  Array.from(
    { length: HOURS_IN_DAY },
    (_unused, hour) =>
      div(
        { class: 'hour' },
        hour === 0 ? null : formatLocal(withTime(day, { hours: hour, minutes: 0 }), {
          hour: 'numeric',
        }),
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
  const body = div(
    { class: ['time-body', `days-${days.length}`] },
    div({ class: 'hours', 'aria-hidden': 'true' }, ...hourLabels(context.date)),
    ...days.map((day) => dayColumn(context, day)),
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
