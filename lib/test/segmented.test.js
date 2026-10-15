import { component, mount } from 'imp'
import { form, segmented, submitForm } from 'imp/std/inputs'
import { button } from 'imp/std'
import { luBold, luItalic } from 'imp/icons'
import { beforeEach, expect, spy, test } from 'imp/test'
import { initState, useState } from 'imp/state'

const mounted = (host) => {
  mount(document.body, host)
  return host
}

const inner = (host, selector) => host.shadowRoot.querySelector(selector)

const segmentsOf = (host) => [...host.shadowRoot.querySelectorAll('.segment')]

const click = (node) => node.dispatchEvent(new MouseEvent('click', { bubbles: true }))

const press = (node, key) =>
  node.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true, composed: true }))

const warnings = () => spy(console, 'warn', () => {})

const warned = (warn, text) => warn.calls.some(([first]) => String(first).includes(text))

const VIEWS = ['List', 'Board', 'Calendar']

const inForm = (initialValues, ...controls) => {
  let values
  const reader = component(`segmented-reader-${Math.random().toString(36).slice(2)}`, {
    setup: (self) => {
      values = useState(self, 'imp.form')
      return document.createTextNode('')
    },
  })
  const host = mounted(form({ initialValues }, ...controls, reader()))
  return { host, values, control: inner(host, 'imp-segmented') }
}

const withState = (initial, props) => {
  let state
  const holder = component(`segmented-holder-${Math.random().toString(36).slice(2)}`, {
    setup: (self) => {
      state = initState(self, 'demo.segmented', initial)
      return segmented({ value: state, ...props })
    },
  })
  const host = mounted(holder())
  return { state, control: inner(host, 'imp-segmented') }
}

beforeEach(() => {
  document.body.replaceChildren()
  document.body.style.direction = ''
})

test('single mode is a named radiogroup of radio buttons', () => {
  const { control } = inForm(
    { view: 'Board' },
    segmented({ field: 'view', label: 'View', options: VIEWS }),
  )
  const group = inner(control, 'fieldset')
  expect(group.getAttribute('role')).toEqual('radiogroup')
  expect(inner(control, 'legend').textContent).toContain('View')
  const segments = segmentsOf(control)
  expect(segments.map((node) => node.localName)).toEqual(['button', 'button', 'button'])
  expect(segments.map((node) => node.getAttribute('role'))).toEqual(['radio', 'radio', 'radio'])
  expect(segments.map((node) => node.getAttribute('aria-checked'))).toEqual([
    'false',
    'true',
    'false',
  ])
  expect(segments.map((node) => node.textContent)).toEqual(VIEWS)
})

test('single mode keeps one tab stop, on the checked segment', () => {
  const { control } = inForm({ view: 'Calendar' }, segmented({ field: 'view', options: VIEWS }))
  expect(segmentsOf(control).map((node) => node.tabIndex)).toEqual([-1, -1, 0])
})

test('with no value the first enabled segment is the tab stop', () => {
  const { control } = inForm(
    { view: undefined },
    segmented({
      field: 'view',
      options: [
        { value: 'a', label: 'A', disabled: true },
        { value: 'b', label: 'B' },
      ],
    }),
  )
  expect(segmentsOf(control).map((node) => node.tabIndex)).toEqual([-1, 0])
  expect(segmentsOf(control)[0].disabled).toEqual(true)
})

test('a click writes the option value to the form field', () => {
  const { control, values } = inForm(
    { view: 'List' },
    segmented({ field: 'view', label: 'View', options: VIEWS }),
  )
  click(segmentsOf(control)[2])
  expect(values.get()).toEqual({ view: 'Calendar' })
  expect(segmentsOf(control).map((node) => node.getAttribute('aria-checked'))).toEqual([
    'false',
    'false',
    'true',
  ])
})

test('arrow keys move the focus and select, and they wrap and skip a disabled segment', () => {
  const { control, values } = inForm(
    { view: 'a' },
    segmented({
      field: 'view',
      options: [
        { value: 'a', label: 'A' },
        { value: 'b', label: 'B', disabled: true },
        { value: 'c', label: 'C' },
      ],
    }),
  )
  const segments = segmentsOf(control)
  segments[0].focus()
  press(segments[0], 'ArrowRight')
  expect(values.get()).toEqual({ view: 'c' })
  expect(control.shadowRoot.activeElement).toEqual(segments[2])
  press(segments[2], 'ArrowDown')
  expect(values.get()).toEqual({ view: 'a' })
  press(segments[0], 'ArrowLeft')
  expect(values.get()).toEqual({ view: 'c' })
  expect(segments.map((node) => node.tabIndex)).toEqual([-1, -1, 0])
})

test('the horizontal arrow keys mirror in a right-to-left document', () => {
  document.body.style.direction = 'rtl'
  const { control, values } = inForm({ view: 'List' }, segmented({ field: 'view', options: VIEWS }))
  const segments = segmentsOf(control)
  segments[0].focus()
  press(segments[0], 'ArrowLeft')
  expect(values.get()).toEqual({ view: 'Board' })
  press(segments[1], 'ArrowRight')
  expect(values.get()).toEqual({ view: 'List' })
})

test('multiple mode is a group of toggle buttons with an array value in option order', () => {
  const { control, values } = inForm(
    { formats: ['i'] },
    segmented({
      field: 'formats',
      label: 'Format',
      multiple: true,
      options: [
        { value: 'b', label: 'Bold' },
        { value: 'i', label: 'Italic' },
      ],
    }),
  )
  expect(inner(control, 'fieldset').getAttribute('role')).toEqual(null)
  const segments = segmentsOf(control)
  expect(segments.map((node) => node.getAttribute('role'))).toEqual([null, null])
  expect(segments.map((node) => node.getAttribute('aria-pressed'))).toEqual(['false', 'true'])
  expect(segments.map((node) => node.tabIndex)).toEqual([0, 0])
  click(segments[0])
  expect(values.get()).toEqual({ formats: ['b', 'i'] })
  click(segments[1])
  expect(values.get()).toEqual({ formats: ['b'] })
  expect(segments.map((node) => node.getAttribute('aria-pressed'))).toEqual(['true', 'false'])
})

test('an option with an icon shows the icon and takes its label as the name', () => {
  const { control } = withState(['b'], {
    ariaLabel: 'Format',
    multiple: true,
    options: [
      { value: 'b', label: 'Bold', icon: luBold },
      { value: 'i', label: 'Italic', icon: luItalic },
    ],
  })
  const [bold] = segmentsOf(control)
  expect(bold.getAttribute('aria-label')).toEqual('Bold')
  expect(bold.querySelector('imp-icon') === null).toEqual(false)
  expect(bold.textContent).toEqual('')
  expect(inner(control, 'fieldset').getAttribute('aria-label')).toEqual('Format')
})

test('a bound state drives the segments and receives the choice', () => {
  const { state, control } = withState('Board', { label: 'View', options: VIEWS })
  expect(segmentsOf(control)[1].getAttribute('aria-checked')).toEqual('true')
  click(segmentsOf(control)[0])
  expect(state.get()).toEqual('List')
  state.set('Calendar')
  expect(segmentsOf(control)[2].getAttribute('aria-checked')).toEqual('true')
})

test('a plain array value needs no state and logs nothing', () => {
  const warn = warnings()
  const control = mounted(segmented({ value: ['b'], multiple: true, options: ['a', 'b'] }))
  expect(segmentsOf(control).map((node) => node.getAttribute('aria-pressed'))).toEqual([
    'false',
    'true',
  ])
  expect(warn.calls.length).toEqual(0)
})

test('required reports an empty choice on submit', () => {
  const { host, control } = inForm(
    { formats: [] },
    segmented({
      field: 'formats',
      label: 'Format',
      multiple: true,
      required: true,
      options: VIEWS,
    }),
    button({ variant: 'primary', events: { click: submitForm } }, 'Save'),
  )
  click(inner(inner(host, 'imp-button'), 'button'))
  expect(inner(control, '.error').textContent).toEqual('This field is required')
  expect(inner(control, 'fieldset').getAttribute('aria-invalid')).toEqual('true')
  expect(inner(control, 'fieldset').getAttribute('aria-required')).toEqual('true')
})

test('disabled is live and blocks every segment', () => {
  let blocked
  const holder = component('segmented-disabled-holder', {
    setup: (self) => {
      blocked = initState(self, 'demo.blocked', true)
      return segmented({ value: 'List', options: VIEWS, disabled: blocked })
    },
  })
  const control = inner(mounted(holder()), 'imp-segmented')
  expect(segmentsOf(control).every((node) => node.disabled)).toEqual(true)
  blocked.set(false)
  expect(segmentsOf(control).some((node) => node.disabled)).toEqual(false)
})

test('size and block set classes, and a bad size falls back with a warning', () => {
  const warn = warnings()
  const control = mounted(segmented({ value: 'a', options: ['a'], size: 'huge', block: true }))
  expect(warned(warn, "'size' must be one of")).toBeTruthy()
  expect(segmentsOf(control)[0].classList.contains('size-md')).toEqual(true)
  expect(inner(control, '.row').classList.contains('block')).toEqual(true)
})

test('bad options and an unknown prop are logged', () => {
  const warn = warnings()
  mounted(segmented({ value: 'a', options: 'a,b', orientation: 'vertical' }))
  expect(warned(warn, "'options' must be an array")).toBeTruthy()
  expect(warned(warn, "unknown prop 'orientation'")).toBeTruthy()
})
