import { component, mount } from 'imp'
import { dateRangePicker, form } from 'imp/std/inputs'
import { initState, useState } from 'imp/state'
import { beforeEach, expect, spy, test } from 'imp/test'

const NOW = { fakeTimers: { now: new Date(2026, 9, 7, 10, 0) } }

const PRESETS = [
  { value: '7d', label: 'Last 7 days', range: { start: '2026-10-01', end: '2026-10-07' } },
  { value: '30d', label: 'Last 30 days', range: { start: '2026-09-08', end: '2026-10-07' } },
  { value: '1y', label: 'Last year' },
]

const mounted = (host) => {
  mount(document.body, host)
  return host
}

const inner = (host, selector) => host.shadowRoot.querySelector(selector)

const innerAll = (host, selector) => [...host.shadowRoot.querySelectorAll(selector)]

const triggerOf = (host) => inner(host, '#control')

const isOpen = (host) => triggerOf(host).getAttribute('aria-expanded') === 'true'

const tabOf = (host, mode) => inner(host, `#tab-${mode}`)

const paneOf = (host, mode) => inner(host, `#pane-${mode}`)

const radios = (host) => innerAll(host, '[role="radio"]')

const dayOf = (host, date) => inner(host, `.day[data-date='${date}']`)

const active = (host) => host.shadowRoot.activeElement

const innerButton = (host, selector) => inner(host, selector).shadowRoot.querySelector('button')

const actionButtons = (host) =>
  innerAll(host, '.actions imp-button').map((node) => node.shadowRoot.querySelector('button'))

const invoke = (node) => {
  node.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, composed: true }))
  node.dispatchEvent(new MouseEvent('click', { bubbles: true, composed: true }))
}

const press = (node, key) =>
  node.dispatchEvent(
    new KeyboardEvent('keydown', { key, bubbles: true, composed: true, cancelable: true }),
  )

const warnings = () => spy(console, 'warn', () => {})

const warned = (warn, text) => warn.calls.some(([first]) => String(first).includes(text))

const stateHost = component('date-range-picker-state-host', {
  setup: (self, render) => render(self),
})

const withState = (initial, props = {}) => {
  let state
  const host = mounted(stateHost((self) => {
    state = initState(self, 'test.period', initial)
    return dateRangePicker({ value: state, label: 'Period', presets: PRESETS, ...props })
  }))
  return { state, picker: host.shadowRoot.querySelector('imp-date-range-picker') }
}

beforeEach(() => {
  document.body.replaceChildren()
  document.documentElement.setAttribute('lang', 'en-US')
})

test('dateRangePicker renders a labelled trigger with the preset, its dates and the mode', () => {
  const host = mounted(
    dateRangePicker({ label: 'Period', presets: PRESETS, value: { preset: '30d' } }),
  )
  expect(host.localName).toEqual('imp-date-range-picker')
  const trigger = triggerOf(host)
  expect(trigger.localName).toEqual('button')
  expect(trigger.getAttribute('aria-haspopup')).toEqual('dialog')
  expect(trigger.getAttribute('aria-expanded')).toEqual('false')
  expect(inner(host, 'label').getAttribute('for')).toEqual('control')
  expect(inner(host, 'label').textContent).toContain('Period')
  expect(trigger.getAttribute('aria-describedby')).toContain('value')
  expect(inner(host, '.main').textContent).toEqual('Last 30 days')
  expect(inner(host, '.detail').textContent).toContain('Sep 8')
  expect(inner(host, '.detail').textContent).toContain('Oct 7, 2026')
  expect(inner(host, '.badge').textContent).toEqual('Relative')
  expect(inner(host, '#panel').getAttribute('role')).toEqual('dialog')
  expect(inner(host, '#panel').getAttribute('aria-label')).toEqual('Choose a date range')
})

test('a custom value shows the formatted range and the custom badge', () => {
  const host = mounted(dateRangePicker({
    label: 'Period',
    presets: PRESETS,
    value: { start: '2026-09-08', end: '2026-10-07' },
  }))
  expect(inner(host, '.main').textContent).toContain('Sep 8')
  expect(inner(host, '.main').textContent).toContain('Oct 7, 2026')
  expect(inner(host, '.detail').hidden).toEqual(true)
  expect(inner(host, '.badge').textContent).toEqual('Custom')
})

test('an empty dateRangePicker asks for a date range', () => {
  const host = mounted(dateRangePicker({ label: 'Period', presets: PRESETS }))
  expect(inner(host, '.main').textContent).toEqual('Choose a date range')
  expect(inner(host, '.main').classList.contains('placeholder')).toEqual(true)
  expect(inner(host, '.badge').hidden).toEqual(true)
})

test('the panel has two tabs, and the tab of the value is active on open', () => {
  const { picker } = withState({ preset: '7d' })
  invoke(triggerOf(picker))
  expect(isOpen(picker)).toEqual(true)
  expect(inner(picker, '[role="tablist"]')).not.toEqual(null)
  const relative = tabOf(picker, 'relative')
  const custom = tabOf(picker, 'custom')
  expect(relative.getAttribute('role')).toEqual('tab')
  expect(relative.textContent).toEqual('Relative')
  expect(custom.textContent).toEqual('Custom')
  expect(relative.getAttribute('aria-selected')).toEqual('true')
  expect(relative.getAttribute('aria-controls')).toEqual('pane-relative')
  expect(paneOf(picker, 'relative').getAttribute('role')).toEqual('tabpanel')
  expect(paneOf(picker, 'relative').getAttribute('aria-labelledby')).toEqual('tab-relative')
  expect(paneOf(picker, 'relative').hidden).toEqual(false)
  expect(paneOf(picker, 'custom').hidden).toEqual(true)
  expect(inner(picker, '[role="radiogroup"]').getAttribute('aria-labelledby')).toEqual(
    'tab-relative',
  )
  expect(radios(picker).map((node) => node.getAttribute('aria-checked'))).toEqual([
    'true',
    'false',
    'false',
  ])
  expect(active(picker)).toEqual(radios(picker)[0])
})

test('the preset rows show the label and the resolved range', () => {
  const { picker } = withState(undefined)
  invoke(triggerOf(picker))
  const [week, month, year] = radios(picker)
  expect(week.querySelector('.preset-label').textContent).toEqual('Last 7 days')
  expect(week.querySelector('.preset-range').textContent).toContain('Oct 1')
  expect(month.querySelector('.preset-range').textContent).toContain('Sep 8')
  expect(year.querySelector('.preset-range')).toEqual(null)
  expect(radios(picker)[0].tabIndex).toEqual(0)
  expect(active(picker)).toEqual(week)
})

test('a click on a preset writes it and closes the panel', () => {
  const { state, picker } = withState(undefined)
  invoke(triggerOf(picker))
  radios(picker)[1].click()
  expect(state.get()).toEqual({ preset: '30d' })
  expect(isOpen(picker)).toEqual(false)
  expect(active(picker)).toEqual(triggerOf(picker))
  expect(inner(picker, '.main').textContent).toEqual('Last 30 days')
})

test('the arrow keys move the check in the presets, and Space chooses', () => {
  const { state, picker } = withState({ preset: '7d' })
  invoke(triggerOf(picker))
  press(active(picker), 'ArrowDown')
  expect(active(picker)).toEqual(radios(picker)[1])
  expect(radios(picker)[1].getAttribute('aria-checked')).toEqual('true')
  expect(radios(picker)[0].getAttribute('aria-checked')).toEqual('false')
  expect(state.get()).toEqual({ preset: '7d' })
  press(active(picker), 'End')
  expect(active(picker)).toEqual(radios(picker)[2])
  press(active(picker), 'ArrowDown')
  expect(active(picker)).toEqual(radios(picker)[0])
  press(active(picker), 'ArrowUp')
  active(picker).click()
  expect(state.get()).toEqual({ preset: '1y' })
})

test('the arrow keys switch the tabs, also in a right-to-left context', () => {
  const { picker } = withState({ preset: '7d' })
  invoke(triggerOf(picker))
  tabOf(picker, 'relative').focus()
  press(tabOf(picker, 'relative'), 'ArrowRight')
  expect(active(picker)).toEqual(tabOf(picker, 'custom'))
  expect(tabOf(picker, 'custom').getAttribute('aria-selected')).toEqual('true')
  expect(tabOf(picker, 'custom').tabIndex).toEqual(0)
  expect(tabOf(picker, 'relative').tabIndex).toEqual(-1)
  expect(paneOf(picker, 'custom').hidden).toEqual(false)
  expect(paneOf(picker, 'relative').hidden).toEqual(true)
  press(active(picker), 'Home')
  expect(active(picker)).toEqual(tabOf(picker, 'relative'))
  spy(globalThis, 'getComputedStyle', () => ({ direction: 'rtl' }))
  press(active(picker), 'ArrowLeft')
  expect(active(picker)).toEqual(tabOf(picker, 'custom'))
})

test('a custom range takes two picks and Apply writes it', () => {
  const { state, picker } = withState({ preset: '30d' })
  invoke(triggerOf(picker))
  tabOf(picker, 'custom').click()
  expect(dayOf(picker, '2026-10-07').classList.contains('edge')).toEqual(true)
  expect(dayOf(picker, '2026-10-01').classList.contains('spanned')).toEqual(true)
  const [cancel, apply] = actionButtons(picker)
  expect(cancel.textContent).toEqual('Cancel')
  expect(apply.textContent).toEqual('Apply')
  expect(apply.disabled).toEqual(false)
  dayOf(picker, '2026-10-05').click()
  expect(apply.disabled).toEqual(true)
  expect(inner(picker, '.readout-value').textContent).toEqual('Oct 5, 2026')
  expect(innerAll(picker, '.readout-value')[1].textContent).toEqual('Pick a day')
  dayOf(picker, '2026-10-02').click()
  expect(apply.disabled).toEqual(false)
  expect(innerAll(picker, '.readout-value')[1].textContent).toEqual('Oct 5, 2026')
  expect(state.get()).toEqual({ preset: '30d' })
  apply.click()
  expect(state.get()).toEqual({ start: '2026-10-02', end: '2026-10-05' })
  expect(isOpen(picker)).toEqual(false)
  expect(inner(picker, '.badge').textContent).toEqual('Custom')
}, NOW)

test('a custom value opens the custom tab with the range and focuses the grid', () => {
  const { picker } = withState({ start: '2026-09-10', end: '2026-09-20' })
  invoke(triggerOf(picker))
  expect(tabOf(picker, 'custom').getAttribute('aria-selected')).toEqual('true')
  expect(active(picker).dataset.date).toEqual('2026-09-20')
  expect(dayOf(picker, '2026-09-15').getAttribute('aria-selected')).toEqual('true')
  press(active(picker), 'ArrowRight')
  expect(active(picker).dataset.date).toEqual('2026-09-21')
})

test('Cancel and Escape close without a change and return the focus', () => {
  const { state, picker } = withState({ preset: '7d' })
  invoke(triggerOf(picker))
  tabOf(picker, 'custom').click()
  dayOf(picker, '2026-10-02').click()
  dayOf(picker, '2026-10-03').click()
  actionButtons(picker)[0].click()
  expect(isOpen(picker)).toEqual(false)
  expect(state.get()).toEqual({ preset: '7d' })
  invoke(triggerOf(picker))
  press(active(picker), 'Escape')
  expect(isOpen(picker)).toEqual(false)
  expect(active(picker)).toEqual(triggerOf(picker))
  expect(state.get()).toEqual({ preset: '7d' })
}, NOW)

test('days outside min and max cannot be picked', () => {
  const { picker } = withState(
    { start: '2026-09-10', end: '2026-09-20' },
    { min: '2026-09-05', max: '2026-09-25' },
  )
  invoke(triggerOf(picker))
  expect(dayOf(picker, '2026-09-04').getAttribute('aria-disabled')).toEqual('true')
  expect(dayOf(picker, '2026-09-26').getAttribute('aria-disabled')).toEqual('true')
  expect(dayOf(picker, '2026-09-05').hasAttribute('aria-disabled')).toEqual(false)
})

test('a preset outside min and max is disabled and cannot be chosen', () => {
  const { state, picker } = withState(undefined, { min: '2026-09-10', max: '2026-10-31' })
  invoke(triggerOf(picker))
  const [week, month, year] = radios(picker)
  expect(week.hasAttribute('aria-disabled')).toEqual(false)
  expect(month.getAttribute('aria-disabled')).toEqual('true')
  expect(year.hasAttribute('aria-disabled')).toEqual(false)
  month.click()
  expect(state.get()).toEqual(undefined)
  expect(isOpen(picker)).toEqual(true)
  week.click()
  expect(state.get()).toEqual({ preset: '7d' })
})

test('a value outside min and max fails validation with a dated message', () => {
  const host = mounted(form(
    { initialValues: { period: { start: '2026-09-01', end: '2026-09-20' } } },
    dateRangePicker({ field: 'period', label: 'Period', min: '2026-09-10' }),
  ))
  const picker = inner(host, 'imp-date-range-picker')
  host.shadowRoot.querySelector('form').dispatchEvent(new Event('submit', { cancelable: true }))
  expect(triggerOf(picker).getAttribute('aria-invalid')).toEqual('true')
  expect(inner(picker, '.error').textContent.startsWith('Choose a range that starts on')).toEqual(
    true,
  )
})

test('the focused preset keeps the focus when the presets render again', () => {
  let presets
  const host = mounted(stateHost((self) => {
    presets = initState(self, 'test.presets.focus', PRESETS)
    return dateRangePicker({ label: 'Period', presets, value: { preset: '7d' } })
  }))
  const picker = host.shadowRoot.querySelector('imp-date-range-picker')
  invoke(triggerOf(picker))
  press(active(picker), 'ArrowDown')
  expect(active(picker)).toEqual(radios(picker)[1])
  presets.set([{ value: 'today', label: 'Today' }, ...PRESETS])
  expect(radios(picker).length).toEqual(4)
  expect(active(picker)).toEqual(radios(picker)[2])
  expect(active(picker).textContent.startsWith('Last 30 days')).toEqual(true)
})

test('presets can be a state, and the tab labels can be replaced', () => {
  let presets
  const host = mounted(stateHost((self) => {
    presets = initState(self, 'test.presets', PRESETS.slice(0, 1))
    return dateRangePicker({
      label: 'Period',
      presets,
      value: { preset: '30d' },
      relativeLabel: 'Quick',
      customLabel: 'Exact',
    })
  }))
  const picker = host.shadowRoot.querySelector('imp-date-range-picker')
  expect(inner(picker, '.main').textContent).toEqual('30d')
  presets.set(PRESETS)
  expect(inner(picker, '.main').textContent).toEqual('Last 30 days')
  expect(inner(picker, '.badge').textContent).toEqual('Quick')
  expect(tabOf(picker, 'custom').textContent).toEqual('Exact')
  invoke(triggerOf(picker))
  expect(radios(picker).length).toEqual(3)
})

test('a field inside a form reads and writes the period', () => {
  let values
  const reader = component('date-range-picker-reader', {
    setup: (self) => {
      values = useState(self, 'imp.form')
      return document.createTextNode('')
    },
  })
  const host = mounted(form(
    { initialValues: { period: { preset: '7d' } } },
    dateRangePicker({ field: 'period', label: 'Period', presets: PRESETS, required: true }),
    reader(),
  ))
  const picker = inner(host, 'imp-date-range-picker')
  expect(inner(picker, '.main').textContent).toEqual('Last 7 days')
  invoke(triggerOf(picker))
  radios(picker)[2].click()
  expect(values.get().period).toEqual({ preset: '1y' })
  expect(triggerOf(picker).getAttribute('aria-required')).toEqual('true')
})

test('a disabled dateRangePicker disables the trigger', () => {
  const { picker } = withState({ preset: '7d' }, { disabled: true })
  expect(triggerOf(picker).disabled).toEqual(true)
})

test('the shown range follows the language', () => {
  document.documentElement.setAttribute('lang', 'en-GB')
  const host = mounted(dateRangePicker({
    label: 'Period',
    presets: PRESETS,
    value: { start: '2026-09-08', end: '2026-10-07' },
  }))
  expect(inner(host, '.main').textContent).toContain('8 Sept')
})

test('dateRangePicker warns about a bad value and bad presets, and continues', () => {
  const warn = warnings()
  const host = mounted(dateRangePicker({
    label: 'Period',
    presets: [{ label: 'No value' }, { value: 'x', label: 'X', range: { start: 'soon' } }],
    value: { start: 'yesterday' },
  }))
  expect(warned(warn, "a preset is not an object with a 'value'")).toEqual(true)
  expect(warned(warn, "the range of preset 'x'")).toEqual(true)
  expect(warned(warn, 'the value must be { preset } or { start, end }')).toEqual(true)
  expect(inner(host, '.main').textContent).toEqual('Choose a date range')
  expect(innerButton(host, '.actions imp-button:last-child').disabled).toEqual(true)
})

test('with no presets the panel shows only the custom content', () => {
  const { state, picker } = withState(
    { start: '2026-09-10', end: '2026-09-20' },
    { presets: undefined },
  )
  expect(inner(picker, '.badge').hidden).toEqual(true)
  invoke(triggerOf(picker))
  expect(inner(picker, '[role="tablist"]').hidden).toEqual(true)
  expect(paneOf(picker, 'custom').hidden).toEqual(false)
  expect(paneOf(picker, 'custom').hasAttribute('role')).toEqual(false)
  expect(paneOf(picker, 'relative').hidden).toEqual(true)
  expect(inner(picker, '.time')).toEqual(null)
  dayOf(picker, '2026-09-12').click()
  dayOf(picker, '2026-09-14').click()
  actionButtons(picker)[1].click()
  expect(state.get()).toEqual({ start: '2026-09-12', end: '2026-09-14' })
})

test('the tabs appear when a state of presets fills', () => {
  let presets
  const host = mounted(stateHost((self) => {
    presets = initState(self, 'test.presets', [])
    return dateRangePicker({ label: 'Period', presets, value: { preset: '7d' } })
  }))
  const picker = host.shadowRoot.querySelector('imp-date-range-picker')
  expect(inner(picker, '[role="tablist"]').hidden).toEqual(true)
  presets.set(PRESETS)
  expect(inner(picker, '[role="tablist"]').hidden).toEqual(false)
  expect(paneOf(picker, 'custom').getAttribute('role')).toEqual('tabpanel')
  expect(inner(picker, '.badge').hidden).toEqual(false)
})

test('the first pick previews the span under the pointer', () => {
  const { picker } = withState(undefined, { presets: [] })
  invoke(triggerOf(picker))
  dayOf(picker, '2026-10-12').click()
  dayOf(picker, '2026-10-09').dispatchEvent(new PointerEvent('pointerenter'))
  expect(dayOf(picker, '2026-10-10').classList.contains('spanned')).toEqual(true)
  expect(dayOf(picker, '2026-10-13').classList.contains('spanned')).toEqual(false)
}, NOW)

test('a preset range with times shows the times, and seconds when they are set', () => {
  const host = mounted(dateRangePicker({
    label: 'Window',
    value: { preset: '60s' },
    presets: [
      {
        value: '60s',
        label: 'Last 60 seconds',
        range: { start: '2026-10-07T09:59:00', end: '2026-10-07T10:00:00' },
      },
      {
        value: '30s',
        label: 'Last 30 seconds',
        range: { start: '2026-10-07T09:59:30', end: '2026-10-07T10:00:00' },
      },
      {
        value: '5m',
        label: 'Last 5 minutes',
        range: { start: '2026-10-07T09:55', end: '2026-10-07T10:00' },
      },
    ],
  }))
  expect(inner(host, '.detail').textContent).toContain('9:59')
  expect(inner(host, '.detail').textContent).not.toContain('9:59:00')
  invoke(triggerOf(host))
  const ranges = innerAll(host, '.preset-range').map((node) => node.textContent)
  expect(ranges[1]).toContain('9:59:30')
  expect(ranges[2]).toContain('9:55')
})

test('with time the custom tab writes moments, seeded from the preset', () => {
  const { state, picker } = withState({ preset: '5m' }, {
    time: true,
    presets: [{
      value: '5m',
      label: 'Last 5 minutes',
      range: { start: '2026-10-07T09:55', end: '2026-10-07T10:00' },
    }],
  })
  invoke(triggerOf(picker))
  tabOf(picker, 'custom').click()
  const startTime = inner(picker, '#start-time')
  const endTime = inner(picker, '#end-time')
  expect(startTime.type).toEqual('time')
  expect(startTime.getAttribute('aria-label')).toEqual('Start time')
  expect(endTime.getAttribute('aria-label')).toEqual('End time')
  expect(startTime.value).toEqual('09:55')
  expect(endTime.value).toEqual('10:00')
  const apply = actionButtons(picker)[1]
  endTime.value = '09:00'
  endTime.dispatchEvent(new Event('input'))
  expect(apply.disabled).toEqual(true)
  endTime.value = '10:30'
  endTime.dispatchEvent(new Event('input'))
  expect(apply.disabled).toEqual(false)
  apply.click()
  expect(state.get()).toEqual({ start: '2026-10-07T09:55', end: '2026-10-07T10:30' })
  expect(inner(picker, '.main').textContent).toContain('10:30')
}, NOW)

test('with time a picked day starts at midnight and ends at the last minute', () => {
  const { state, picker } = withState(undefined, { time: true, presets: [] })
  invoke(triggerOf(picker))
  dayOf(picker, '2026-10-02').click()
  dayOf(picker, '2026-10-03').click()
  actionButtons(picker)[1].click()
  expect(state.get()).toEqual({ start: '2026-10-02T00:00', end: '2026-10-03T23:59' })
}, NOW)

test('without time Apply drops the times of the seed', () => {
  const { state, picker } = withState(
    { start: '2026-10-02T08:00', end: '2026-10-03T18:00' },
    { presets: [] },
  )
  expect(inner(picker, '.main').textContent).toContain('8:00')
  invoke(triggerOf(picker))
  expect(inner(picker, '.time')).toEqual(null)
  actionButtons(picker)[1].click()
  expect(state.get()).toEqual({ start: '2026-10-02', end: '2026-10-03' })
}, NOW)

test('a placeholder replaces the empty text', () => {
  const host = mounted(dateRangePicker({ label: 'Stay', placeholder: 'Any dates' }))
  expect(inner(host, '.main').textContent).toEqual('Any dates')
})
