import { component, mount } from 'imp'
import { form, slider, submitButton } from 'imp/std/inputs'
import { beforeEach, expect, spy, test } from 'imp/test'
import { initState, useState } from 'imp/state'

const mounted = (host) => {
  mount(document.body, host)
  return host
}

const inner = (host, selector) => host.shadowRoot.querySelector(selector)

const click = (node) => node.dispatchEvent(new MouseEvent('click', { bubbles: true }))

const slide = (input, value) => {
  input.value = String(value)
  input.dispatchEvent(new Event('input', { bubbles: true }))
}

const warnings = () => spy(console, 'warn', () => {})

const warned = (warn, text) => warn.calls.some(([first]) => String(first).includes(text))

const inForm = (initialValues, ...controls) => {
  let values
  const reader = component(`slider-reader-${Math.random().toString(36).slice(2)}`, {
    setup: (self) => {
      values = useState(self, 'imp.form')
      return document.createTextNode('')
    },
  })
  const host = mounted(form({ initialValues }, ...controls, reader()))
  return { host, values, control: inner(host, 'imp-slider') }
}

beforeEach(() => {
  document.body.replaceChildren()
})

test('slider renders a labelled native range input with its range', () => {
  const { control } = inForm(
    { volume: 40 },
    slider({ field: 'volume', label: 'Volume', min: 0, max: 100, step: 5, help: 'In percent' }),
  )
  const input = inner(control, '#control')
  expect(input.localName).toEqual('input')
  expect(input.type).toEqual('range')
  expect(input.getAttribute('min')).toEqual('0')
  expect(input.getAttribute('max')).toEqual('100')
  expect(input.getAttribute('step')).toEqual('5')
  expect(input.value).toEqual('40')
  const label = inner(control, 'label')
  expect(label.getAttribute('for')).toEqual('control')
  expect(label.textContent).toContain('Volume')
  expect(input.getAttribute('aria-describedby')).toEqual('help')
})

test('the range defaults to 0, 100 and 1', () => {
  const control = mounted(slider({ value: 10, ariaLabel: 'Level' }))
  const input = inner(control, '#control')
  expect([input.getAttribute('min'), input.getAttribute('max'), input.getAttribute('step')])
    .toEqual(['0', '100', '1'])
  expect(input.getAttribute('aria-label')).toEqual('Level')
})

test('an input event commits a number to the form field', () => {
  const { control, values } = inForm({ volume: 40 }, slider({ field: 'volume', label: 'Volume' }))
  slide(inner(control, '#control'), 65)
  expect(values.get()).toEqual({ volume: 65 })
})

test('the output sits in the label row and follows the value', () => {
  const { control } = inForm({ volume: 40 }, slider({ field: 'volume', label: 'Volume' }))
  const header = inner(control, '.header')
  expect([...header.children].map((node) => node.localName)).toEqual(['label', 'output'])
  const output = inner(control, 'output')
  expect(output.textContent).toEqual('40')
  expect(output.getAttribute('for')).toEqual('control')
  slide(inner(control, '#control'), 70)
  expect(output.textContent).toEqual('70')
})

test('format shapes the output and the announced value', () => {
  const { control } = inForm(
    { volume: 40 },
    slider({ field: 'volume', label: 'Volume', format: (value) => `${value}%` }),
  )
  expect(inner(control, 'output').textContent).toEqual('40%')
  expect(inner(control, '#control').getAttribute('aria-valuetext')).toEqual('40%')
})

test('showValue false renders no output', () => {
  const control = mounted(slider({ value: 5, label: 'Level', showValue: false }))
  expect(inner(control, 'output')).toEqual(null)
  expect(inner(control, '.header')).toEqual(null)
})

test('a bound state drives the thumb and receives the value', () => {
  let level
  const holder = component('slider-holder', {
    setup: (self) => {
      level = initState(self, 'demo.level', 20)
      return slider({ value: level, label: 'Level' })
    },
  })
  const control = inner(mounted(holder()), 'imp-slider')
  const input = inner(control, '#control')
  expect(input.value).toEqual('20')
  slide(input, 35)
  expect(level.get()).toEqual(35)
  level.set(80)
  expect(input.value).toEqual('80')
  expect(inner(control, 'output').textContent).toEqual('80')
})

test('min and max set the range and are not validation rules', () => {
  const { control } = inForm(
    { volume: 150 },
    slider({ field: 'volume', label: 'Volume', min: 0, max: 100 }),
  )
  const input = inner(control, '#control')
  input.dispatchEvent(new FocusEvent('blur'))
  expect(inner(control, '.error').textContent).toEqual('')
  expect(input.getAttribute('aria-invalid')).toEqual('false')
})

test('required reports a missing value on submit', () => {
  const { host, control } = inForm(
    { volume: undefined },
    slider({ field: 'volume', label: 'Volume', required: true }),
    submitButton('Save'),
  )
  click(inner(inner(inner(host, 'imp-submit-button'), 'imp-button'), 'button'))
  expect(inner(control, '.error').textContent).toEqual('This field is required')
  expect(inner(control, '#control').getAttribute('aria-invalid')).toEqual('true')
  expect(inner(control, '#control').value).toEqual('0')
})

test('validate runs against the number', () => {
  const { control } = inForm(
    { volume: 40 },
    slider({
      field: 'volume',
      label: 'Volume',
      validate: (value) => (value > 80 ? 'Too loud' : null),
    }),
  )
  const input = inner(control, '#control')
  slide(input, 90)
  input.dispatchEvent(new FocusEvent('blur'))
  expect(inner(control, '.error').textContent).toEqual('Too loud')
})

test('disabled is live', () => {
  let blocked
  const holder = component('slider-disabled-holder', {
    setup: (self) => {
      blocked = initState(self, 'demo.blocked', true)
      return slider({ value: 5, label: 'Level', disabled: blocked })
    },
  })
  const input = inner(inner(mounted(holder()), 'imp-slider'), '#control')
  expect(input.disabled).toEqual(true)
  blocked.set(false)
  expect(input.disabled).toEqual(false)
})

test('a bad range, a bad format and an unknown prop are logged', () => {
  const warn = warnings()
  const control = mounted(slider({ value: 5, min: 10, max: 2, format: '%', orientation: 'up' }))
  expect(warned(warn, "'min' (10) must be less than 'max' (2)")).toBeTruthy()
  expect(warned(warn, "'format' must be a function")).toBeTruthy()
  expect(warned(warn, "unknown prop 'orientation'")).toBeTruthy()
  expect(inner(control, '#control').getAttribute('max')).toEqual('100')
})
