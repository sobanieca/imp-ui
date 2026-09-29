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

const eventsOn = (host, date) =>
  innerAll(host, '.week > .event').filter((node) =>
    node.dataset.from <= date && node.dataset.to >= date
  )

const dayNumberOf = (host, date) => inner(host, `.day-number[data-key='day:${date}']`)

const moreOn = (host, date) => inner(host, `.more[data-key='more:${date}']`)

const slotOf = (host, moment) => inner(host, `.slot[data-key='slot:${moment}']`)

const focusedIn = (host) => host.shadowRoot.activeElement

const press = (node, key) =>
  node.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true }))

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
  const offsite = eventsOn(host, '2026-09-24')[0]
  expect(offsite.localName).toEqual('button')
  expect(offsite.getAttribute('aria-label')).toMatch(/^Offsite, All day, 23.+25 Sept$/)
  expect(eventsOn(host, '2026-09-23')).toEqual([offsite])
  expect(eventsOn(host, '2026-09-25')).toEqual([offsite])
  expect(eventsOn(host, '2026-09-26').length).toEqual(0)
  const standup = eventsOn(host, '2026-09-21').find((node) => node.classList.contains('color-blue'))
  expect(standup.getAttribute('aria-label')).toMatch(/^Standup, 09:00.+09:15$/)
  expect(standup.classList.contains('color-blue')).toEqual(true)
  expect(standup.querySelector('.event-time').textContent).toEqual('09:00')
})

test('a multi-day event is one bar per week, spanning its days', () => {
  const host = mounted(calendar({
    label: 'Team',
    date: '2026-09-21',
    items: [{ id: 'trip', title: 'Trip', start: '2026-09-26', end: '2026-09-29' }],
  }))
  const bars = innerAll(host, '.week > .bar')
  expect(bars.length).toEqual(2)
  expect([bars[0].dataset.from, bars[0].dataset.to]).toEqual(['2026-09-26', '2026-09-27'])
  expect(bars[0].style.getPropertyValue('grid-column')).toEqual('6 / span 2')
  expect(bars[0].classList.contains('to-after')).toEqual(true)
  expect(bars[0].classList.contains('from-before')).toEqual(false)
  expect([bars[1].dataset.from, bars[1].dataset.to]).toEqual(['2026-09-28', '2026-09-29'])
  expect(bars[1].style.getPropertyValue('grid-column')).toEqual('1 / span 2')
  expect(bars[1].classList.contains('from-before')).toEqual(true)
  expect(bars[1].classList.contains('to-after')).toEqual(false)
  expect(bars.map((bar) => bar.getAttribute('aria-label')))
    .toEqual([bars[0].getAttribute('aria-label'), bars[0].getAttribute('aria-label')])
})

test('a bar keeps its lane on every day, and a later chip goes under it', () => {
  const host = mounted(calendar({
    label: 'Team',
    date: '2026-09-21',
    items: [
      { id: 'bar', title: 'Sprint', start: '2026-09-21', end: '2026-09-23' },
      { id: 'chip', title: 'Call', start: '2026-09-22T09:00' },
    ],
  }))
  const [bar] = eventsOn(host, '2026-09-21')
  const chip = eventsOn(host, '2026-09-22').find((node) => node !== bar)
  expect(bar.style.getPropertyValue('grid-row')).toEqual('2')
  expect(bar.style.getPropertyValue('grid-column')).toEqual('1 / span 3')
  expect(chip.classList.contains('chip')).toEqual(true)
  expect(chip.style.getPropertyValue('grid-row')).toEqual('3')
  expect(chip.style.getPropertyValue('grid-column')).toEqual('2 / span 1')
})

test('a bar in the last lane hides on a full day, and each day it covers counts it', () => {
  const host = mounted(calendar({
    label: 'Team',
    date: '2026-09-21',
    items: [
      { id: 'm1', title: 'M1', start: '2026-09-21', end: '2026-09-22' },
      { id: 'm2', title: 'M2', start: '2026-09-21', end: '2026-09-22' },
      { id: 'y', title: 'Y', start: '2026-09-22', end: '2026-09-23' },
      { id: 't', title: 'T', start: '2026-09-22T10:00' },
    ],
  }))
  const titles = (date) =>
    eventsOn(host, date).map((node) => node.querySelector('.event-title').textContent)
  expect(titles('2026-09-21')).toEqual(['M1', 'M2'])
  expect(titles('2026-09-22')).toEqual(['M1', 'M2'])
  expect(titles('2026-09-23')).toEqual([])
  expect(moreOn(host, '2026-09-21')).toEqual(null)
  expect(moreOn(host, '2026-09-22').getAttribute('aria-label')).toEqual('+2 more')
  expect(moreOn(host, '2026-09-23').getAttribute('aria-label')).toEqual('+1 more')
  expect(moreOn(host, '2026-09-23').style.getPropertyValue('grid-row')).toEqual('4')
})

test('a busy day shows two chips and a more button that opens the day view', async () => {
  const host = mounted(calendar({ label: 'Team', items: ITEMS, date: '2026-09-21' }))
  expect(eventsOn(host, '2026-09-21').length).toEqual(2)
  const more = moreOn(host, '2026-09-21')
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
  eventsOn(host, '2026-09-21').find((node) => node.classList.contains('color-blue')).click()
  expect(seen.length).toEqual(1)
  expect(seen[0].id).toEqual(1)
  expect(seen[0].item.title).toEqual('Standup')
})

test('the day number in the month view reports an all-day slot', () => {
  const seen = []
  const host = mounted(calendar({ label: 'Team', date: '2026-09-21' }))
  host.addEventListener('slotSelect', (event) => seen.push(event.detail))
  const day = dayNumberOf(host, '2026-09-10')
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
  slotOf(host, '2026-09-23T10:00').click()
  expect(seen[1]).toEqual({ start: '2026-09-23T10:00', end: '2026-09-23T11:00', allDay: false })
})

test('the time grid is one tab stop of named half-hour slots', async () => {
  const host = mounted(calendar({ label: 'Team', date: '2026-09-23', view: 'week' }))
  await microtask()
  const slots = innerAll(host, '.slot')
  expect(slots.length).toEqual(7 * 48)
  expect(slots.every((slot) => slot.localName === 'button')).toEqual(true)
  const resting = slots.filter((slot) => slot.getAttribute('tabindex') === '0')
  expect(resting).toEqual([slotOf(host, '2026-09-23T07:00')])
  expect(resting[0].getAttribute('aria-label')).toEqual('Wednesday 23 September at 7:00')
})

test('the arrow keys move across the time slots, and Enter makes a slot at that time', async () => {
  const seen = []
  const host = mounted(calendar({
    label: 'Team',
    date: '2026-09-23',
    view: 'week',
    events: { slotSelect: (event) => seen.push(event.detail) },
  }))
  await microtask()
  const start = slotOf(host, '2026-09-23T07:00')
  start.focus()
  press(start, 'ArrowDown')
  press(focusedIn(host), 'ArrowDown')
  expect(focusedIn(host)).toEqual(slotOf(host, '2026-09-23T08:00'))
  press(focusedIn(host), 'ArrowRight')
  expect(focusedIn(host)).toEqual(slotOf(host, '2026-09-24T08:00'))
  press(focusedIn(host), 'ArrowUp')
  expect(focusedIn(host)).toEqual(slotOf(host, '2026-09-24T07:30'))
  expect(start.getAttribute('tabindex')).toEqual('-1')
  expect(focusedIn(host).getAttribute('tabindex')).toEqual('0')
  press(focusedIn(host), 'End')
  expect(focusedIn(host)).toEqual(slotOf(host, '2026-09-24T23:30'))
  press(focusedIn(host), 'ArrowDown')
  expect(focusedIn(host)).toEqual(slotOf(host, '2026-09-24T23:30'))
  press(focusedIn(host), 'Home')
  focusedIn(host).click()
  expect(seen).toEqual([{ start: '2026-09-24T00:00', end: '2026-09-24T01:00', allDay: false }])
})

test('an arrow key past the edge of the week moves to the next week and keeps the time', async () => {
  const host = mounted(calendar({ label: 'Team', date: '2026-09-27', view: 'week' }))
  await microtask()
  const sunday = slotOf(host, '2026-09-27T07:00')
  sunday.focus()
  press(sunday, 'ArrowRight')
  await microtask()
  expect(titleOf(host)).toContain('28 Sept')
  expect(focusedIn(host)).toEqual(slotOf(host, '2026-09-28T07:00'))
  press(focusedIn(host), 'ArrowLeft')
  await microtask()
  expect(focusedIn(host)).toEqual(slotOf(host, '2026-09-27T07:00'))
})

const inTimeZone = async (zone, run) => {
  const previous = Deno.env.get('TZ')
  Deno.env.set('TZ', zone)
  try {
    await run()
  } finally {
    if (previous === undefined) Deno.env.delete('TZ')
    else Deno.env.set('TZ', previous)
  }
}

const slotStarts = (host, date) =>
  [...columnOf(host, date).querySelectorAll('.slot')].map((slot) => slot.dataset.key.slice(16))

const halfHours = (from, to) =>
  Array.from({ length: (to - from) * 2 }, (_unused, index) => {
    const minutes = from * 60 + index * 30
    return `${String(Math.floor(minutes / 60)).padStart(2, '0')}:${minutes % 60 ? '30' : '00'}`
  })

test('on a day that skips an hour, the time grid has no slot for the missing hour', async () => {
  await inTimeZone('Europe/Warsaw', async () => {
    const seen = []
    const host = mounted(calendar({
      label: 'Team',
      date: '2026-03-29',
      view: 'day',
      events: { slotSelect: (event) => seen.push(event.detail) },
    }))
    await microtask()
    expect(slotStarts(host, '2026-03-29')).toEqual([...halfHours(0, 2), ...halfHours(3, 24)])
    const hours = innerAll(host, '.hours .hour').map((node) => node.textContent).filter(Boolean)
    expect(new Set(hours).size).toEqual(23)
    const early = slotOf(host, '2026-03-29T01:30')
    early.focus()
    press(early, 'ArrowDown')
    expect(focusedIn(host)).toEqual(slotOf(host, '2026-03-29T03:00'))
    press(focusedIn(host), 'ArrowDown')
    expect(focusedIn(host)).toEqual(slotOf(host, '2026-03-29T03:30'))
    press(focusedIn(host), 'ArrowUp')
    press(focusedIn(host), 'ArrowUp')
    expect(focusedIn(host)).toEqual(early)
    for (const slot of innerAll(host, '.slot')) slot.click()
    expect(seen.every(({ start, end }) => end > start)).toEqual(true)
    expect(new Set(seen.map(({ start }) => start)).size).toEqual(46)
    expect(seen.find(({ start }) => start === '2026-03-29T01:30').end).toEqual('2026-03-29T03:30')
    expect(seen.find(({ start }) => start === '2026-03-29T03:00').end).toEqual('2026-03-29T04:00')
  })
})

test('an arrow key into the missing hour of the next day moves to the first slot after it', async () => {
  await inTimeZone('Europe/Warsaw', async () => {
    const host = mounted(calendar({ label: 'Team', date: '2026-03-28', view: 'week' }))
    await microtask()
    const saturday = slotOf(host, '2026-03-28T02:30')
    saturday.focus()
    press(saturday, 'ArrowRight')
    expect(focusedIn(host)).toEqual(slotOf(host, '2026-03-29T03:00'))
    press(focusedIn(host), 'ArrowLeft')
    expect(focusedIn(host)).toEqual(slotOf(host, '2026-03-28T03:00'))
  })
})

test('on a day that repeats an hour, the time grid keeps one slot for each half hour', async () => {
  await inTimeZone('Europe/Warsaw', async () => {
    const seen = []
    const host = mounted(calendar({
      label: 'Team',
      date: '2026-10-25',
      view: 'day',
      events: { slotSelect: (event) => seen.push(event.detail) },
    }))
    await microtask()
    expect(slotStarts(host, '2026-10-25')).toEqual(halfHours(0, 24))
    const repeated = slotOf(host, '2026-10-25T02:30')
    repeated.focus()
    press(repeated, 'ArrowDown')
    expect(focusedIn(host)).toEqual(slotOf(host, '2026-10-25T03:00'))
    slotOf(host, '2026-10-25T02:00').click()
    expect(seen).toEqual([{ start: '2026-10-25T02:00', end: '2026-10-25T03:00', allDay: false }])
  })
})

test('in a right-to-left page ArrowLeft moves to the next day', async () => {
  const host = mounted(calendar({ label: 'Team', date: '2026-09-23', view: 'week' }))
  host.style.direction = 'rtl'
  await microtask()
  const start = slotOf(host, '2026-09-23T07:00')
  start.focus()
  press(start, 'ArrowLeft')
  expect(focusedIn(host)).toEqual(slotOf(host, '2026-09-24T07:00'))
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
  const bar = eventsOn(host, '2026-09-24')[0]
  bar.focus()
  states.items.set(ITEMS.filter(({ id }) => id !== 5))
  const focused = host.shadowRoot.activeElement
  expect(focused === bar).toEqual(false)
  expect(focused.getAttribute('aria-label')).toContain('Offsite')
  expect(focused.dataset.from).toEqual('2026-09-23')
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
