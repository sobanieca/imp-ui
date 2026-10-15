import { component, mount } from 'imp'
import { initState } from 'imp/state'
import { progress } from 'imp/std/feedback'
import { beforeEach, expect, spy, test } from 'imp/test'

const stateHost = component('progress-state-host', { setup: (self, render) => render(self) })

const mounted = (host) => {
  mount(document.body, host)
  return host
}

const inner = (host, selector) => host.shadowRoot.querySelector(selector)

const nested = (host, selector) => inner(inner(host, 'imp-progress'), selector)

const warnings = () => spy(console, 'warn', () => {})

const warned = (warn, text) => warn.calls.some(([first]) => String(first).includes(text))

beforeEach(() => {
  document.body.replaceChildren()
})

test('progress renders a native progress element named by its label', () => {
  const host = mounted(progress({ label: 'Uploading', value: 40 }))
  expect(host.localName).toEqual('imp-progress')
  const control = inner(host, 'progress')
  expect(control.getAttribute('aria-label')).toEqual('Uploading')
  expect(control.getAttribute('value')).toEqual('40')
  expect(control.getAttribute('max')).toEqual('100')
  expect(control.getAttribute('aria-valuetext')).toEqual('40%')
  expect(inner(host, '.label').textContent).toEqual('Uploading')
  expect(inner(host, '.label').getAttribute('aria-hidden')).toEqual('true')
})

test('a bar with no value warns and draws an empty bar, never an indeterminate one', () => {
  const warn = warnings()
  const control = inner(mounted(progress({ label: 'Loading' })), 'progress')
  expect(warned(warn, "pass a 'value'")).toBeTruthy()
  expect(control.getAttribute('value')).toEqual('0')
  expect(control.getAttribute('aria-valuetext')).toEqual('0%')
})

test('showValue puts the formatted value beside the label of a bar', () => {
  const host = mounted(progress({ label: 'Storage', value: 256, max: 512, showValue: true }))
  expect(inner(host, '.value').textContent).toEqual('50%')
  expect(inner(host, 'progress').getAttribute('max')).toEqual('512')
  expect(inner(mounted(progress({ label: 'Storage', value: 1 })), '.value')).toEqual(null)
})

test('format receives the value and the max, and names the value for a screen reader', () => {
  const host = mounted(
    progress({
      label: 'Storage',
      value: 128,
      max: 512,
      showValue: true,
      format: (value, max) => `${value} of ${max} GB`,
    }),
  )
  expect(inner(host, '.value').textContent).toEqual('128 of 512 GB')
  expect(inner(host, 'progress').getAttribute('aria-valuetext')).toEqual('128 of 512 GB')
})

test('a live value and a live label update the bar in place', () => {
  let value
  let label
  const host = mounted(
    stateHost((self) => {
      value = initState(self, 'progress.value', 10)
      label = initState(self, 'progress.label', 'Step 1')
      return progress({ label, value, showValue: true })
    }),
  )
  const control = nested(host, 'progress')
  expect(control.getAttribute('value')).toEqual('10')
  value.set(75)
  label.set('Step 2')
  expect(nested(host, 'progress') === control).toEqual(true)
  expect(control.getAttribute('value')).toEqual('75')
  expect(control.getAttribute('aria-valuetext')).toEqual('75%')
  expect(control.getAttribute('aria-label')).toEqual('Step 2')
  expect(nested(host, '.value').textContent).toEqual('75%')
  value.set(undefined)
  expect(control.getAttribute('value')).toEqual('0')
  expect(nested(host, '.value').textContent).toEqual('0%')
})

test('a value outside the range is clamped', () => {
  expect(
    inner(mounted(progress({ label: 'Over', value: 140 })), 'progress').getAttribute('value'),
  ).toEqual('100')
  expect(
    inner(mounted(progress({ label: 'Under', value: -5 })), 'progress').getAttribute('value'),
  ).toEqual('0')
})

test('a ring is a progressbar whose ARIA values and ratio follow the value', () => {
  let value
  const host = mounted(
    stateHost((self) => {
      value = initState(self, 'progress.ring', 128)
      return progress({ label: 'Storage', shape: 'ring', value, max: 512, showValue: true })
    }),
  )
  const dial = nested(host, '.dial')
  expect(dial.getAttribute('role')).toEqual('progressbar')
  expect(dial.getAttribute('aria-label')).toEqual('Storage')
  expect(dial.getAttribute('aria-valuemin')).toEqual('0')
  expect(dial.getAttribute('aria-valuemax')).toEqual('512')
  expect(dial.getAttribute('aria-valuenow')).toEqual('128')
  expect(dial.getAttribute('aria-valuetext')).toEqual('25%')
  expect(dial.style.getPropertyValue('--progress-ratio')).toEqual('0.25')
  expect(nested(host, '.value').textContent).toEqual('25%')
  expect(nested(host, '.spinner')).toEqual(null)
  value.set(512)
  expect(dial.getAttribute('aria-valuenow')).toEqual('512')
  expect(dial.style.getPropertyValue('--progress-ratio')).toEqual('1')
})

test('a gauge is a meter that always shows its value and its label', () => {
  const host = mounted(
    progress({
      label: 'CPU',
      shape: 'gauge',
      value: 72,
      color: 'amber',
      format: (value) => `${value} %`,
    }),
  )
  const dial = inner(host, '.dial')
  expect(dial.getAttribute('role')).toEqual('meter')
  expect(dial.getAttribute('aria-label')).toEqual('CPU')
  expect(dial.getAttribute('aria-valuenow')).toEqual('72')
  expect(dial.getAttribute('aria-valuetext')).toEqual('72 %')
  expect(inner(host, '.value').textContent).toEqual('72 %')
  expect(inner(host, '.caption').textContent).toEqual('CPU')
  expect(inner(host, '.root').getAttribute('class')).toContain('color-amber')
  expect(inner(host, 'svg').getAttribute('aria-hidden')).toEqual('true')
  expect(inner(host, '.spinner')).toEqual(null)
})

test('progress warns about a bad prop and continues with the default', () => {
  const warn = warnings()
  const host = mounted(progress({ label: 'Odd', shape: 'pie', color: '#ff0000', tone: 'x' }))
  expect(inner(host, '.root').getAttribute('class')).toContain('shape-bar')
  expect(inner(host, '.root').getAttribute('class')).toContain('color-primary')
  expect(warned(warn, "'shape' must be one of")).toBeTruthy()
  expect(warned(warn, "'color' must be one of")).toBeTruthy()
  expect(warned(warn, "unknown prop 'tone'")).toBeTruthy()
})

test('progress warns about a missing label, a bad max and a small ring with a value', () => {
  const warn = warnings()
  mounted(progress({ value: 10, max: 0 }))
  mounted(progress({ label: 'Tiny', shape: 'ring', size: 'sm', value: 10, showValue: true }))
  expect(warned(warn, "pass a 'label'")).toBeTruthy()
  expect(warned(warn, "'max' must be a number above 0")).toBeTruthy()
  expect(warned(warn, "a 'sm' ring has no room")).toBeTruthy()
})
