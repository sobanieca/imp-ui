import { component, mount } from 'imp'
import { datePicker, form } from 'imp/std/inputs'
import { initState, useState } from 'imp/state'
import { beforeEach, expect, spy, test } from 'imp/test'

const NOW = { fakeTimers: { now: new Date(2026, 8, 21, 10, 0) } }

const mounted = (host) => {
  mount(document.body, host)
  return host
}

const inner = (host, selector) => host.shadowRoot.querySelector(selector)

const innerAll = (host, selector) => [...host.shadowRoot.querySelectorAll(selector)]

const triggerOf = (host) => inner(host, '#control')

const panelOf = (host) => inner(host, '#panel')

const dayOf = (host, date) => inner(host, `.day[data-date='${date}']`)

const focusedDate = (host) => host.shadowRoot.activeElement?.dataset.date

const invoke = (node) => {
  node.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, composed: true }))
  node.dispatchEvent(new MouseEvent('click', { bubbles: true, composed: true }))
}

const press = (node, key, extra = {}) =>
  node.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true, composed: true, ...extra }))

const isOpen = (host) => triggerOf(host).getAttribute('aria-expanded') === 'true'

const warnings = () => spy(console, 'warn', () => {})

const warned = (warn, text) => warn.calls.some(([first]) => String(first).includes(text))

const stateHost = component('date-picker-state-host', {
  setup: (self, render) => render(self),
})

const withState = (name, initial, render) => {
  let state
  const host = mounted(stateHost((self) => {
    state = initState(self, name, initial)
    return render(state)
  }))
  return { state, picker: host.shadowRoot.querySelector('imp-date-picker') }
}

beforeEach(() => {
  document.body.replaceChildren()
  document.documentElement.setAttribute('lang', 'en-GB')
})

test('datePicker renders a labelled trigger that shows the formatted date', () => {
  const host = mounted(datePicker({ value: '2026-09-21', label: 'Due date' }))
  expect(host.localName).toEqual('imp-date-picker')
  const trigger = triggerOf(host)
  expect(trigger.localName).toEqual('button')
  expect(trigger.getAttribute('aria-haspopup')).toEqual('dialog')
  expect(trigger.getAttribute('aria-expanded')).toEqual('false')
  expect(inner(host, 'label').getAttribute('for')).toEqual('control')
  expect(inner(host, 'label').textContent).toContain('Due date')
  expect(inner(host, '#value').textContent).toEqual('21 Sept 2026')
  expect(trigger.getAttribute('aria-describedby')).toContain('value')
})

test('an empty datePicker shows its placeholder and no clear button', () => {
  const host = mounted(datePicker({ label: 'Due date', placeholder: 'No date' }))
  expect(inner(host, '#value').textContent).toEqual('No date')
  expect(inner(host, '#value').classList.contains('placeholder')).toEqual(true)
  expect(inner(host, '.clear').hidden).toEqual(true)
})

test('the trigger opens a dialog with a month grid and focuses the chosen day', () => {
  const host = mounted(datePicker({ value: '2026-09-21', label: 'Due date' }))
  const panel = panelOf(host)
  expect(panel.getAttribute('popover')).toEqual('auto')
  expect(panel.getAttribute('role')).toEqual('dialog')
  expect(panel.getAttribute('aria-label')).toEqual('Choose a date')
  invoke(triggerOf(host))
  expect(isOpen(host)).toEqual(true)
  const grid = inner(host, "[role='grid']")
  expect(grid.getAttribute('aria-labelledby')).toEqual('month-title')
  expect(inner(host, '#month-title').textContent).toEqual('September 2026')
  expect(innerAll(host, "[role='columnheader']").length).toEqual(7)
  expect(innerAll(host, "[role='columnheader']")[0].getAttribute('aria-label')).toEqual('Monday')
  expect(innerAll(host, "button[role='gridcell']").length).toEqual(42)
  expect(innerAll(host, "[role='row']").length).toEqual(7)
  const chosen = dayOf(host, '2026-09-21')
  expect(chosen.getAttribute('aria-selected')).toEqual('true')
  expect(chosen.getAttribute('aria-label')).toEqual('Monday, 21 September 2026')
  expect(chosen.tabIndex).toEqual(0)
  expect(focusedDate(host)).toEqual('2026-09-21')
  expect(innerAll(host, ".day[tabindex='0']").length).toEqual(1)
})

test('the first day of the week follows the language', () => {
  document.documentElement.setAttribute('lang', 'en-US')
  const host = mounted(datePicker({ value: '2026-09-21', label: 'Due date' }))
  invoke(triggerOf(host))
  expect(innerAll(host, "[role='columnheader']")[0].getAttribute('aria-label')).toEqual('Sunday')
  expect(innerAll(host, '.day')[0].dataset.date).toEqual('2026-08-30')
})

test('today is marked with aria-current', () => {
  const host = mounted(datePicker({ label: 'Due date' }))
  invoke(triggerOf(host))
  expect(dayOf(host, '2026-09-21').getAttribute('aria-current')).toEqual('date')
  expect(innerAll(host, "[aria-current='date']").length).toEqual(1)
  expect(focusedDate(host)).toEqual('2026-09-21')
}, NOW)

test('arrow keys, Home, End and the page keys move the focused day', () => {
  const host = mounted(datePicker({ value: '2026-09-23', label: 'Due date' }))
  invoke(triggerOf(host))
  const step = (key, extra) => press(host.shadowRoot.activeElement, key, extra)
  step('ArrowRight')
  expect(focusedDate(host)).toEqual('2026-09-24')
  step('ArrowLeft')
  step('ArrowLeft')
  expect(focusedDate(host)).toEqual('2026-09-22')
  step('ArrowDown')
  expect(focusedDate(host)).toEqual('2026-09-29')
  step('ArrowUp')
  expect(focusedDate(host)).toEqual('2026-09-22')
  step('Home')
  expect(focusedDate(host)).toEqual('2026-09-21')
  step('End')
  expect(focusedDate(host)).toEqual('2026-09-27')
  step('PageDown')
  expect(focusedDate(host)).toEqual('2026-10-27')
  expect(inner(host, '#month-title').textContent).toEqual('October 2026')
  step('PageUp')
  step('PageUp')
  expect(focusedDate(host)).toEqual('2026-08-27')
  step('PageDown', { shiftKey: true })
  expect(focusedDate(host)).toEqual('2027-08-27')
  expect(innerAll(host, ".day[tabindex='0']").length).toEqual(1)
})

test('in a right-to-left context ArrowLeft moves to the next day', () => {
  const host = mounted(datePicker({ value: '2026-09-23', label: 'Due date' }))
  invoke(triggerOf(host))
  spy(globalThis, 'getComputedStyle', () => ({ direction: 'rtl' }))
  press(host.shadowRoot.activeElement, 'ArrowLeft')
  expect(focusedDate(host)).toEqual('2026-09-24')
  press(host.shadowRoot.activeElement, 'ArrowRight')
  press(host.shadowRoot.activeElement, 'ArrowRight')
  expect(focusedDate(host)).toEqual('2026-09-22')
})

test('a pick writes the ISO date into the state, closes the panel and returns the focus', () => {
  const { state, picker } = withState(
    'test.dueDate',
    '2026-09-21',
    (value) => datePicker({ value, label: 'Due date' }),
  )
  invoke(triggerOf(picker))
  press(picker.shadowRoot.activeElement, 'ArrowRight')
  picker.shadowRoot.activeElement.click()
  expect(state.get()).toEqual('2026-09-22')
  expect(isOpen(picker)).toEqual(false)
  expect(picker.shadowRoot.activeElement).toEqual(triggerOf(picker))
  expect(inner(picker, '#value').textContent).toEqual('22 Sept 2026')
  state.set('2026-12-24')
  expect(inner(picker, '#value').textContent).toEqual('24 Dec 2026')
})

test('Escape closes the panel and hands the focus back to the trigger', () => {
  const host = mounted(datePicker({ value: '2026-09-21', label: 'Due date' }))
  invoke(triggerOf(host))
  press(host.shadowRoot.activeElement, 'Escape')
  expect(isOpen(host)).toEqual(false)
  expect(host.shadowRoot.activeElement).toEqual(triggerOf(host))
})

test('the month buttons are named and move the month', () => {
  const host = mounted(datePicker({ value: '2026-09-21', label: 'Due date' }))
  invoke(triggerOf(host))
  const [previous, next] = innerAll(host, '.month-bar imp-button')
    .map((node) => node.shadowRoot.querySelector('button'))
  expect(previous.getAttribute('aria-label')).toEqual('Previous month')
  expect(next.getAttribute('aria-label')).toEqual('Next month')
  next.click()
  expect(inner(host, '#month-title').textContent).toEqual('October 2026')
  previous.click()
  previous.click()
  expect(inner(host, '#month-title').textContent).toEqual('August 2026')
  expect(inner(host, '#month-title').getAttribute('aria-live')).toEqual('polite')
})

test('days outside min and max are aria-disabled and cannot be picked', () => {
  const { state, picker } = withState(
    'test.limited',
    '2026-09-15',
    (value) => datePicker({ value, label: 'Day', min: '2026-09-10', max: '2026-09-20' }),
  )
  invoke(triggerOf(picker))
  expect(dayOf(picker, '2026-09-09').getAttribute('aria-disabled')).toEqual('true')
  expect(dayOf(picker, '2026-09-21').getAttribute('aria-disabled')).toEqual('true')
  expect(dayOf(picker, '2026-09-10').hasAttribute('aria-disabled')).toEqual(false)
  dayOf(picker, '2026-09-09').click()
  expect(state.get()).toEqual('2026-09-15')
  expect(isOpen(picker)).toEqual(true)
  press(picker.shadowRoot.activeElement, 'PageDown')
  expect(focusedDate(picker)).toEqual('2026-09-20')
  const [previous, next] = innerAll(picker, '.month-bar imp-button')
    .map((node) => node.shadowRoot.querySelector('button'))
  expect(previous.disabled).toEqual(true)
  expect(next.disabled).toEqual(true)
})

test('range mode takes two picks, orders them and tints the span', () => {
  const { state, picker } = withState(
    'test.stay',
    undefined,
    (value) => datePicker({ value, label: 'Stay', range: true }),
  )
  invoke(triggerOf(picker))
  dayOf(picker, '2026-09-25').click()
  expect(state.get()).toEqual(undefined)
  expect(isOpen(picker)).toEqual(true)
  expect(dayOf(picker, '2026-09-25').classList.contains('edge')).toEqual(true)
  dayOf(picker, '2026-09-22').dispatchEvent(new PointerEvent('pointerenter'))
  expect(dayOf(picker, '2026-09-23').classList.contains('spanned')).toEqual(true)
  expect(dayOf(picker, '2026-09-26').classList.contains('spanned')).toEqual(false)
  dayOf(picker, '2026-09-21').click()
  expect(state.get()).toEqual({ start: '2026-09-21', end: '2026-09-25' })
  expect(isOpen(picker)).toEqual(false)
  expect(inner(picker, '#value').textContent).toContain('21')
  expect(inner(picker, '#value').textContent).toContain('25 Sept 2026')
  invoke(triggerOf(picker))
  expect(dayOf(picker, '2026-09-23').getAttribute('aria-selected')).toEqual('true')
  expect(dayOf(picker, '2026-09-26').getAttribute('aria-selected')).toEqual('false')
  dayOf(picker, '2026-09-28').click()
  expect(dayOf(picker, '2026-09-28').classList.contains('edge')).toEqual(true)
  expect(dayOf(picker, '2026-09-21').classList.contains('edge')).toEqual(false)
  expect(dayOf(picker, '2026-09-25').classList.contains('edge')).toEqual(false)
  expect(dayOf(picker, '2026-09-23').classList.contains('spanned')).toEqual(false)
  expect(dayOf(picker, '2026-09-23').getAttribute('aria-selected')).toEqual('false')
}, NOW)

test('a plain range value is kept without a warning', () => {
  const warn = warnings()
  const host = mounted(datePicker({
    value: { start: '2026-09-21', end: '2026-09-25' },
    label: 'Stay',
    range: true,
  }))
  expect(inner(host, '#value').textContent).toContain('25 Sept 2026')
  expect(warn.calls.length).toEqual(0)
})

test('time mode keeps the panel open and writes a local date-time', () => {
  const { state, picker } = withState(
    'test.when',
    '2026-09-21T14:30',
    (value) => datePicker({ value, label: 'Starts at', time: true }),
  )
  expect(inner(picker, '#value').textContent).toContain('14:30')
  invoke(triggerOf(picker))
  const time = inner(picker, '#time')
  expect(time.type).toEqual('time')
  expect(time.value).toEqual('14:30')
  expect(inner(picker, "label[for='time']").textContent).toEqual('Time')
  dayOf(picker, '2026-09-24').click()
  expect(state.get()).toEqual('2026-09-24T14:30')
  expect(isOpen(picker)).toEqual(true)
  time.value = '09:05'
  time.dispatchEvent(new Event('change', { bubbles: true }))
  expect(state.get()).toEqual('2026-09-24T09:05')
  inner(picker, '.time-row imp-button').shadowRoot.querySelector('button').click()
  expect(isOpen(picker)).toEqual(false)
})

test('the clear button sets the value back to undefined, and required has none', () => {
  const { state, picker } = withState(
    'test.clearable',
    '2026-09-21',
    (value) => datePicker({ value, label: 'Due date' }),
  )
  const clear = inner(picker, '.clear')
  expect(clear.hidden).toEqual(false)
  const control = clear.querySelector('imp-button').shadowRoot.querySelector('button')
  expect(control.getAttribute('aria-label')).toEqual('Clear the date')
  control.click()
  expect(state.get()).toEqual(undefined)
  expect(clear.hidden).toEqual(true)
  const required = mounted(datePicker({ value: '2026-09-21', label: 'Due', required: true }))
  expect(inner(required, '.clear')).toEqual(null)
  expect(triggerOf(required).getAttribute('aria-required')).toEqual('true')
})

test('a disabled datePicker disables the trigger and follows a state', () => {
  const { state, picker } = withState(
    'test.locked',
    true,
    (locked) => datePicker({ value: '2026-09-21', label: 'Due date', disabled: locked }),
  )
  expect(triggerOf(picker).disabled).toEqual(true)
  expect(inner(picker, '.clear').hidden).toEqual(true)
  invoke(triggerOf(picker))
  expect(isOpen(picker)).toEqual(false)
  state.set(false)
  expect(triggerOf(picker).disabled).toEqual(false)
})

test('a field inside a form reads and writes the form values', () => {
  let values
  const reader = component('date-picker-form-reader', {
    setup: (self) => {
      values = useState(self, 'imp.form')
      return document.createTextNode('')
    },
  })
  const host = mounted(form(
    { initialValues: { dueDate: '2026-09-21' } },
    reader(),
    datePicker({ field: 'dueDate', label: 'Due date', required: true }),
  ))
  const picker = host.shadowRoot.querySelector('imp-date-picker')
  expect(inner(picker, '#value').textContent).toEqual('21 Sept 2026')
  invoke(triggerOf(picker))
  dayOf(picker, '2026-09-30').click()
  expect(values.get()).toEqual({ dueDate: '2026-09-30' })
})

test('closing the panel with no date shows no error until a submit', () => {
  const host = mounted(form(
    { initialValues: {} },
    datePicker({ field: 'dueDate', label: 'Due date', required: true }),
  ))
  const picker = host.shadowRoot.querySelector('imp-date-picker')
  invoke(triggerOf(picker))
  press(picker.shadowRoot.activeElement, 'Escape')
  expect(triggerOf(picker).getAttribute('aria-invalid')).toEqual('false')
  host.shadowRoot.querySelector('form').dispatchEvent(new Event('submit', { cancelable: true }))
  expect(triggerOf(picker).getAttribute('aria-invalid')).toEqual('true')
  expect(inner(picker, '.error').textContent).toEqual('This field is required')
})

test('a value outside min and max fails validation with a dated message', () => {
  const host = mounted(form(
    { initialValues: { day: '2026-09-01' } },
    datePicker({ field: 'day', label: 'Day', min: '2026-09-10' }),
  ))
  const picker = host.shadowRoot.querySelector('imp-date-picker')
  host.shadowRoot.querySelector('form').dispatchEvent(new Event('submit', { cancelable: true }))
  expect(inner(picker, '.error').textContent).toEqual('Choose 10 Sept 2026 or a later date')
})

test('the shown date follows the language', () => {
  const host = mounted(datePicker({ value: '2026-09-21', label: 'Termin' }))
  document.documentElement.setAttribute('lang', 'pl')
  return new Promise((resolve) => setTimeout(resolve)).then(() => {
    expect(inner(host, '#value').textContent).toEqual('21 wrz 2026')
  })
})

test('datePicker warns about bad props and continues', () => {
  const warn = warnings()
  mounted(datePicker({ label: 'A', value: 'tomorrow' }))
  expect(warned(warn, "the value must be a date like '2026-09-21'")).toBeTruthy()
  mounted(datePicker({ label: 'B', min: 'soon' }))
  expect(warned(warn, "'min' must be a date")).toBeTruthy()
  mounted(datePicker({ label: 'C', range: true, time: true }))
  expect(warned(warn, "'range' and 'time' do not combine")).toBeTruthy()
  mounted(datePicker({ label: 'D', events: {} }))
  expect(warned(warn, "unknown prop 'events'")).toBeTruthy()
  mounted(datePicker({ label: 'E' }, 'child'))
  expect(warned(warn, 'takes no content')).toBeTruthy()
})
