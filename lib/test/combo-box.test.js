import { component, mount } from 'imp'
import { comboBox, form, submitForm } from 'imp/std/inputs'
import { button } from 'imp/std'
import { beforeEach, expect, spy, test } from 'imp/test'
import { initState, useState } from 'imp/state'

const mounted = (host) => {
  mount(document.body, host)
  return host
}

const inner = (host, selector) => host.shadowRoot.querySelector(selector)

const click = (node) => node.dispatchEvent(new MouseEvent('click', { bubbles: true }))

const press = (node, key) => {
  const event = new KeyboardEvent('keydown', {
    key,
    bubbles: true,
    composed: true,
    cancelable: true,
  })
  node.dispatchEvent(event)
  return event
}

const type = (input, text) => {
  input.value = text
  input.dispatchEvent(new Event('input', { bubbles: true }))
}

const leave = (input) =>
  input.dispatchEvent(new FocusEvent('focusout', { bubbles: true, relatedTarget: null }))

const warnings = () => spy(console, 'warn', () => {})

const warned = (warn, text) => warn.calls.some(([first]) => String(first).includes(text))

const COUNTRIES = [
  { value: 'pl', label: 'Poland' },
  { value: 'pt', label: 'Portugal' },
  { value: 'de', label: 'Germany', disabled: true },
  { value: 'gb', label: 'United Kingdom' },
]

const inputOf = (control) => inner(control, '#control')

const optionsOf = (control) => [...control.shadowRoot.querySelectorAll('[role="option"]')]

const labelsOf = (control) => optionsOf(control).map((row) => row.textContent)

const chipsOf = (control) =>
  [...control.shadowRoot.querySelectorAll('.chip-label')].map((node) => node.textContent)

const isOpen = (control) => inputOf(control).getAttribute('aria-expanded') === 'true'

const activeOf = (control) => {
  const id = inputOf(control).getAttribute('aria-activedescendant')
  return id === null ? null : control.shadowRoot.getElementById(id).textContent
}

const inForm = (initialValues, props, ...more) => {
  let values
  const reader = component(`combo-reader-${Math.random().toString(36).slice(2)}`, {
    setup: (self) => {
      values = useState(self, 'imp.form')
      return document.createTextNode('')
    },
  })
  const { form: formProps = { initialValues }, ...comboProps } = props
  const host = mounted(form(formProps, comboBox(comboProps), ...more, reader()))
  return { host, values, control: inner(host, 'imp-combo-box') }
}

beforeEach(() => {
  document.body.replaceChildren()
})

test('comboBox wires the combobox pattern inside one shadow root', () => {
  const { control } = inForm(
    { country: 'pl' },
    { field: 'country', label: 'Country', options: COUNTRIES },
  )
  const input = inputOf(control)
  expect(input.getAttribute('role')).toEqual('combobox')
  expect(input.getAttribute('aria-autocomplete')).toEqual('list')
  expect(input.getAttribute('aria-expanded')).toEqual('false')
  const listbox = control.shadowRoot.getElementById(input.getAttribute('aria-controls'))
  expect(listbox.getAttribute('role')).toEqual('listbox')
  expect(inner(control, '.panel').getAttribute('popover')).toEqual('manual')
  expect(inner(control, 'label').getAttribute('for')).toEqual('control')
  expect(inner(control, 'label').textContent).toContain('Country')
  expect(input.value).toEqual('Poland')
})

test('typing opens the list and filters it without regard to case', () => {
  const { control } = inForm({ country: undefined }, { field: 'country', options: COUNTRIES })
  type(inputOf(control), 'PO')
  expect(isOpen(control)).toEqual(true)
  expect(labelsOf(control)).toEqual(['Poland', 'Portugal'])
  expect(activeOf(control)).toEqual('Poland')
  type(inputOf(control), 'zz')
  expect(labelsOf(control)).toEqual([])
  expect(inner(control, '[role="status"]').textContent).toEqual('No matches')
})

test('arrow keys open the list and move the active option past a disabled one', () => {
  const { control } = inForm({ country: undefined }, { field: 'country', options: COUNTRIES })
  const input = inputOf(control)
  const event = press(input, 'ArrowDown')
  expect(event.defaultPrevented).toEqual(true)
  expect(isOpen(control)).toEqual(true)
  expect(activeOf(control)).toEqual('Poland')
  press(input, 'ArrowDown')
  press(input, 'ArrowDown')
  expect(activeOf(control)).toEqual('United Kingdom')
  press(input, 'ArrowDown')
  expect(activeOf(control)).toEqual('Poland')
  press(input, 'ArrowUp')
  expect(activeOf(control)).toEqual('United Kingdom')
  press(input, 'Home')
  expect(activeOf(control)).toEqual('Poland')
  press(input, 'End')
  expect(activeOf(control)).toEqual('United Kingdom')
  expect(optionsOf(control)[2].getAttribute('aria-disabled')).toEqual('true')
})

test('Enter commits the active option, closes the list and does not submit the form', () => {
  const submitted = []
  const { control, values } = inForm(
    {},
    {
      field: 'country',
      options: COUNTRIES,
      form: { initialValues: { country: undefined }, onSubmit: (sent) => submitted.push(sent) },
    },
  )
  const input = inputOf(control)
  type(input, 'port')
  press(input, 'Enter')
  expect(values.get()).toEqual({ country: 'pt' })
  expect(input.value).toEqual('Portugal')
  expect(isOpen(control)).toEqual(false)
  expect(submitted.length).toEqual(0)
  press(input, 'Enter')
  expect(submitted).toEqual([{ country: 'pt' }])
})

test('a click on an option commits it', () => {
  const { control, values } = inForm({ country: 'pl' }, { field: 'country', options: COUNTRIES })
  click(inner(control, '.frame'))
  expect(isOpen(control)).toEqual(true)
  expect(labelsOf(control).length).toEqual(4)
  expect(optionsOf(control)[0].getAttribute('aria-selected')).toEqual('true')
  click(optionsOf(control)[3])
  expect(values.get()).toEqual({ country: 'gb' })
  expect(isOpen(control)).toEqual(false)
  click(inner(control, '.frame'))
  click(optionsOf(control)[2])
  expect(values.get()).toEqual({ country: 'gb' })
})

test('Escape closes the list, and a second Escape clears the text and the value', () => {
  const { control, values } = inForm({ country: 'pl' }, { field: 'country', options: COUNTRIES })
  const input = inputOf(control)
  press(input, 'ArrowDown')
  const first = press(input, 'Escape')
  expect(first.defaultPrevented).toEqual(true)
  expect(isOpen(control)).toEqual(false)
  expect(input.value).toEqual('Poland')
  press(input, 'Escape')
  expect(input.value).toEqual('')
  expect(values.get()).toEqual({ country: undefined })
  expect(press(input, 'Escape').defaultPrevented).toEqual(false)
})

test('leaving with text that matches no option restores the current value', () => {
  const { control, values } = inForm({ country: 'pl' }, { field: 'country', options: COUNTRIES })
  const input = inputOf(control)
  type(input, 'Atlantis')
  press(input, 'ArrowUp')
  leave(input)
  expect(isOpen(control)).toEqual(false)
  expect(input.value).toEqual('Poland')
  expect(values.get()).toEqual({ country: 'pl' })
  type(input, 'portugal')
  leave(input)
  expect(values.get()).toEqual({ country: 'pt' })
  expect(input.value).toEqual('Portugal')
  type(input, '')
  leave(input)
  expect(values.get()).toEqual({ country: undefined })
})

test('custom keeps free text as the value', () => {
  const { control, values } = inForm(
    { city: undefined },
    { field: 'city', options: ['Warsaw', 'Lisbon'], custom: true },
  )
  const input = inputOf(control)
  type(input, 'Gdynia')
  expect(isOpen(control)).toEqual(false)
  press(input, 'Enter')
  expect(values.get()).toEqual({ city: 'Gdynia' })
  expect(input.value).toEqual('Gdynia')
  type(input, 'lisbon')
  leave(input)
  expect(values.get()).toEqual({ city: 'Lisbon' })
})

test('multiple renders removable chips and keeps an array of values', () => {
  const { control, values } = inForm(
    { skills: ['pl'] },
    { field: 'skills', label: 'Skills', options: COUNTRIES, multiple: true },
  )
  const input = inputOf(control)
  expect(chipsOf(control)).toEqual(['Poland'])
  expect(input.value).toEqual('')
  expect(inner(control, '#listbox').getAttribute('aria-multiselectable')).toEqual('true')
  type(input, 'uni')
  press(input, 'Enter')
  expect(values.get()).toEqual({ skills: ['pl', 'gb'] })
  expect(chipsOf(control)).toEqual(['Poland', 'United Kingdom'])
  expect(input.value).toEqual('')
  expect(isOpen(control)).toEqual(true)
  expect(optionsOf(control).map((row) => row.getAttribute('aria-selected'))).toEqual([
    'true',
    'false',
    'false',
    'true',
  ])
  const remove = inner(control, '.chip .remove')
  expect(remove.localName).toEqual('button')
  expect(remove.getAttribute('aria-label')).toEqual('Remove Poland')
  click(remove)
  expect(values.get()).toEqual({ skills: ['gb'] })
  expect(control.shadowRoot.activeElement).toEqual(input)
})

test('Backspace in an empty input removes the last chip', () => {
  const { control, values } = inForm(
    { skills: ['pl', 'pt'] },
    { field: 'skills', options: COUNTRIES, multiple: true },
  )
  press(inputOf(control), 'Backspace')
  expect(values.get()).toEqual({ skills: ['pl'] })
  type(inputOf(control), 'x')
  press(inputOf(control), 'Backspace')
  expect(values.get()).toEqual({ skills: ['pl'] })
})

test('multiple with custom is a tag input that splits on Enter and on a comma', () => {
  const { control, values } = inForm(
    { labels: [] },
    { field: 'labels', label: 'Labels', multiple: true, custom: true },
  )
  const input = inputOf(control)
  type(input, 'bug')
  press(input, 'Enter')
  expect(values.get()).toEqual({ labels: ['bug'] })
  type(input, 'ui, urgent, bug, dra')
  expect(values.get()).toEqual({ labels: ['bug', 'ui', 'urgent'] })
  expect(input.value).toEqual('dra')
  leave(input)
  expect(values.get()).toEqual({ labels: ['bug', 'ui', 'urgent', 'dra'] })
  expect(chipsOf(control)).toEqual(['bug', 'ui', 'urgent', 'dra'])
})

test(
  'onSearch is debounced, marks the list busy and ignores a stale answer',
  async ({ clock }) => {
    const asked = []
    const answers = {}
    const onSearch = (text) => {
      asked.push(text)
      return new Promise((resolve) => {
        answers[text] = resolve
      })
    }
    const { control, values } = inForm({ assignee: undefined }, { field: 'assignee', onSearch })
    const input = inputOf(control)
    type(input, 'a')
    await clock.tick(100)
    type(input, 'ad')
    expect(asked).toEqual([])
    expect(inner(control, '#listbox').getAttribute('aria-busy')).toEqual('true')
    expect(inner(control, '[role="status"]').textContent).toEqual('Searching')
    await clock.tick(250)
    expect(asked).toEqual(['ad'])
    type(input, 'ada')
    await clock.tick(250)
    expect(asked).toEqual(['ad', 'ada'])
    answers.ad([{ value: 'u0', label: 'Adam' }])
    await clock.tick(0)
    expect(labelsOf(control)).toEqual([])
    answers.ada([{ value: 'u1', label: 'Ada Lovelace' }])
    await clock.tick(0)
    expect(labelsOf(control)).toEqual(['Ada Lovelace'])
    expect(inner(control, '#listbox').getAttribute('aria-busy')).toEqual('false')
    press(input, 'Enter')
    expect(values.get()).toEqual({ assignee: 'u1' })
    expect(input.value).toEqual('Ada Lovelace')
  },
  { fakeTimers: true },
)

test(
  'a newer text aborts the signal of the older search, and unmount aborts the last',
  async ({ clock }) => {
    const signals = []
    const onSearch = (_text, { signal }) => {
      signals.push(signal)
      return new Promise(() => {})
    }
    const { host, control } = inForm({ assignee: undefined }, { field: 'assignee', onSearch })
    const input = inputOf(control)
    type(input, 'ad')
    await clock.tick(250)
    type(input, 'ada')
    expect(signals[0].aborted).toEqual(true)
    await clock.tick(250)
    expect(signals.length).toEqual(2)
    expect(signals[1].aborted).toEqual(false)
    host.remove()
    await clock.tick(0)
    expect(signals[1].aborted).toEqual(true)
  },
  { fakeTimers: true },
)

test(
  'minSearch holds onSearch until enough is typed, and shows the known options meanwhile',
  async ({ clock }) => {
    const asked = []
    const onSearch = (text) => {
      asked.push(text)
      return Promise.resolve([{ value: 'u1', label: 'Ada Lovelace' }])
    }
    const { control } = inForm(
      { assignee: undefined },
      {
        field: 'assignee',
        options: [{ value: 'u3', label: 'Grace Hopper' }],
        minSearch: 2,
        onSearch,
      },
    )
    const input = inputOf(control)
    type(input, 'a')
    await clock.tick(250)
    expect(asked).toEqual([])
    expect(labelsOf(control)).toEqual(['Grace Hopper'])
    expect(inner(control, '[role="status"]').textContent).toEqual('')
    type(input, 'ad')
    await clock.tick(250)
    expect(asked).toEqual(['ad'])
    await clock.tick(0)
    expect(labelsOf(control)).toEqual(['Ada Lovelace'])
    type(input, 'a')
    await clock.tick(250)
    expect(asked).toEqual(['ad'])
    expect(labelsOf(control)).toEqual(['Grace Hopper'])
  },
  { fakeTimers: true },
)

test(
  'a rejected onSearch is logged and shows no matches',
  async ({ clock }) => {
    const errors = spy(console, 'error', () => {})
    const { control } = inForm(
      { assignee: undefined },
      { field: 'assignee', onSearch: () => Promise.reject(new Error('offline')) },
    )
    type(inputOf(control), 'a')
    await clock.tick(250)
    expect(errors.calls.some(([first]) => String(first).includes("'onSearch' failed"))).toBeTruthy()
    expect(inner(control, '[role="status"]').textContent).toEqual('No matches')
  },
  { fakeTimers: true },
)

test('a bound state works without a form', () => {
  let country
  const holder = component('combo-holder', {
    setup: (self) => {
      country = initState(self, 'demo.country', 'pl')
      return comboBox({ value: country, ariaLabel: 'Country', options: COUNTRIES })
    },
  })
  const control = inner(mounted(holder()), 'imp-combo-box')
  const input = inputOf(control)
  expect(input.getAttribute('aria-label')).toEqual('Country')
  expect(input.value).toEqual('Poland')
  country.set('gb')
  expect(input.value).toEqual('United Kingdom')
  type(input, 'portu')
  press(input, 'Enter')
  expect(country.get()).toEqual('pt')
})

test('required reports an empty choice on submit', () => {
  const { host, control } = inForm(
    { skills: [] },
    { field: 'skills', label: 'Skills', options: COUNTRIES, multiple: true, required: true },
    button({ variant: 'primary', events: { click: submitForm } }, 'Save'),
  )
  click(inner(inner(host, 'imp-button'), 'button'))
  expect(inner(control, '.error').textContent).toEqual('This field is required')
  expect(inputOf(control).getAttribute('aria-invalid')).toEqual('true')
  expect(inputOf(control).getAttribute('aria-required')).toEqual('true')
})

test('disabled is live and blocks the list and the chips', () => {
  let blocked
  const holder = component('combo-disabled-holder', {
    setup: (self) => {
      blocked = initState(self, 'demo.blocked', true)
      return comboBox({ value: ['pl'], multiple: true, options: COUNTRIES, disabled: blocked })
    },
  })
  const control = inner(mounted(holder()), 'imp-combo-box')
  expect(inputOf(control).disabled).toEqual(true)
  expect(inner(control, '.remove').disabled).toEqual(true)
  click(inner(control, '.frame'))
  expect(isOpen(control)).toEqual(false)
  blocked.set(false)
  expect(inner(control, '.remove').disabled).toEqual(false)
})

test('bad props are logged', () => {
  const warn = warnings()
  mounted(comboBox({ value: 'a', options: 'a,b', onSearch: 'people', fuzzy: true, minSearch: 2 }))
  expect(warned(warn, "'options' must be an array")).toBeTruthy()
  expect(warned(warn, "'onSearch' must be a function")).toBeTruthy()
  expect(warned(warn, "unknown prop 'fuzzy'")).toBeTruthy()
  mounted(comboBox({ value: 'a' }))
  expect(warned(warn, 'has nothing to choose from')).toBeTruthy()
})
