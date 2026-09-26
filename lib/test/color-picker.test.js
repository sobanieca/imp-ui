import { component, mount } from 'imp'
import { colorPicker, form, submitForm } from 'imp/std/inputs'
import { button } from 'imp/std'
import { beforeEach, expect, spy, test } from 'imp/test'
import { initState, useState } from 'imp/state'

const mounted = (host) => {
  mount(document.body, host)
  return host
}

const inner = (host, selector) => host.shadowRoot.querySelector(selector)

const click = (node) => node.dispatchEvent(new MouseEvent('click', { bubbles: true }))

const type = (input, value) => {
  input.value = value
  input.dispatchEvent(new Event('input', { bubbles: true }))
}

const blur = (input) => input.dispatchEvent(new FocusEvent('blur'))

const inForm = (initialValues, ...controls) => {
  let values
  const reader = component(`color-reader-${Math.random().toString(36).slice(2)}`, {
    setup: (self) => {
      values = useState(self, 'imp.form')
      return document.createTextNode('')
    },
  })
  const host = mounted(form({ initialValues }, ...controls, reader()))
  return { host, values, control: inner(host, 'imp-color-picker') }
}

beforeEach(() => {
  document.body.replaceChildren()
})

test('colorPicker renders a labelled text input and a named colour swatch', () => {
  const { control } = inForm(
    { brand: '#3b6fe0' },
    colorPicker({ field: 'brand', label: 'Brand colour', help: 'The accent' }),
  )
  const input = inner(control, '#control')
  expect(input.localName).toEqual('input')
  expect(input.type).toEqual('text')
  expect(input.value).toEqual('#3b6fe0')
  expect(input.getAttribute('aria-describedby')).toEqual('help')
  const label = inner(control, 'label')
  expect(label.getAttribute('for')).toEqual('control')
  expect(label.textContent).toContain('Brand colour')
  const swatch = inner(control, '.swatch')
  expect(swatch.type).toEqual('color')
  expect(swatch.value).toEqual('#3b6fe0')
  expect(swatch.getAttribute('aria-label')).toEqual('Pick Brand colour')
  expect([...inner(control, '.row').children]).toEqual([input, swatch])
})

test('ariaLabel names the input and the swatch', () => {
  const control = mounted(colorPicker({ value: '#fff', ariaLabel: 'Ink' }))
  expect(inner(control, '#control').getAttribute('aria-label')).toEqual('Ink')
  expect(inner(control, '.swatch').getAttribute('aria-label')).toEqual('Pick Ink')
})

test('typing commits the text, and a short hex expands on the swatch', () => {
  const { control, values } = inForm({ brand: undefined }, colorPicker({ field: 'brand' }))
  type(inner(control, '#control'), '#ABC')
  expect(values.get()).toEqual({ brand: '#ABC' })
  expect(inner(control, '.swatch').value).toEqual('#aabbcc')
  type(inner(control, '#control'), '')
  expect(values.get()).toEqual({ brand: undefined })
})

test('the swatch commits a lower case hex and the text follows', () => {
  const { control, values } = inForm({ brand: '#000000' }, colorPicker({ field: 'brand' }))
  const swatch = inner(control, '.swatch')
  swatch.value = '#8821ac'
  swatch.dispatchEvent(new Event('input', { bubbles: true }))
  expect(values.get()).toEqual({ brand: '#8821ac' })
  expect(inner(control, '#control').value).toEqual('#8821ac')
})

test('a text that is not a colour fails on blur and leaves the swatch as it was', () => {
  const { control } = inForm({ brand: '#3b6fe0' }, colorPicker({ field: 'brand', label: 'Brand' }))
  const input = inner(control, '#control')
  type(input, 'teal')
  expect(inner(control, '.swatch').value).toEqual('#3b6fe0')
  expect(inner(control, '.error').textContent).toEqual('')
  blur(input)
  expect(inner(control, '.error').textContent).toEqual('Enter a colour as #rrggbb')
  expect(input.getAttribute('aria-invalid')).toEqual('true')
  type(input, '#0f766e')
  blur(input)
  expect(inner(control, '.error').textContent).toEqual('')
})

test('a bound state drives both controls and receives the value', () => {
  let ink
  const holder = component('color-holder', {
    setup: (self) => {
      ink = initState(self, 'demo.ink', '#111111')
      return colorPicker({ value: ink, label: 'Ink' })
    },
  })
  const control = inner(mounted(holder()), 'imp-color-picker')
  type(inner(control, '#control'), '#222222')
  expect(ink.get()).toEqual('#222222')
  ink.set('#333333')
  expect(inner(control, '#control').value).toEqual('#333333')
  expect(inner(control, '.swatch').value).toEqual('#333333')
})

test('required reports a missing value on submit', () => {
  const { host, control } = inForm(
    { brand: undefined },
    colorPicker({ field: 'brand', label: 'Brand', required: true }),
    button({ variant: 'primary', events: { click: submitForm } }, 'Save'),
  )
  click(inner(inner(host, 'imp-button'), 'button'))
  expect(inner(control, '.error').textContent).toEqual('This field is required')
})

test('validate runs after the hex check', () => {
  const { control } = inForm(
    { brand: '#3b6fe0' },
    colorPicker({
      field: 'brand',
      label: 'Brand',
      validate: (value) => (value === '#000000' ? 'Not black' : null),
    }),
  )
  const input = inner(control, '#control')
  type(input, '#000000')
  blur(input)
  expect(inner(control, '.error').textContent).toEqual('Not black')
})

test('disabled is live and covers the swatch', () => {
  let blocked
  const holder = component('color-disabled-holder', {
    setup: (self) => {
      blocked = initState(self, 'demo.blocked', true)
      return colorPicker({ value: '#fff', label: 'Ink', disabled: blocked })
    },
  })
  const control = inner(mounted(holder()), 'imp-color-picker')
  expect(inner(control, '#control').disabled).toEqual(true)
  expect(inner(control, '.swatch').disabled).toEqual(true)
  blocked.set(false)
  expect(inner(control, '#control').disabled).toEqual(false)
  expect(inner(control, '.swatch').disabled).toEqual(false)
})

test('an unknown prop and content are logged', () => {
  const warn = spy(console, 'warn', () => {})
  mounted(colorPicker({ value: '#fff', alpha: true }, 'text'))
  const warned = (text) => warn.calls.some(([first]) => String(first).includes(text))
  expect(warned("unknown prop 'alpha'")).toBeTruthy()
  expect(warned('takes no content')).toBeTruthy()
})
