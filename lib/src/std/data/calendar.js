import { defineComponent } from '../shared/define.js'
import { div, el } from '../../api/html.js'
import { defaultMessages, lang, t } from '../../api/i18n.js'
import { impLogger } from '../../logger.js'
import { isStateShaped } from '../../render.js'
import { createState } from '../../state.js'
import { button } from '../general/button.js'
import { segmented } from '../inputs/segmented.js'
import { bindValue, oneOf, stopOnRemove } from '../shared/args.js'
import { backIcon, forwardIcon } from '../shared/direction-icons.js'
import { ownEvents } from '../shared/own-events.js'
import { translatedLabel } from '../shared/translated-label.js'
import {
  addDays,
  addMonths,
  firstDayOfWeek,
  formatDate,
  formatLocal,
  formatLocalRange,
  MINUTES_IN_DAY,
  parseDateTime,
  startOfDay,
  today,
} from '../shared/dates.js'
import { calendarStyles } from './calendar-css.js'
import { normalizeItems } from './calendar-items.js'
import {
  daysShown,
  firstShownMinutes,
  placeNowLine,
  renderMonth,
  renderTimeGrid,
} from './calendar-views.js'

const NAME = 'calendar'

const KNOWN_PROPS = ['label', 'items', 'view', 'date', 'events']

const VIEWS = ['month', 'week', 'day']

const SELECT_EVENT = 'select'

const SLOT_SELECT_EVENT = 'slotSelect'

const NOW_LINE_INTERVAL = 60000

const DAYS_IN_WEEK = 7

const messages = {
  'imp.calendar.today': 'Today',
  'imp.calendar.month': 'Month',
  'imp.calendar.week': 'Week',
  'imp.calendar.day': 'Day',
  'imp.calendar.previous': 'Previous',
  'imp.calendar.next': 'Next',
  'imp.calendar.more': '+{count} more',
  'imp.calendar.allDay': 'All day',
  'imp.calendar.view': 'View',
}

const MONTH_TITLE = { month: 'long', year: 'numeric' }

const WEEK_TITLE = { month: 'short', day: 'numeric', year: 'numeric' }

const DAY_TITLE = { dateStyle: 'full' }

const readDate = (raw) => {
  if (raw === undefined || raw === null) return today()
  const parsed = typeof raw === 'string' ? parseDateTime(raw) : null
  if (parsed !== null) return startOfDay(parsed)
  impLogger.warn(`${NAME}: 'date' must be a date like '2026-09-21' - showing today`)
  return today()
}

const titleOf = (view, date, firstDay) => {
  if (view === 'month') return formatLocal(date, MONTH_TITLE)
  if (view === 'day') return formatLocal(date, DAY_TITLE)
  const days = daysShown(view, date, firstDay)
  return formatLocalRange(days[0], days.at(-1), WEEK_TITLE)
}

const stepFrom = (view, date, direction) => {
  if (view === 'month') return addMonths(date, direction)
  return addDays(date, view === 'week' ? direction * DAYS_IN_WEEK : direction)
}

const followed = ({ self, prop, source, read, apply }) => {
  const state = isStateShaped(source) ? source : null
  bindValue(self, source, (raw) => apply(read(raw)))
  return (next) => {
    if (state !== null && typeof state.set === 'function') return state.set(next)
    if (state !== null) {
      impLogger.warn(
        `${NAME}: '${prop}' is a read-only state - pass a writable state so ${NAME} can write it back`,
      )
    }
    apply(read(next))
  }
}

const definition = {
  styles: calendarStyles,
  props: KNOWN_PROPS,
  onMount: (self) => self.revealFirstHours(),
  setup: (self, props, children) => {
    if (children.length > 0) {
      impLogger.warn(`${NAME}: takes no content - pass the entries as 'items'`)
    }
    let items = []
    let view = 'month'
    let date = today()
    let ready = false
    let timeGridRevealed = false

    const titleText = document.createTextNode('')
    const monthBox = div({ class: 'month-view' })
    const scroller = div({ class: 'scroller', role: 'group', tabindex: '0', hidden: true })
    const root = el('section', {
      class: 'root',
      events: ownEvents(props.events, [SELECT_EVENT, SLOT_SELECT_EVENT]),
    })
    bindValue(self, props.label, (value) => {
      if (value !== undefined) root.setAttribute('aria-label', String(value))
    })
    if (props.label === undefined) {
      impLogger.warn(`${NAME}: pass a 'label' - it names the calendar for a screen reader`)
    }

    const report = (name, detail) =>
      root.dispatchEvent(new CustomEvent(name, { bubbles: true, composed: true, detail }))

    const viewChoice = createState('imp.calendar.viewChoice', view)

    const focusedKey = () => {
      const focused = root.getRootNode().activeElement
      return root.contains(focused) ? focused?.dataset.key : undefined
    }

    const revealFirstHours = () => {
      if (view === 'month' || timeGridRevealed) return
      const body = scroller.querySelector('.time-body')
      if (body === null) return
      timeGridRevealed = true
      const minutes = firstShownMinutes({ items, view, date, firstDay: firstDayOfWeek() })
      scroller.scrollTop = (body.offsetHeight * minutes) / MINUTES_IN_DAY
    }
    self.revealFirstHours = revealFirstHours

    const render = () => {
      if (!ready) return
      const key = focusedKey()
      const firstDay = firstDayOfWeek()
      const context = {
        items,
        view,
        date,
        firstDay,
        words: {
          allDay: t('imp.calendar.allDay'),
          more: (count) => t('imp.calendar.more', { count }),
        },
        onSelect: (item) => report(SELECT_EVENT, { id: item.id, item: item.source }),
        onSlot: (detail) => report(SLOT_SELECT_EVENT, detail),
        onMore: (day) => {
          writeDate(formatDate(day))
          writeView('day')
        },
      }
      const title = titleOf(view, date, firstDay)
      if (titleText.data !== title) titleText.data = title
      const isMonth = view === 'month'
      monthBox.replaceChildren(...(isMonth ? renderMonth(context) : []))
      scroller.replaceChildren(...(isMonth ? [] : renderTimeGrid(context)))
      scroller.setAttribute('aria-label', title)
      monthBox.hidden = !isMonth
      scroller.hidden = isMonth
      if (isMonth) timeGridRevealed = false
      else if (!timeGridRevealed) requestAnimationFrame(revealFirstHours)
      if (key === undefined) return
      const holder = isMonth ? monthBox : scroller
      const next = [...holder.querySelectorAll('[data-key]')].find((node) =>
        node.dataset.key === key
      )
      next?.focus()
    }

    const writeView = followed({
      self,
      prop: 'view',
      source: props.view,
      read: (raw) => oneOf(NAME, 'view', raw, VIEWS, 'month'),
      apply: (next) => {
        view = next
        viewChoice.set(view)
        render()
      },
    })

    const writeDate = followed({
      self,
      prop: 'date',
      source: props.date,
      read: readDate,
      apply: (next) => {
        if (next.getTime() === date.getTime()) return
        date = next
        render()
      },
    })

    viewChoice.watch(self, (next) => {
      if (next !== view) writeView(next)
    })

    bindValue(self, props.items, (value) => {
      items = normalizeItems(value)
      render()
    })
    lang.watch(self, render)

    const timer = setInterval(() => placeNowLine(scroller), NOW_LINE_INTERVAL)
    stopOnRemove(self, () => clearInterval(timer))

    const toolbar = div(
      { class: 'toolbar' },
      button(
        { size: 'sm', events: { click: () => writeDate(formatDate(today())) } },
        lang.text(() => t('imp.calendar.today')),
      ),
      div(
        { class: 'steps' },
        button({
          variant: 'ghost',
          size: 'sm',
          square: true,
          label: translatedLabel(self, 'imp.calendar.previous'),
          events: { click: () => writeDate(formatDate(stepFrom(view, date, -1))) },
        }, backIcon()),
        button({
          variant: 'ghost',
          size: 'sm',
          square: true,
          label: translatedLabel(self, 'imp.calendar.next'),
          events: { click: () => writeDate(formatDate(stepFrom(view, date, 1))) },
        }, forwardIcon()),
      ),
      el('h2', { class: 'title', 'aria-live': 'polite' }, titleText),
      segmented({
        size: 'sm',
        value: viewChoice,
        ariaLabel: translatedLabel(self, 'imp.calendar.view'),
        options: VIEWS.map((name) => ({
          value: name,
          label: translatedLabel(self, `imp.calendar.${name}`),
        })),
      }),
    )

    root.append(toolbar, monthBox, scroller)
    ready = true
    render()
    return root
  },
}

export const calendar = (...args) =>
  defineComponent(NAME, () => definition, () => defaultMessages(messages))(...args)
