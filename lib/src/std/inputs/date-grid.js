import { div, el, span } from '../../api/html.js'
import { blockStep, inlineStep } from '../shared/roving.js'
import { lang } from '../../api/i18n.js'
import { createState } from '../../state.js'
import { button } from '../general/button.js'
import { backIcon, forwardIcon } from '../shared/direction-icons.js'
import { focusRing, fontFamily, token } from '../shared/css.js'
import { translatedLabel } from '../shared/translated-label.js'
import {
  addDays,
  addMonths,
  clampDay,
  compareDays,
  firstDayOfWeek,
  formatDate,
  formatLocal,
  isSameDay,
  isSameMonth,
  isWithinDays,
  monthMatrix,
  startOfMonth,
  startOfWeek,
  today,
  weekdayNames,
} from '../shared/dates.js'

const TITLE_ID = 'month-title'

const DAYS_IN_WEEK = 7

const PREVIOUS_MONTH_KEY = 'imp.datePicker.previousMonth'

const NEXT_MONTH_KEY = 'imp.datePicker.nextMonth'

export const DATE_GRID_MESSAGES = {
  [PREVIOUS_MONTH_KEY]: 'Previous month',
  [NEXT_MONTH_KEY]: 'Next month',
}

export const dateGridStyles = () => `
  .month {
    display: flex;
    flex-direction: column;
    gap: ${token('space-2')};
  }

  .month-bar {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: ${token('space-2')};
  }

  .month-title {
    flex: 1;
    margin: 0;
    color: ${token('color-text')};
    font-size: ${token('font-size-md')};
    font-weight: ${token('font-weight-bold')};
    line-height: ${token('line-height-tight')};
    text-align: center;
  }

  .days {
    display: flex;
    flex-direction: column;
    gap: 2px;
  }

  .week {
    display: grid;
    grid-template-columns: repeat(${DAYS_IN_WEEK}, minmax(0, 2.75rem));
  }

  .weekday {
    padding-block: ${token('space-1')};
    color: ${token('color-secondary')};
    font-size: ${token('font-size-sm')};
    text-align: center;
  }

  .day {
    box-sizing: border-box;
    block-size: 2.75rem;
    margin: 0;
    padding: 0;
    border: ${token('border-width')} solid transparent;
    border-radius: ${token('radius-item')};
    background-color: transparent;
    color: ${token('color-text')};
    ${fontFamily()}
    font-size: ${token('font-size-sm')};
    font-variant-numeric: tabular-nums;
    cursor: pointer;
  }

  .day:hover:not([aria-disabled='true']) {
    background-color: ${token('color-surface-hover')};
  }

  .day:focus-visible {
    ${focusRing()}
    outline-offset: -2px;
  }

  .day.outside {
    color: ${token('color-secondary')};
  }

  .day[aria-current='date'] {
    border-color: ${token('color-primary')};
    font-weight: ${token('font-weight-bold')};
  }

  .day.spanned {
    border-radius: 0;
    background-color: color-mix(in oklab, ${token('color-primary')} 16%, transparent);
  }

  .day.edge,
  .day.edge:hover {
    border-radius: ${token('radius-item')};
    background-color: ${token('color-primary')};
    color: ${token('color-on-primary')};
  }

  .day[aria-disabled='true'] {
    cursor: not-allowed;
    opacity: ${token('disabled-opacity')};
  }

  @media (forced-colors: active) {
    .day { border-color: transparent }
    .day[aria-current='date'] { border-color: CanvasText }
    .day.spanned {
      border-color: Highlight;
    }
    .day.edge,
    .day.edge:hover {
      background-color: Highlight;
      color: HighlightText;
      forced-color-adjust: none;
    }
    .day[aria-disabled='true'] { color: GrayText }
  }
`

const orderedSpan = (first, second) =>
  compareDays(first, second) <= 0 ? { start: first, end: second } : { start: second, end: first }

export const createDateGrid = ({ self, min, max, selection, onPick }) => {
  let cursor = clampDay(today(), min, max)
  let hovered = null
  let shown = []

  const titleText = document.createTextNode('')
  const title = el(
    'h2',
    { class: 'month-title', id: TITLE_ID, 'aria-live': 'polite' },
    titleText,
  )
  const noPrevious = createState('imp.datePicker.noPrevious', false)
  const noNext = createState('imp.datePicker.noNext', false)
  const previous = button({
    variant: 'ghost',
    size: 'sm',
    square: true,
    disabled: noPrevious,
    label: translatedLabel(self, PREVIOUS_MONTH_KEY),
    events: { click: () => show(addMonths(cursor, -1)) },
  }, backIcon())
  const next = button({
    variant: 'ghost',
    size: 'sm',
    square: true,
    disabled: noNext,
    label: translatedLabel(self, NEXT_MONTH_KEY),
    events: { click: () => show(addMonths(cursor, 1)) },
  }, forwardIcon())

  const weekdays = Array.from({ length: DAYS_IN_WEEK }, () => {
    const short = document.createTextNode('')
    const node = div(
      { class: 'weekday', role: 'columnheader' },
      span({ 'aria-hidden': 'true' }, short),
    )
    return { node, short }
  })

  const cells = Array.from({ length: DAYS_IN_WEEK * 6 }, (_unused, index) => {
    const text = document.createTextNode('')
    const node = el(
      'button',
      {
        class: 'day',
        type: 'button',
        role: 'gridcell',
        tabindex: '-1',
        events: {
          click: () => pick(index),
          pointerenter: () => preview(index),
        },
      },
      text,
    )
    return { node, text }
  })

  const weeks = Array.from(
    { length: 6 },
    (_unused, week) =>
      div(
        { class: 'week', role: 'row' },
        ...cells.slice(week * DAYS_IN_WEEK, (week + 1) * DAYS_IN_WEEK).map(({ node }) => node),
      ),
  )

  const grid = div(
    {
      class: 'days',
      role: 'grid',
      'aria-labelledby': TITLE_ID,
      events: { pointerleave: () => preview(-1) },
    },
    div({ class: 'week', role: 'row' }, ...weekdays.map(({ node }) => node)),
    ...weeks,
  )

  const root = div(
    { class: 'month' },
    div({ class: 'month-bar' }, previous, title, next),
    grid,
  )

  const shownSpan = () => {
    const { start, end, pending } = selection()
    if (pending) return orderedSpan(pending, hovered ?? cursor)
    if (start && end) return { start, end }
    return null
  }

  const paint = () => {
    const firstDay = firstDayOfWeek()
    const current = today()
    const { start, end, pending } = selection()
    const spanned = shownSpan()
    shown = monthMatrix(cursor, firstDay).flat()
    const monthTitle = formatLocal(cursor, { month: 'long', year: 'numeric' })
    if (titleText.data !== monthTitle) titleText.data = monthTitle
    const shortNames = weekdayNames('short', firstDay)
    const longNames = weekdayNames('long', firstDay)
    weekdays.forEach(({ node, short }, index) => {
      short.data = shortNames[index]
      node.setAttribute('aria-label', longNames[index])
    })
    cells.forEach(({ node, text }, index) => {
      const day = shown[index]
      const edges = pending ? [pending] : [start, end]
      const edge = edges.some((chosen) => isSameDay(chosen, day))
      const within = spanned !== null && isWithinDays(day, spanned.start, spanned.end)
      text.data = formatLocal(day, { day: 'numeric' })
      node.dataset.date = formatDate(day)
      node.setAttribute('aria-label', formatLocal(day, { dateStyle: 'full' }))
      node.setAttribute('aria-selected', String(edge || (within && !pending)))
      node.tabIndex = isSameDay(day, cursor) ? 0 : -1
      node.classList.toggle('outside', !isSameMonth(day, cursor))
      node.classList.toggle('edge', edge)
      node.classList.toggle('spanned', within && !edge)
      if (isSameDay(day, current)) node.setAttribute('aria-current', 'date')
      else node.removeAttribute('aria-current')
      if (isWithinDays(day, min, max)) node.removeAttribute('aria-disabled')
      else node.setAttribute('aria-disabled', 'true')
    })
    noPrevious.set(Boolean(min) && compareDays(addDays(startOfMonth(cursor), -1), min) < 0)
    noNext.set(Boolean(max) && compareDays(startOfMonth(addMonths(cursor, 1)), max) > 0)
  }

  const focusCursor = () => cells[shown.findIndex((day) => isSameDay(day, cursor))]?.node.focus()

  function show(day) {
    cursor = clampDay(day, min, max)
    paint()
  }

  function pick(index) {
    const day = shown[index]
    if (!isWithinDays(day, min, max)) return
    cursor = day
    hovered = null
    onPick(day)
    paint()
    if (grid.contains(grid.getRootNode().activeElement)) focusCursor()
  }

  function preview(index) {
    const day = index === -1 ? null : shown[index]
    if (isSameDay(day, hovered) || (day === null && hovered === null)) return
    hovered = day
    if (selection().pending) paint()
  }

  const move = (day) => {
    hovered = null
    show(day)
    focusCursor()
  }

  grid.addEventListener('keydown', (event) => {
    const weekStart = startOfWeek(cursor)
    const inline = inlineStep(event.key, grid)
    const block = blockStep(event.key)
    if (inline !== 0) move(addDays(cursor, inline))
    else if (block !== 0) move(addDays(cursor, block * DAYS_IN_WEEK))
    else if (event.key === 'Home') move(weekStart)
    else if (event.key === 'End') move(addDays(weekStart, DAYS_IN_WEEK - 1))
    else if (event.key === 'PageDown') move(addMonths(cursor, event.shiftKey ? 12 : 1))
    else if (event.key === 'PageUp') move(addMonths(cursor, event.shiftKey ? -12 : -1))
    else return
    event.preventDefault()
  })

  lang.watch(self, paint)

  return { root, show, paint, focusCursor }
}
