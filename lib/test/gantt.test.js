import { component, mount } from 'imp'
import { gantt } from 'imp/std/data'
import { initState } from 'imp/state'
import { beforeEach, expect, spy, test } from 'imp/test'
import { renderedText } from './shadow.js'

const stateHost = component('gantt-state-host', { setup: (self, render) => render(self) })

const mounted = (host) => {
  mount(document.body, host)
  return host
}

const shadow = (host, selector) => host.shadowRoot.querySelector(selector)

const all = (host, selector) => [...host.shadowRoot.querySelectorAll(selector)]

const click = (node) => node.dispatchEvent(new MouseEvent('click', { bubbles: true }))

const warnings = () => spy(console, 'warn', () => {})

const warned = (warn, text) => warn.calls.some(([first]) => String(first).includes(text))

const custom = (node, name) => node.style.getPropertyValue(name)

const texts = (host, selector) => all(host, selector).map(renderedText)

const pad = (value) => String(value).padStart(2, '0')

const isoOf = (date) => `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`

const daysFromToday = (count) => {
  const now = new Date()
  return isoOf(new Date(now.getFullYear(), now.getMonth(), now.getDate() + count))
}

const plan = () => [
  { id: 'design', label: 'Design', start: '2026-09-01', end: '2026-09-12', progress: 100 },
  { id: 'build', label: 'Build', start: '2026-09-10', end: '2026-10-02', progress: 40 },
  { id: 'launch', label: 'Launch', start: '2026-10-05', end: '2026-10-05', color: 'green' },
]

beforeEach(() => {
  document.body.replaceChildren()
  document.documentElement.setAttribute('lang', 'en')
})

test('gantt renders a labelled, focusable scroll region over a list of tasks', () => {
  const host = mounted(gantt({ label: 'Release plan', tasks: plan() }))
  expect(host.localName).toEqual('imp-gantt')
  const scroll = shadow(host, '.scroll')
  expect(scroll.getAttribute('role')).toEqual('group')
  expect(scroll.getAttribute('aria-label')).toEqual('Release plan')
  expect(scroll.tabIndex).toEqual(0)
  expect(shadow(host, '.rows').getAttribute('role')).toEqual('list')
  expect(all(host, 'li.task').length).toEqual(3)
  expect(texts(host, '.name')).toEqual(['Design', 'Build', 'Launch'])
  expect(all(host, 'button').length).toEqual(0)
})

test('gantt gives every task its dates and progress as text', () => {
  const host = mounted(gantt({ label: 'Release plan', tasks: plan() }))
  const details = texts(host, '.details')
  expect(details[0]).toEqual('Sep 1, 2026 to Sep 12, 2026, 100% complete')
  expect(details[1]).toEqual('Sep 10, 2026 to Oct 2, 2026, 40% complete')
  expect(details[2]).toEqual('Milestone on Oct 5, 2026')
  expect(shadow(host, '.track').getAttribute('aria-hidden')).toEqual('true')
  expect(shadow(host, '.header').getAttribute('aria-hidden')).toEqual('true')
})

test('gantt places a bar by its offset and length in days, end inclusive', () => {
  const host = mounted(gantt({ label: 'Release plan', scale: 'day', tasks: plan() }))
  expect(shadow(host, '.root').classList.contains('scale-day')).toBeTruthy()
  expect(custom(shadow(host, '.root'), '--total-days')).toEqual('35')
  const [design, build] = all(host, '.bar')
  expect(custom(design, '--offset')).toEqual('0')
  expect(custom(design, '--days')).toEqual('12')
  expect(custom(build, '--offset')).toEqual('9')
  expect(custom(build, '--days')).toEqual('23')
  expect(custom(design.querySelector('.fill'), '--progress')).toEqual('100%')
  expect(custom(build.querySelector('.fill'), '--progress')).toEqual('40%')
})

test('gantt draws a task that starts and ends on one day as a milestone', () => {
  const host = mounted(gantt({ label: 'Release plan', scale: 'day', tasks: plan() }))
  const milestones = all(host, '.milestone')
  expect(milestones.length).toEqual(1)
  expect(custom(milestones[0], '--offset')).toEqual('34')
  expect(custom(milestones[0], '--task-color')).toContain('--imp-color-green')
  expect(all(host, '.bar').length).toEqual(2)
})

test('gantt pads a week scale to whole weeks of the active language', () => {
  const host = mounted(gantt({ label: 'Release plan', scale: 'week', tasks: plan() }))
  expect(shadow(host, '.root').classList.contains('scale-week')).toBeTruthy()
  expect(custom(shadow(host, '.root'), '--total-days')).toEqual('42')
  expect(all(host, '.unit-cell').length).toEqual(6)
  expect(texts(host, '.unit-cell')[0]).toEqual('Aug 30')
  expect(custom(all(host, '.bar')[0], '--offset')).toEqual('2')
  expect(texts(host, '.span-text')).toEqual(['August 2026', 'September 2026', 'October 2026'])
})

test('gantt pads a month scale to whole months under a row of years', () => {
  const host = mounted(gantt({ label: 'Release plan', scale: 'month', tasks: plan() }))
  expect(custom(shadow(host, '.root'), '--total-days')).toEqual('61')
  expect(texts(host, '.unit-cell')).toEqual(['Sep', 'Oct'])
  expect(all(host, '.unit-cell').map((cell) => custom(cell, '--days'))).toEqual(['30', '31'])
  expect(texts(host, '.span-text')).toEqual(['2026'])
})

test('gantt picks the scale from the span of the tasks', () => {
  const short = mounted(gantt({ label: 'Sprint', tasks: plan() }))
  expect(shadow(short, '.root').classList.contains('scale-day')).toBeTruthy()
  const long = mounted(
    gantt({
      label: 'Roadmap',
      tasks: [{ label: 'Search', start: '2026-01-10', end: '2026-12-20' }],
    }),
  )
  expect(shadow(long, '.root').classList.contains('scale-month')).toBeTruthy()
})

test('gantt lists the tasks of one group under one heading, in order of first appearance', () => {
  const host = mounted(
    gantt({
      label: 'Release plan',
      tasks: [
        { label: 'Research', start: '2026-09-01', end: '2026-09-03', group: 'Design' },
        { label: 'API', start: '2026-09-02', end: '2026-09-08', group: 'Engineering' },
        { label: 'Mockups', start: '2026-09-04', end: '2026-09-09', group: 'Design' },
      ],
    }),
  )
  const headings = all(host, '.group-row .name')
  expect(headings.map(renderedText)).toEqual(['Design', 'Engineering'])
  const lists = all(host, '.group > ul')
  expect(lists[0].getAttribute('aria-labelledby')).toEqual(headings[0].id)
  expect([...lists[0].querySelectorAll('.task .name')].map(renderedText)).toEqual([
    'Research',
    'Mockups',
  ])
  expect([...lists[1].querySelectorAll('.task .name')].map(renderedText)).toEqual(['API'])
})

test('gantt marks today when the range covers it', () => {
  const host = mounted(
    gantt({
      label: 'Now',
      scale: 'day',
      tasks: [{ label: 'Current', start: daysFromToday(-2), end: daysFromToday(3) }],
    }),
  )
  expect(custom(shadow(host, '.today'), '--offset')).toEqual('2')
  expect(all(host, '.unit-cell.current').length).toEqual(1)
  const past = mounted(
    gantt({ label: 'Then', tasks: [{ label: 'Old', start: '2020-01-01', end: '2020-01-05' }] }),
  )
  expect(shadow(past, '.today')).toEqual(null)
})

test('gantt renders each task as a button and reports a select on click', () => {
  const chosen = []
  const host = mounted(
    gantt({
      label: 'Release plan',
      tasks: plan(),
      events: { select: (event) => chosen.push(event.detail) },
    }),
  )
  const buttons = all(host, 'button.name')
  expect(buttons.length).toEqual(3)
  expect(buttons[1].localName).toEqual('button')
  expect(buttons[1].getAttribute('type')).toEqual('button')
  expect(renderedText(buttons[1])).toEqual('Build')
  const described = host.shadowRoot.getElementById(buttons[1].getAttribute('aria-describedby'))
  expect(renderedText(described)).toContain('40% complete')
  click(buttons[1])
  click(shadow(host, '.milestone'))
  expect(chosen).toEqual([{ id: 'build' }, { id: 'launch' }])
})

test('gantt keeps the focus on a task button when the tasks change', () => {
  let tasks
  const outer = mounted(
    stateHost((self) => {
      tasks = initState(self, 'test.gantt.focus', plan())
      return gantt({ label: 'Release plan', tasks, events: { select: () => {} } })
    }),
  )
  const host = outer.shadowRoot.querySelector('imp-gantt')
  all(host, 'button.name')[1].focus()
  tasks.set(plan().map((task) => ({ ...task, progress: 50 })))
  const focused = host.shadowRoot.activeElement
  expect(focused.localName).toEqual('button')
  expect(renderedText(focused)).toEqual('Build')
})

test('gantt redraws the rows when the tasks state changes and keeps the scroll region', () => {
  let tasks
  const outer = mounted(
    stateHost((self) => {
      tasks = initState(self, 'test.gantt.tasks', plan())
      return gantt({ label: 'Release plan', tasks })
    }),
  )
  const host = outer.shadowRoot.querySelector('imp-gantt')
  const scroll = shadow(host, '.scroll')
  expect(all(host, 'li.task').length).toEqual(3)
  tasks.set([{ id: 'only', label: 'Only', start: '2026-09-01', end: '2026-09-02' }])
  expect(texts(host, '.name')).toEqual(['Only'])
  expect(custom(shadow(host, '.root'), '--total-days')).toEqual('2')
  expect(shadow(host, '.scroll') === scroll).toBeTruthy()
})

test('gantt writes the header and the dates again when the language changes', async () => {
  const host = mounted(gantt({ label: 'Release plan', scale: 'month', tasks: plan() }))
  expect(texts(host, '.unit-cell')).toEqual(['Sep', 'Oct'])
  document.documentElement.setAttribute('lang', 'pl')
  await new Promise((resolve) => setTimeout(resolve))
  expect(texts(host, '.unit-cell')[0]).toEqual('wrz')
  document.documentElement.setAttribute('lang', 'en')
  await new Promise((resolve) => setTimeout(resolve))
})

test('gantt skips a task with a bad date or an end before its start', () => {
  const warn = warnings()
  const host = mounted(
    gantt({
      label: 'Release plan',
      tasks: [
        { label: 'No dates' },
        { label: 'Not a date', start: '2026-02-31', end: '2026-03-02' },
        { label: 'Backwards', start: '2026-09-10', end: '2026-09-01' },
        { label: 'Fine', start: '2026-09-01', end: '2026-09-02' },
      ],
    }),
  )
  expect(texts(host, '.name')).toEqual(['Fine'])
  expect(warned(warn, "'No dates' needs 'start' and 'end' as ISO dates")).toBeTruthy()
  expect(warned(warn, "'Not a date' needs 'start' and 'end'")).toBeTruthy()
  expect(warned(warn, "'Backwards' has an 'end' before its 'start'")).toBeTruthy()
})

test('gantt warns about a missing label, an unknown scale, a bad color and bad progress', () => {
  const warn = warnings()
  const host = mounted(
    gantt({
      scale: 'year',
      tasks: [
        { label: 'Paint', start: '2026-09-01', end: '2026-09-02', color: '#f00', progress: 'half' },
        { label: 'Over', start: '2026-09-01', end: '2026-09-02', progress: 140 },
      ],
    }),
  )
  expect(warned(warn, "pass a 'label'")).toBeTruthy()
  expect(warned(warn, "'scale' must be one of")).toBeTruthy()
  expect(warned(warn, "'#f00'")).toBeTruthy()
  expect(warned(warn, "'progress' of task 'Paint'")).toBeTruthy()
  expect(all(host, '.fill').map((fill) => custom(fill, '--progress'))).toEqual(['100%'])
})
