import { defineComponent } from '../shared/define.js'
import { div, el, li, span, ul } from '../../api/html.js'
import { defaultMessages, lang, t } from '../../api/i18n.js'
import { impLogger } from '../../logger.js'
import { paletteNames } from '../../theme-colors.js'
import { bindValue } from '../shared/args.js'
import { token } from '../shared/css.js'
import { ownEvents } from '../shared/own-events.js'
import { itemId, normalizeItems } from '../shared/items.js'
import { dateOfDay, parseDay, scaleForSpan, timelineOf, today } from './gantt-dates.js'
import { ganttStyles } from './gantt-styles.js'
import { activeLocale } from './locale.js'

const NAME = 'gantt'

const SCALES = ['day', 'week', 'month']

const KNOWN_PROPS = ['label', 'tasks', 'scale', 'events']

const SELECT_EVENT = 'select'

const RANGE_KEY = 'imp.gantt.range'

const MILESTONE_KEY = 'imp.gantt.milestone'

const PROGRESS_KEY = 'imp.gantt.progress'

const messages = {
  [RANGE_KEY]: '{start} to {end}',
  [MILESTONE_KEY]: 'Milestone on {date}',
  [PROGRESS_KEY]: '{progress}% complete',
}

const SPAN_FORMATS = {
  day: { month: 'long', year: 'numeric' },
  week: { month: 'long', year: 'numeric' },
  month: { year: 'numeric' },
}

const UNIT_FORMATS = {
  day: { day: 'numeric' },
  week: { day: 'numeric', month: 'short' },
  month: { month: 'short' },
}

const formatterOf = (options) => {
  const format = new Intl.DateTimeFormat(activeLocale(), { ...options, timeZone: 'UTC' })
  return (day) => format.format(dateOfDay(day))
}

const warnSkipped = (entry, reason) => {
  impLogger.warn(`${NAME}: the task '${entry?.label ?? entry?.id}' ${reason} - skipping it`)
}

const progressOf = (entry) => {
  if (entry.progress === undefined || entry.progress === null) return null
  if (typeof entry.progress === 'number' && Number.isFinite(entry.progress)) {
    return Math.min(100, Math.max(0, entry.progress))
  }
  impLogger.warn(
    `${NAME}: the 'progress' of task '${entry.label}' must be a number from 0 to 100 - ignoring it`,
  )
  return null
}

const colorOf = (entry) => {
  if (entry.color === undefined || entry.color === null) return token('color-primary')
  if (paletteNames().includes(entry.color)) return token(`color-${entry.color}`)
  impLogger.warn(
    `${NAME}: the color '${entry.color}' of task '${entry.label}' is not a theme palette name like 'blue' - using the primary color`,
  )
  return token('color-primary')
}

const normalizeTasks = (tasks) => {
  const seen = new Set()
  return normalizeItems(NAME, tasks, {
    prop: 'tasks',
    shape: '{ id, label, start, end }',
    noun: 'a task',
    item: (entry, index) => {
      const start = parseDay(entry.start)
      const end = parseDay(entry.end)
      if (start === null || end === null) {
        warnSkipped(entry, "needs 'start' and 'end' as ISO dates like '2026-09-21'")
        return null
      }
      if (end < start) {
        warnSkipped(entry, "has an 'end' before its 'start'")
        return null
      }
      const id = itemId(entry, index)
      if (seen.has(id)) {
        impLogger.warn(
          `${NAME}: two tasks share the id '${id}' - ids must be unique in one gantt()`,
        )
      }
      seen.add(id)
      return {
        id,
        label: String(entry.label),
        start,
        end,
        progress: progressOf(entry),
        color: colorOf(entry),
        group: entry.group === undefined || entry.group === null ? null : String(entry.group),
      }
    },
  })
}

const groupsOf = (tasks) => {
  const groups = new Map()
  for (const task of tasks) {
    if (!groups.has(task.group)) groups.set(task.group, [])
    groups.get(task.group).push(task)
  }
  return [...groups].map(([name, members]) => ({ name, members }))
}

const pickScale = (scale) => {
  if (scale === undefined || scale === null || SCALES.includes(scale)) return scale ?? null
  impLogger.warn(
    `${NAME}: 'scale' must be one of 'day', 'week', 'month' - got '${scale}', picking it from the tasks`,
  )
  return null
}

const definition = {
  styles: ganttStyles,
  props: KNOWN_PROPS,
  setup: (self, props, children) => {
    if (children.length > 0) {
      impLogger.warn(`${NAME}: takes no content - pass every task in 'tasks'`)
    }
    if (props.label === undefined) {
      impLogger.warn(`${NAME}: pass a 'label' - it names the timeline for a screen reader`)
    }
    const fixedScale = pickScale(props.scale)
    const selectable = props.events?.[SELECT_EVENT] !== undefined

    const canvas = div({ class: 'canvas' })
    const scroll = div({ class: 'scroll', role: 'group', tabindex: '0' }, canvas)
    const root = div(
      {
        class: ['root', selectable ? 'selectable' : null],
        events: ownEvents(props.events, [SELECT_EVENT]),
      },
      scroll,
    )

    const select = (id) => {
      if (!selectable) return
      root.dispatchEvent(
        new CustomEvent(SELECT_EVENT, { bubbles: true, composed: true, detail: { id } }),
      )
    }

    const detailsOf = (task, formatDate) => {
      const when = task.start === task.end
        ? t(MILESTONE_KEY, { date: formatDate(task.start) })
        : t(RANGE_KEY, { start: formatDate(task.start), end: formatDate(task.end) })
      return task.progress === null
        ? when
        : `${when}, ${t(PROGRESS_KEY, { progress: task.progress })}`
    }

    const markOf = (task, timeline, summary) => {
      const placed = { '--task-color': task.color, '--offset': task.start - timeline.start }
      const events = { click: () => select(task.id) }
      if (task.start === task.end) {
        return div({ class: 'milestone', title: summary, style: placed, events })
      }
      return div(
        {
          class: 'bar',
          title: summary,
          style: { ...placed, '--days': task.end - task.start + 1 },
          events,
        },
        task.progress === null
          ? null
          : div({ class: 'fill', style: { '--progress': `${task.progress}%` } }),
      )
    }

    const taskRow = (task, index, timeline, formatDate) => {
      const details = detailsOf(task, formatDate)
      const detailsId = `details-${index}`
      const name = selectable
        ? el('button', {
          class: 'name',
          type: 'button',
          title: task.label,
          'data-id': task.id,
          'aria-describedby': detailsId,
          events: { click: () => select(task.id) },
        }, task.label)
        : span({ class: 'name', title: task.label }, task.label)
      return li(
        { class: 'row task' },
        div({ class: 'label-cell' }, name, span({ class: 'details', id: detailsId }, details)),
        div(
          { class: 'track', 'aria-hidden': 'true' },
          markOf(task, timeline, `${task.label}: ${details}`),
        ),
      )
    }

    const header = (scale, timeline, currentDay) => {
      const spanText = formatterOf(SPAN_FORMATS[scale])
      const unitText = formatterOf(UNIT_FORMATS[scale])
      const weekdayText = formatterOf({ weekday: 'narrow' })
      return div(
        { class: 'header', 'aria-hidden': 'true' },
        div({ class: 'corner' }),
        div(
          { class: 'timeline' },
          div(
            { class: 'spans' },
            ...timeline.spans.map(({ start, days }) =>
              div(
                { class: 'span-cell', style: { '--days': days } },
                span({ class: 'span-text' }, spanText(start)),
              )
            ),
          ),
          div(
            { class: 'units' },
            ...timeline.units.map(({ start, days }) => {
              const current = currentDay >= start && currentDay < start + days
              return div(
                { class: ['unit-cell', current ? 'current' : null], style: { '--days': days } },
                scale === 'day' ? span(weekdayText(start)) : null,
                span(unitText(start)),
              )
            }),
          ),
        ),
      )
    }

    const columns = (timeline, currentDay) => {
      const offset = currentDay - timeline.start
      return div(
        { class: 'columns', 'aria-hidden': 'true' },
        ...timeline.units.map(({ days }) => div({ class: 'column', style: { '--days': days } })),
        offset >= 0 && offset < timeline.days
          ? div({ class: 'today', style: { '--offset': offset } })
          : null,
      )
    }

    let tasks = []

    const draw = () => {
      const focusedId = self.host.shadowRoot?.activeElement?.dataset.id
      const currentDay = today()
      const firstDay = tasks.length === 0
        ? currentDay
        : Math.min(...tasks.map(({ start }) => start))
      const lastDay = tasks.length === 0 ? currentDay : Math.max(...tasks.map(({ end }) => end))
      const scale = fixedScale ?? scaleForSpan(firstDay, lastDay)
      const timeline = timelineOf(scale, firstDay, lastDay)
      const formatDate = formatterOf({ dateStyle: 'medium' })
      const groups = groupsOf(tasks)
      const grouped = groups.some(({ name }) => name !== null)
      let rowIndex = 0
      const rowsOf = (members) =>
        members.map((task) => taskRow(task, rowIndex++, timeline, formatDate))
      const rows = ul(
        { class: ['rows', grouped ? 'grouped' : null], role: 'list' },
        ...groups.flatMap(({ name, members }, groupIndex) => {
          if (name === null) return rowsOf(members)
          const headingId = `group-${groupIndex}`
          return [li(
            { class: 'group' },
            div(
              { class: 'row group-row' },
              div(
                { class: 'label-cell' },
                span({ class: 'name', id: headingId, title: name }, name),
              ),
              div({ class: 'track', 'aria-hidden': 'true' }),
            ),
            ul({ role: 'list', 'aria-labelledby': headingId }, ...rowsOf(members)),
          )]
        }),
      )
      root.classList.remove(...SCALES.map((name) => `scale-${name}`))
      root.classList.add(`scale-${scale}`)
      root.style.setProperty('--total-days', String(timeline.days))
      canvas.replaceChildren(
        header(scale, timeline, currentDay),
        div({ class: 'body' }, columns(timeline, currentDay), rows),
      )
      if (focusedId !== undefined) {
        const again = [...canvas.querySelectorAll('button.name')]
          .find((candidate) => candidate.dataset.id === focusedId)
        again?.focus()
      }
    }

    let ready = false
    bindValue(self, props.tasks ?? [], (value) => {
      tasks = normalizeTasks(value)
      if (ready) draw()
    })
    bindValue(self, props.label, (value) => {
      if (value === undefined || value === null) scroll.removeAttribute('aria-label')
      else scroll.setAttribute('aria-label', String(value))
    })
    lang.watch(self, () => {
      if (ready) draw()
    })
    ready = true
    draw()
    return root
  },
}

export const gantt = (...args) =>
  defineComponent(NAME, () => definition, () => defaultMessages(messages))(...args)
