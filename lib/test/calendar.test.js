import { component, mount } from 'imp'
import { calendar } from 'imp/std/data'
import { initState } from 'imp/state'
import { beforeEach, expect, spy, test } from 'imp/test'
import { settled } from './shadow.js'
import { normalizeItems, timedSegmentsOn } from '../src/std/data/calendar-items.js'
import { parseDate } from '../src/std/shared/dates.js'

const NOW = { fakeTimers: { now: new Date(2026, 8, 21, 10, 30) } }

const ITEMS = [
  { id: 1, title: 'Standup', start: '2026-09-21T09:00', end: '2026-09-21T09:15', color: 'blue' },
  { id: 2, title: 'Offsite', start: '2026-09-23', end: '2026-09-25' },
  { id: 3, title: 'Design review', start: '2026-09-21T09:00', end: '2026-09-21T10:30' },
  { id: 4, title: 'Lunch', start: '2026-09-21T12:00', end: '2026-09-21T13:00', color: 'green' },
  { id: 5, title: 'Retro', start: '2026-09-21T15:00', end: '2026-09-21T16:00' },
]

const mounted = (host) => {
  mount(document.body, host)
  return host
}

const inner = (host, selector) => host.shadowRoot.querySelector(selector)

const innerAll = (host, selector) => [...host.shadowRoot.querySelectorAll(selector)]

const cellOf = (host, date) => inner(host, `.cell[data-date='${date}']`)

const columnOf = (host, date) => inner(host, `.column[data-date='${date}']`)

const titleOf = (host) => inner(host, '.title').textContent

const toolbarButtons = (host) =>
  innerAll(host, '.toolbar imp-button').map((node) => node.shadowRoot.querySelector('button'))

const viewButton = (host, word) =>
  [...inner(host, 'imp-segmented').shadowRoot.querySelectorAll('.segment')]
    .find((node) => node.textContent.includes(word))

const namedButton = (host, name) =>
  toolbarButtons(host).find((node) => node.getAttribute('aria-label') === name)

const microtask = () => Promise.resolve()

const warnings = () => spy(console, 'warn', () => {})

const warned = (warn, text) => warn.calls.some(([first]) => String(first).includes(text))

const stateHost = component('calendar-state-host', { setup: (self, render) => render(self) })

const withStates = (initial, render) => {
  const states = {}
  const host = mounted(stateHost((self) => {
    for (const [name, value] of Object.entries(initial)) {
      states[name] = initState(self, `test.calendar.${name}`, value)
    }
    return render(states)
  }))
  return { states, host: host.shadowRoot.querySelector('imp-calendar') }
}

beforeEach(() => {
  document.body.replaceChildren()
  document.documentElement.setAttribute('lang', 'en-GB')
})

test('calendar renders a labelled section with a toolbar and a month of 42 days', () => {
  const host = mounted(calendar({ label: 'Team calendar', items: ITEMS, date: '2026-09-21' }))
  expect(host.localName).toEqual('imp-calendar')
  const root = inner(host, 'section')
  expect(root.getAttribute('aria-label')).toEqual('Team calendar')
  expect(titleOf(host)).toEqual('September 2026')
  expect(inner(host, '.title').getAttribute('aria-live')).toEqual('polite')
  expect(innerAll(host, '.cell').length).toEqual(42)
  expect(innerAll(host, '.cell')[0].dataset.date).toEqual('2026-08-31')
  expect(cellOf(host, '2026-08-31').classList.contains('outside')).toEqual(true)
  expect(cellOf(host, '2026-09-01').classList.contains('outside')).toEqual(false)
  expect(namedButton(host, 'Previous').localName).toEqual('button')
  expect(namedButton(host, 'Next').localName).toEqual('button')
  const switcher = inner(host, 'imp-segmented').shadowRoot.querySelector('.field')
  expect(switcher.getAttribute('role')).toEqual('radiogroup')
  expect(switcher.getAttribute('aria-label')).toEqual('View')
  expect(viewButton(host, 'Month').getAttribute('aria-checked')).toEqual('true')
  expect(viewButton(host, 'Week').getAttribute('aria-checked')).toEqual('false')
})

test('every event is a button named with its title and its time', () => {
  const host = mounted(calendar({ label: 'Team', items: ITEMS, date: '2026-09-21' }))
  const offsite = cellOf(host, '2026-09-24').querySelector('.event')
  expect(offsite.localName).toEqual('button')
  expect(offsite.getAttribute('aria-label')).toMatch(/^Offsite, All day, 23.+25 Sept$/)
  expect(cellOf(host, '2026-09-23').querySelectorAll('.event').length).toEqual(1)
  expect(cellOf(host, '2026-09-25').querySelectorAll('.event').length).toEqual(1)
  expect(cellOf(host, '2026-09-26').querySelectorAll('.event').length).toEqual(0)
  const standup = cellOf(host, '2026-09-21').querySelector('.event.color-blue')
  expect(standup.getAttribute('aria-label')).toMatch(/^Standup, 09:00.+09:15$/)
  expect(standup.classList.contains('color-blue')).toEqual(true)
  expect(standup.querySelector('.event-time').textContent).toEqual('09:00')
})

test('a busy day shows two chips and a more button that opens the day view', async () => {
  const host = mounted(calendar({ label: 'Team', items: ITEMS, date: '2026-09-21' }))
  const cell = cellOf(host, '2026-09-21')
  expect(cell.querySelectorAll('.event').length).toEqual(2)
  const more = cell.querySelector('.more')
  expect(more.getAttribute('aria-label')).toEqual('+2 more')
  more.click()
  await microtask()
  expect(titleOf(host)).toEqual('Monday, 21 September 2026')
  expect(viewButton(host, 'Day').getAttribute('aria-checked')).toEqual('true')
  expect(innerAll(host, '.column').length).toEqual(1)
  expect(innerAll(host, '.block').length).toEqual(4)
})

test('today is marked with aria-current in the month and in the week', async () => {
  const host = mounted(calendar({ label: 'Team', items: ITEMS }))
  expect(titleOf(host)).toEqual('September 2026')
  const marked = innerAll(host, "[aria-current='date']")
  expect(marked.length).toEqual(1)
  expect(marked[0].getAttribute('aria-label')).toEqual('Monday, 21 September 2026')
  viewButton(host, 'Week').click()
  await microtask()
  expect(innerAll(host, "[aria-current='date']").length).toEqual(1)
  expect(columnOf(host, '2026-09-21').classList.contains('today')).toEqual(true)
  const line = columnOf(host, '2026-09-21').querySelector('.now')
  expect(line.style.getPropertyValue('inset-block-start')).toEqual('43.75%')
}, NOW)

test('select reports the id of the activated event', () => {
  const seen = []
  const host = mounted(calendar({
    label: 'Team',
    items: ITEMS,
    date: '2026-09-21',
    events: { select: (event) => seen.push(event.detail) },
  }))
  cellOf(host, '2026-09-21').querySelector('.event.color-blue').click()
  expect(seen.length).toEqual(1)
  expect(seen[0].id).toEqual(1)
  expect(seen[0].item.title).toEqual('Standup')
})

test('the day number in the month view reports an all-day slot', () => {
  const seen = []
  const host = mounted(calendar({ label: 'Team', date: '2026-09-21' }))
  host.addEventListener('slotSelect', (event) => seen.push(event.detail))
  const day = cellOf(host, '2026-09-10').querySelector('.day-number')
  expect(day.localName).toEqual('button')
  expect(day.getAttribute('aria-label')).toEqual('Thursday, 10 September 2026')
  day.click()
  expect(seen).toEqual([{ start: '2026-09-10', allDay: true }])
})

test('the week view has seven columns, an all-day strip and positioned blocks', async () => {
  const host = mounted(calendar({ label: 'Team', items: ITEMS, date: '2026-09-21', view: 'week' }))
  await microtask()
  expect(viewButton(host, 'Week').getAttribute('aria-checked')).toEqual('true')
  expect(titleOf(host)).toContain('21')
  expect(titleOf(host)).toContain('27 Sept 2026')
  expect(innerAll(host, '.column').length).toEqual(7)
  expect(innerAll(host, '.day-button').length).toEqual(7)
  expect(innerAll(host, '.hour').length).toEqual(24)
  expect(innerAll(host, '.hour')[9].textContent).toEqual('09')
  expect(innerAll(host, '.all-day .event').length).toEqual(3)
  expect(inner(host, '.month-view').hidden).toEqual(true)
  expect(inner(host, '.scroller').hidden).toEqual(false)
  const blocks = [...columnOf(host, '2026-09-21').querySelectorAll('.block')]
  expect(blocks.map((node) => node.getAttribute('aria-label').split(',')[0])).toEqual([
    'Design review',
    'Standup',
    'Lunch',
    'Retro',
  ])
  const [review, standup, lunch] = blocks
  expect(review.style.getPropertyValue('inset-block-start')).toEqual('37.5%')
  expect(review.style.getPropertyValue('block-size')).toEqual('6.25%')
  expect(review.style.getPropertyValue('inline-size')).toEqual('50%')
  expect(review.style.getPropertyValue('inset-inline-start')).toEqual('0%')
  expect(standup.style.getPropertyValue('inset-inline-start')).toEqual('50%')
  expect(lunch.style.getPropertyValue('inline-size')).toEqual('100%')
})

test('a day header button and an hour slot report slotSelect', async () => {
  const seen = []
  const host = mounted(calendar({
    label: 'Team',
    date: '2026-09-21',
    view: 'week',
    events: { slotSelect: (event) => seen.push(event.detail) },
  }))
  await microtask()
  const header = innerAll(host, '.day-button')[1]
  expect(header.getAttribute('aria-label')).toEqual('Tuesday, 22 September 2026')
  header.click()
  expect(seen[0]).toEqual({ start: '2026-09-22', allDay: true })
  const column = columnOf(host, '2026-09-23')
  column.getBoundingClientRect = () => ({ top: 100, height: 1440 })
  column.dispatchEvent(
    new MouseEvent('click', { bubbles: true, composed: true, clientY: 100 + 615 }),
  )
  expect(seen[1]).toEqual({ start: '2026-09-23T10:00', end: '2026-09-23T11:00', allDay: false })
})

test('the toolbar steps by the size of the view and goes back to today', async () => {
  const host = mounted(calendar({ label: 'Team', date: '2026-01-31' }))
  namedButton(host, 'Next').click()
  expect(titleOf(host)).toEqual('February 2026')
  namedButton(host, 'Previous').click()
  namedButton(host, 'Previous').click()
  expect(titleOf(host)).toEqual('December 2025')
  viewButton(host, 'Day').click()
  await microtask()
  namedButton(host, 'Next').click()
  expect(titleOf(host)).toEqual('Monday, 29 December 2025')
  viewButton(host, 'Week').click()
  await microtask()
  namedButton(host, 'Next').click()
  expect(columnOf(host, '2026-01-05') !== null).toEqual(true)
  toolbarButtons(host)[0].click()
  viewButton(host, 'Month').click()
  await microtask()
  expect(titleOf(host)).toEqual('September 2026')
}, NOW)

test('a press on the active view keeps it pressed', async () => {
  const host = mounted(calendar({ label: 'Team', date: '2026-09-21' }))
  viewButton(host, 'Month').click()
  await microtask()
  expect(viewButton(host, 'Month').getAttribute('aria-checked')).toEqual('true')
  expect(innerAll(host, '.cell').length).toEqual(42)
})

test('writable view and date states follow the toolbar, and the calendar follows them', async () => {
  const { states, host } = withStates(
    { view: 'month', date: '2026-09-21', items: ITEMS },
    ({ view, date, items }) => calendar({ label: 'Team', view, date, items }),
  )
  viewButton(host, 'Week').click()
  await microtask()
  expect(states.view.get()).toEqual('week')
  namedButton(host, 'Next').click()
  expect(states.date.get()).toEqual('2026-09-28')
  states.view.set('day')
  await microtask()
  expect(innerAll(host, '.column').length).toEqual(1)
  expect(viewButton(host, 'Day').getAttribute('aria-checked')).toEqual('true')
  states.date.set('2026-09-21')
  expect(innerAll(host, '.block').length).toEqual(4)
  states.items.set([...ITEMS, { id: 6, title: 'Call', start: '2026-09-21T17:00' }])
  expect(innerAll(host, '.block').length).toEqual(5)
  expect(innerAll(host, '.block')[4].getAttribute('aria-label')).toMatch(/^Call, 17:00.+18:00$/)
})

test('the focus stays on the same event when the items change', () => {
  const { states, host } = withStates(
    { items: ITEMS },
    ({ items }) => calendar({ label: 'Team', items, date: '2026-09-21' }),
  )
  const chip = cellOf(host, '2026-09-24').querySelector('.event')
  chip.focus()
  states.items.set(ITEMS.filter(({ id }) => id !== 5))
  const focused = host.shadowRoot.activeElement
  expect(focused.getAttribute('aria-label')).toContain('Offsite')
  expect(focused.closest('.cell').dataset.date).toEqual('2026-09-24')
})

test('the words and the dates follow the language', async () => {
  const host = mounted(calendar({ label: 'Zespol', items: ITEMS, date: '2026-09-21' }))
  document.documentElement.setAttribute('lang', 'pl')
  await settled()
  expect(titleOf(host)).toMatch(/^wrzesie. 2026$/)
})

test('overlapping events share the width of their day', () => {
  const items = normalizeItems([
    { id: 'a', title: 'A', start: '2026-09-21T09:00', end: '2026-09-21T11:00' },
    { id: 'b', title: 'B', start: '2026-09-21T09:30', end: '2026-09-21T10:00' },
    { id: 'c', title: 'C', start: '2026-09-21T10:00', end: '2026-09-21T11:00' },
    { id: 'd', title: 'D', start: '2026-09-21T14:00', end: '2026-09-21T15:00' },
    { id: 'e', title: 'E', start: '2026-09-20T22:00', end: '2026-09-21T01:00' },
  ])
  const placed = timedSegmentsOn(items, parseDate('2026-09-21'))
    .map(({ item, startMinutes, endMinutes, column, columns }) => [
      item.key,
      startMinutes,
      endMinutes,
      column,
      columns,
    ])
  expect(placed).toEqual([
    ['e', 0, 60, 0, 1],
    ['a', 540, 660, 0, 2],
    ['b', 570, 600, 1, 2],
    ['c', 600, 660, 1, 2],
    ['d', 840, 900, 0, 1],
  ])
  const dayBefore = timedSegmentsOn(items, parseDate('2026-09-20'))
  expect(dayBefore.map(({ startMinutes, endMinutes }) => [startMinutes, endMinutes]))
    .toEqual([[1320, 1440]])
})

test('calendar warns about bad props and continues', () => {
  const warn = warnings()
  mounted(calendar({ items: ITEMS }))
  expect(warned(warn, "pass a 'label'")).toBeTruthy()
  const host = mounted(calendar({ label: 'A', view: 'year', date: 'soon', items: 'none' }))
  expect(warned(warn, "'view' must be one of")).toBeTruthy()
  expect(warned(warn, "'date' must be a date")).toBeTruthy()
  expect(warned(warn, "'items' must be an array")).toBeTruthy()
  expect(innerAll(host, '.cell').length).toEqual(42)
  mounted(calendar({
    label: 'B',
    items: [
      { title: 'No start' },
      { id: 1, title: 'Backwards', start: '2026-09-21T10:00', end: '2026-09-21T09:00' },
      { id: 2, title: 'Tinted', start: '2026-09-21', color: '#ff0000' },
      'text',
    ],
  }))
  expect(warned(warn, "needs a 'start'")).toBeTruthy()
  expect(warned(warn, "has an 'end' that is not a date after its 'start'")).toBeTruthy()
  expect(warned(warn, 'is not a palette name')).toBeTruthy()
  expect(warned(warn, "not an object with a 'title'")).toBeTruthy()
  mounted(calendar({ label: 'C', data: [] }))
  expect(warned(warn, "unknown prop 'data'")).toBeTruthy()
})
