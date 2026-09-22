import { mount } from 'imp'
import { component } from 'imp'
import {
  checkbox,
  form,
  radioGroup,
  resetButton,
  select,
  submitButton,
  textField,
  toggle,
} from 'imp/std/inputs'
import { beforeEach, expect, spy, test } from 'imp/test'
import { initState, useState } from 'imp/state'

const mounted = (host) => {
  mount(document.body, host)
  return host
}

const shadow = (host, selector) => host.shadowRoot.querySelector(selector)

const control = (host, componentName, selector = '#control') =>
  shadow(shadow(host, componentName), selector)

const type = (input, value) => {
  input.value = value
  input.dispatchEvent(new Event('input', { bubbles: true }))
}

const change = (node) => node.dispatchEvent(new Event('change', { bubbles: true }))

const click = (node) => node.dispatchEvent(new MouseEvent('click', { bubbles: true }))

const warnings = () => spy(console, 'warn', () => {})

const warned = (warn, text) => warn.calls.some(([first]) => String(first).includes(text))

const errorText = (host, componentName) => shadow(shadow(host, componentName), '.error').textContent

beforeEach(() => {
  document.body.replaceChildren()
})

test('form owns imp.form and seeds it with initialValues', () => {
  let values
  const reader = component('form-reader', {
    setup: (self) => {
      values = useState(self, 'imp.form')
      return document.createTextNode('')
    },
  })
  mounted(form({ initialValues: { user: { firstName: 'Ada' } } }, reader()))
  expect(values.get()).toEqual({ user: { firstName: 'Ada' } })
})

test('form with no initialValues starts its state at null', () => {
  let values
  const reader = component('form-reader-empty', {
    setup: (self) => {
      values = useState(self, 'imp.form')
      return document.createTextNode('')
    },
  })
  mounted(form(reader()))
  expect(values.get()).toEqual(null)
})

test('a field reads its value out of a nested path', () => {
  const host = mounted(
    form({ initialValues: { user: { firstName: 'Ada' } } }, textField({ field: 'user.firstName' })),
  )
  expect(control(host, 'imp-text-field').value).toEqual('Ada')
})

test('typing writes back to the nested path without touching its siblings', () => {
  let values
  const reader = component('form-reader-write', {
    setup: (self) => {
      values = useState(self, 'imp.form')
      return document.createTextNode('')
    },
  })
  const host = mounted(
    form(
      { initialValues: { user: { firstName: 'Ada', lastName: 'Lovelace' } } },
      textField({ field: 'user.firstName' }),
      reader(),
    ),
  )
  type(control(host, 'imp-text-field'), 'Grace')
  expect(values.get()).toEqual({ user: { firstName: 'Grace', lastName: 'Lovelace' } })
})

test('a field reaches the form through any nesting in between', () => {
  const wrapper = component('form-field-wrapper', { setup: (_self, child) => child })
  const host = mounted(
    form(
      { initialValues: { email: 'ada@example.com' } },
      wrapper(textField({ field: 'email' })),
    ),
  )
  const field = shadow(shadow(host, 'form-field-wrapper'), 'imp-text-field')
  expect(shadow(field, '#control').value).toEqual('ada@example.com')
})

test('an external write updates the input in place', () => {
  let values
  const reader = component('form-reader-external', {
    setup: (self) => {
      values = useState(self, 'imp.form')
      return document.createTextNode('')
    },
  })
  const host = mounted(
    form({ initialValues: { name: 'Ada' } }, textField({ field: 'name' }), reader()),
  )
  const input = control(host, 'imp-text-field')
  values.set({ name: 'Grace' })
  expect(input.value).toEqual('Grace')
})

test('a field outside a form is an error naming the field', () => {
  const lonely = component('lonely-field', { setup: () => textField({ field: 'name' }) })
  const host = lonely()
  let failure = null
  host.addEventListener('ComponentError', (event) => {
    event.stopPropagation()
    failure = event.detail.error
  })
  mounted(host)
  expect(failure).toBeTruthy()
  expect(String(failure.message)).toContain('no form around it')
})

test('a field path that is not dot-separated is rejected', () => {
  let failure = null
  const host = form({ initialValues: {} }, textField({ field: 'user-first-name' }))
  host.addEventListener('ComponentError', (event) => {
    failure = event.detail.error
  })
  mounted(host)
  expect(String(failure?.message ?? '')).toContain('dot-separated field path')
})

test('a required field blocks submit and reports its message', () => {
  const submitted = []
  const host = mounted(
    form(
      { initialValues: { name: '' }, onSubmit: (values) => submitted.push(values) },
      textField({ field: 'name', label: 'Name', required: true }),
      submitButton('Save'),
    ),
  )
  click(control(host, 'imp-submit-button', 'imp-button').shadowRoot.querySelector('button'))
  expect(submitted.length).toEqual(0)
  expect(errorText(host, 'imp-text-field')).toEqual('This field is required')
})

test('a valid form submits its values', () => {
  const submitted = []
  const host = mounted(
    form(
      { initialValues: { name: 'Ada' }, onSubmit: (values) => submitted.push(values) },
      textField({ field: 'name', label: 'Name', required: true }),
      submitButton('Save'),
    ),
  )
  click(control(host, 'imp-submit-button', 'imp-button').shadowRoot.querySelector('button'))
  expect(submitted).toEqual([{ name: 'Ada' }])
})

test('an error stays hidden until the field is touched or submit is attempted', () => {
  const host = mounted(
    form({ initialValues: { name: '' } }, textField({ field: 'name', required: true })),
  )
  const input = control(host, 'imp-text-field')
  type(input, '')
  expect(errorText(host, 'imp-text-field')).toEqual('')
  input.dispatchEvent(new FocusEvent('blur'))
  expect(errorText(host, 'imp-text-field')).toEqual('This field is required')
})

test('minLength and a custom validator report their own messages', () => {
  const host = mounted(
    form(
      { initialValues: { code: 'ab', word: 'no' } },
      textField({ field: 'code', minLength: 3 }),
      textField({ field: 'word', validate: (value) => value === 'yes' ? null : 'Say yes' }),
    ),
  )
  const fields = host.shadowRoot.querySelectorAll('imp-text-field')
  for (const field of fields) {
    shadow(field, '#control').dispatchEvent(new FocusEvent('blur'))
  }
  expect(shadow(fields[0], '.error').textContent).toEqual('Use at least 3 characters')
  expect(shadow(fields[1], '.error').textContent).toEqual('Say yes')
})

test('resetButton puts the initial values back', () => {
  const host = mounted(
    form(
      { initialValues: { name: 'Ada' } },
      textField({ field: 'name' }),
      resetButton('Reset'),
    ),
  )
  const input = control(host, 'imp-text-field')
  type(input, 'Grace')
  expect(input.value).toEqual('Grace')
  click(control(host, 'imp-reset-button', 'imp-button').shadowRoot.querySelector('button'))
  expect(input.value).toEqual('Ada')
})

test('Enter in a single-line field submits the form', () => {
  const submitted = []
  const host = mounted(
    form(
      { initialValues: { name: 'Ada' }, onSubmit: (values) => submitted.push(values) },
      textField({ field: 'name' }),
    ),
  )
  control(host, 'imp-text-field').dispatchEvent(
    new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, composed: true }),
  )
  expect(submitted).toEqual([{ name: 'Ada' }])
})

test('Enter in a multi-line textField does not submit the form', () => {
  const submitted = []
  const host = mounted(
    form(
      { initialValues: { note: 'hi' }, onSubmit: (values) => submitted.push(values) },
      textField({ field: 'note', rows: 3 }),
    ),
  )
  control(host, 'imp-text-field').dispatchEvent(
    new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, composed: true }),
  )
  expect(submitted.length).toEqual(0)
})

test('textField of type number commits a number, not a string', () => {
  let values
  const reader = component('form-reader-number', {
    setup: (self) => {
      values = useState(self, 'imp.form')
      return document.createTextNode('')
    },
  })
  const host = mounted(
    form({ initialValues: { age: 1 } }, textField({ field: 'age', type: 'number' }), reader()),
  )
  type(control(host, 'imp-text-field'), '42')
  expect(values.get()).toEqual({ age: 42 })
})

test('textField renders the input type that it is given', () => {
  for (const kind of ['email', 'tel', 'url', 'password', 'search', 'number']) {
    const host = mounted(textField({ type: kind, ariaLabel: kind }))
    expect(shadow(host, '#control').localName).toEqual('input')
    expect(shadow(host, '#control').getAttribute('type')).toEqual(kind)
  }
})

test('textField with rows renders a textarea', () => {
  const host = mounted(textField({ rows: 4, ariaLabel: 'Notes' }))
  expect(shadow(host, '#control').localName).toEqual('textarea')
  expect(shadow(host, '#control').getAttribute('rows')).toEqual('4')
  expect(shadow(host, '#control').hasAttribute('type')).toEqual(false)
})

test('textField warns about rows with a type, and about step without the number type', () => {
  const warn = warnings()
  const multiline = mounted(textField({ rows: 2, type: 'password', ariaLabel: 'Notes' }))
  expect(shadow(multiline, '#control').localName).toEqual('textarea')
  expect(warned(warn, "'rows' makes a multi-line field")).toBeTruthy()
  const stepped = mounted(textField({ step: 2, ariaLabel: 'Name' }))
  expect(shadow(stepped, '#control').hasAttribute('step')).toEqual(false)
  expect(warned(warn, "'step' applies to type 'number' only")).toBeTruthy()
  mounted(textField({ type: 'date', ariaLabel: 'Day' }))
  expect(warned(warn, "'type' must be one of")).toBeTruthy()
})

test('textField with a stepper renders a minus and a plus button around the number input', () => {
  let values
  const reader = component('form-reader-stepper', {
    setup: (self) => {
      values = useState(self, 'imp.form')
      return document.createTextNode('')
    },
  })
  const host = mounted(
    form(
      { initialValues: { seats: 4 } },
      textField({ field: 'seats', label: 'Seats', type: 'number', stepper: true, step: 2 }),
      reader(),
    ),
  )
  const field = shadow(host, 'imp-text-field')
  const stepper = shadow(field, '.stepper')
  expect([...stepper.children].map((node) => node.localName))
    .toEqual(['imp-button', 'input', 'imp-button'])
  const [down, up] = [...stepper.querySelectorAll('imp-button')]
    .map((node) => node.shadowRoot.querySelector('button'))
  expect(down.getAttribute('aria-label')).toEqual('Decrease')
  expect(up.getAttribute('aria-label')).toEqual('Increase')
  click(up)
  expect(values.get()).toEqual({ seats: 6 })
  click(down)
  click(down)
  expect(values.get()).toEqual({ seats: 2 })
  expect(shadow(field, '#control').value).toEqual('2')
})

test('textField warns about a stepper without the number type, and disables it when readonly', () => {
  const warn = warnings()
  const plain = mounted(textField({ stepper: true, ariaLabel: 'Name' }))
  expect(shadow(plain, '.stepper')).toEqual(null)
  expect(warned(warn, "'stepper' applies to type 'number' only")).toBeTruthy()
  const fixed = mounted(
    textField({ type: 'number', stepper: true, readonly: true, value: 2, ariaLabel: 'Seats' }),
  )
  const buttons = [...shadow(fixed, '.stepper').querySelectorAll('imp-button')]
    .map((node) => node.shadowRoot.querySelector('button'))
  expect(buttons.every((node) => node.disabled)).toEqual(true)
})

test('checkbox and toggle bind booleans', () => {
  let values
  const reader = component('form-reader-checks', {
    setup: (self) => {
      values = useState(self, 'imp.form')
      return document.createTextNode('')
    },
  })
  const host = mounted(
    form(
      { initialValues: { terms: false, alerts: true } },
      checkbox({ field: 'terms', label: 'Accept' }),
      toggle({ field: 'alerts', label: 'Alerts' }),
      reader(),
    ),
  )
  const box = control(host, 'imp-checkbox')
  const swtch = control(host, 'imp-toggle')
  expect(box.checked).toEqual(false)
  expect(swtch.checked).toEqual(true)
  expect(swtch.getAttribute('role')).toEqual('switch')
  box.checked = true
  change(box)
  expect(values.get()).toEqual({ terms: true, alerts: true })
})

test('select renders its options and binds the chosen one', () => {
  let values
  const reader = component('form-reader-select', {
    setup: (self) => {
      values = useState(self, 'imp.form')
      return document.createTextNode('')
    },
  })
  const host = mounted(
    form(
      { initialValues: { plan: 'pro' } },
      select({ field: 'plan', label: 'Plan', options: ['free', 'pro', 'team'] }),
      reader(),
    ),
  )
  const picker = control(host, 'imp-select')
  expect(picker.options.length).toEqual(3)
  expect(picker.value).toEqual('pro')
  picker.value = 'team'
  change(picker)
  expect(values.get()).toEqual({ plan: 'team' })
})

test('radioGroup is a named fieldset whose radios share the field name', () => {
  let values
  const reader = component('form-reader-radio', {
    setup: (self) => {
      values = useState(self, 'imp.form')
      return document.createTextNode('')
    },
  })
  const host = mounted(
    form(
      { initialValues: { size: 'm' } },
      radioGroup({ field: 'size', label: 'Size', options: ['s', 'm', 'l'] }),
      reader(),
    ),
  )
  const group = shadow(host, 'imp-radio-group')
  expect(shadow(group, 'fieldset').localName).toEqual('fieldset')
  expect(shadow(group, 'legend').textContent).toContain('Size')
  const radios = group.shadowRoot.querySelectorAll('input[type="radio"]')
  expect(radios.length).toEqual(3)
  expect(radios[1].checked).toEqual(true)
  radios[2].checked = true
  change(radios[2])
  expect(values.get()).toEqual({ size: 'l' })
})

test('a labelled field wires label, aria-invalid and aria-describedby in one shadow root', () => {
  const host = mounted(
    form(
      { initialValues: { email: '' } },
      textField({ field: 'email', label: 'Email', help: 'We never share it', required: true }),
    ),
  )
  const field = shadow(host, 'imp-text-field')
  const input = shadow(field, '#control')
  const label = shadow(field, 'label')
  expect(label.getAttribute('for')).toEqual('control')
  expect(field.shadowRoot.getElementById('control')).toEqual(input)
  expect(input.getAttribute('aria-required')).toEqual('true')
  expect(input.getAttribute('aria-invalid')).toEqual('false')
  expect(input.getAttribute('aria-describedby')).toEqual('help')
  input.dispatchEvent(new FocusEvent('blur'))
  expect(input.getAttribute('aria-invalid')).toEqual('true')
  expect(input.getAttribute('aria-describedby')).toEqual('help error')
})

test('a control bound to a plain state works without a form', () => {
  let name
  const host = component('standalone-field', {
    setup: (self) => {
      name = initState(self, 'demo.name', 'Ada')
      return textField({ value: name, label: 'Name' })
    },
  })
  const mountedHost = mounted(host())
  const input = shadow(shadow(mountedHost, 'imp-text-field'), '#control')
  expect(input.value).toEqual('Ada')
  type(input, 'Grace')
  expect(name.get()).toEqual('Grace')
  name.set('Katherine')
  expect(input.value).toEqual('Katherine')
})

test('passing both field and value keeps field and says so', () => {
  const warn = warnings()
  const host = mounted(
    form({ initialValues: { name: 'Ada' } }, textField({ field: 'name', value: 'ignored' })),
  )
  expect(warned(warn, "'field' and 'value' are alternatives")).toBeTruthy()
  expect(control(host, 'imp-text-field').value).toEqual('Ada')
})

test('an unknown input prop is logged and the control still renders', () => {
  const warn = warnings()
  const host = mounted(
    form({ initialValues: { name: '' } }, textField({ field: 'name', autofocus: true })),
  )
  expect(warned(warn, "unknown prop 'autofocus'")).toBeTruthy()
  expect(control(host, 'imp-text-field').localName).toEqual('input')
})

const settle = async () => {
  for (let tick = 0; tick < 4; tick++) await new Promise((resolve) => setTimeout(resolve, 0))
}

const submitOf = (host) =>
  control(host, 'imp-submit-button', 'imp-button').shadowRoot.querySelector('button')

const deferred = () => {
  let settleIt
  const promise = new Promise((resolve) => {
    settleIt = resolve
  })
  return { promise, settleIt }
}

test('submit waits for an async check and blocks on its message', async () => {
  const check = deferred()
  const submitted = []
  const host = mounted(
    form(
      { initialValues: { username: 'ada' }, onSubmit: (values) => submitted.push(values) },
      textField({ field: 'username', label: 'Username', validateAsync: () => check.promise }),
      submitButton('Save'),
    ),
  )
  click(submitOf(host))
  await settle()
  expect(submitted.length).toEqual(0)
  check.settleIt('Already taken')
  await settle()
  expect(submitted.length).toEqual(0)
  expect(errorText(host, 'imp-text-field')).toEqual('Already taken')
})

test('submit goes through once an async check comes back clean', async () => {
  const check = deferred()
  const submitted = []
  const host = mounted(
    form(
      { initialValues: { username: 'ada' }, onSubmit: (values) => submitted.push(values) },
      textField({ field: 'username', label: 'Username', validateAsync: () => check.promise }),
      submitButton('Save'),
    ),
  )
  click(submitOf(host))
  await settle()
  expect(submitted.length).toEqual(0)
  check.settleIt(null)
  await settle()
  expect(submitted).toEqual([{ username: 'ada' }])
})

test('an async check does not run on every keystroke, only on blur and submit', async () => {
  let runs = 0
  const host = mounted(
    form(
      { initialValues: { username: '' } },
      textField({
        field: 'username',
        validateAsync: () => {
          runs += 1
          return Promise.resolve(null)
        },
      }),
    ),
  )
  const input = control(host, 'imp-text-field')
  type(input, 'a')
  type(input, 'ad')
  type(input, 'ada')
  await settle()
  expect(runs).toEqual(0)
  input.dispatchEvent(new FocusEvent('blur'))
  await settle()
  expect(runs).toEqual(1)
})

test('a sync failure short-circuits the async check', async () => {
  let runs = 0
  const host = mounted(
    form(
      { initialValues: { username: '' } },
      textField({
        field: 'username',
        required: true,
        validateAsync: () => {
          runs += 1
          return Promise.resolve(null)
        },
      }),
    ),
  )
  control(host, 'imp-text-field').dispatchEvent(new FocusEvent('blur'))
  await settle()
  expect(runs).toEqual(0)
  expect(errorText(host, 'imp-text-field')).toEqual('This field is required')
})

test('an async check that throws reports a failure instead of hanging submit', async () => {
  const submitted = []
  const host = mounted(
    form(
      { initialValues: { username: 'ada' }, onSubmit: (values) => submitted.push(values) },
      textField({
        field: 'username',
        validateAsync: () => Promise.reject(new Error('network down')),
      }),
      submitButton('Save'),
    ),
  )
  click(submitOf(host))
  await settle()
  expect(submitted.length).toEqual(0)
  expect(errorText(host, 'imp-text-field')).toEqual('We could not check this - try again')
})

test('a field is marked busy while its async check is in flight', async () => {
  const check = deferred()
  const host = mounted(
    form(
      { initialValues: { username: 'ada' } },
      textField({ field: 'username', validateAsync: () => check.promise }),
    ),
  )
  const input = control(host, 'imp-text-field')
  expect(input.getAttribute('aria-busy')).toEqual('false')
  input.dispatchEvent(new FocusEvent('blur'))
  await settle()
  expect(input.getAttribute('aria-busy')).toEqual('true')
  check.settleIt(null)
  await settle()
  expect(input.getAttribute('aria-busy')).toEqual('false')
})

test('the submit button spins while an async check is running', async () => {
  const check = deferred()
  const host = mounted(
    form(
      { initialValues: { username: 'ada' }, onSubmit: () => {} },
      textField({ field: 'username', validateAsync: () => check.promise }),
      submitButton('Save'),
    ),
  )
  click(submitOf(host))
  await settle()
  expect(submitOf(host).getAttribute('aria-busy')).toEqual('true')
  check.settleIt(null)
  await settle()
  expect(submitOf(host).getAttribute('aria-busy')).toEqual('false')
})
