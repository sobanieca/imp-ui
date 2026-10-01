import { init, mount } from 'imp'
import { component } from 'imp'
import { setLang } from 'imp/i18n'
import {
  checkbox,
  form,
  FormError,
  radioGroup,
  resetForm,
  select,
  submitForm,
  textField,
  toggle,
} from 'imp/std/inputs'
import { button } from 'imp/std'
import { beforeEach, expect, spy, test } from 'imp/test'
import { initState, useState } from 'imp/state'

const mounted = (host) => {
  mount(document.body, host)
  return host
}

const shadow = (host, selector) => host.shadowRoot.querySelector(selector)

const control = (host, componentName, selector = '#control') =>
  shadow(shadow(host, componentName), selector)

const submitOf = (host) => shadow(host, 'imp-button').shadowRoot.querySelector('button')

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
      button({ variant: 'primary', events: { click: submitForm } }, 'Save'),
    ),
  )
  click(submitOf(host))
  expect(submitted.length).toEqual(0)
  expect(errorText(host, 'imp-text-field')).toEqual('This field is required')
})

test('a failed submit moves the focus to the first invalid field', () => {
  const host = mounted(
    form(
      { initialValues: { name: 'Ada', email: '' }, onSubmit: () => {} },
      textField({ field: 'name', label: 'Name', required: true }),
      textField({ field: 'email', label: 'Email', required: true }),
      button({ variant: 'primary', events: { click: submitForm } }, 'Save'),
    ),
  )
  click(submitOf(host))
  const email = shadow(host, 'imp-text-field:nth-of-type(2)')
  expect(email.shadowRoot.activeElement).toEqual(email.shadowRoot.querySelector('#control'))
})

test('a valid form submits its values', () => {
  const submitted = []
  const host = mounted(
    form(
      { initialValues: { name: 'Ada' }, onSubmit: (values) => submitted.push(values) },
      textField({ field: 'name', label: 'Name', required: true }),
      button({ variant: 'primary', events: { click: submitForm } }, 'Save'),
    ),
  )
  click(submitOf(host))
  expect(submitted).toEqual([{ name: 'Ada' }])
})

const formStateReader = component('form-state-reader', {
  setup: (self, { name, sink }) => {
    sink(useState(self, name))
    return document.createTextNode('')
  },
})

const failureNoticeOf = (host) => shadow(host, 'imp-notice')

const failureShown = (host) =>
  !failureNoticeOf(host).shadowRoot.querySelector('.root').classList.contains('closed')

test('imp.form.dirty is true while a value differs from initialValues', () => {
  let dirty
  const host = mounted(
    form(
      { initialValues: { name: 'Ada' } },
      textField({ field: 'name' }),
      formStateReader({ name: 'imp.form.dirty', sink: (state) => (dirty = state) }),
    ),
  )
  expect(dirty.get()).toEqual(false)
  const input = control(host, 'imp-text-field')
  type(input, 'Grace')
  expect(dirty.get()).toEqual(true)
  type(input, 'Ada')
  expect(dirty.get()).toEqual(false)
})

test('resetForm makes the form clean again', () => {
  let dirty
  const host = mounted(
    form(
      { initialValues: { name: 'Ada' } },
      textField({ field: 'name' }),
      formStateReader({ name: 'imp.form.dirty', sink: (state) => (dirty = state) }),
      button({ events: { click: resetForm } }, 'Reset'),
    ),
  )
  type(control(host, 'imp-text-field'), 'Grace')
  click(submitOf(host))
  expect(dirty.get()).toEqual(false)
})

const valuesReader = (sink) => formStateReader({ name: 'imp.form', sink })

const dirtyReader = (sink) => formStateReader({ name: 'imp.form.dirty', sink })

const flushed = async () => {
  for (let step = 0; step < 4; step++) await Promise.resolve()
}

test('a successful submit makes the submitted values the clean state', () => {
  let dirty
  let values
  const host = mounted(
    form(
      { initialValues: { name: 'Ada' }, onSubmit: () => {} },
      textField({ field: 'name' }),
      dirtyReader((state) => (dirty = state)),
      valuesReader((state) => (values = state)),
      button({ variant: 'primary', events: { click: submitForm } }, 'Save'),
    ),
  )
  const input = control(host, 'imp-text-field')
  type(input, 'Grace')
  expect(dirty.get()).toEqual(true)
  click(submitOf(host))
  expect(dirty.get()).toEqual(false)
  type(input, 'Ada')
  expect(dirty.get()).toEqual(true)
  resetForm(submitOf(host))
  expect(values.get()).toEqual({ name: 'Grace' })
  expect(dirty.get()).toEqual(false)
})

test('an edit made while an async submit runs stays dirty after the save', async () => {
  let dirty
  let finish
  const submitted = []
  const host = mounted(
    form(
      {
        initialValues: { name: 'Ada' },
        onSubmit: (values) => {
          submitted.push(values)
          return new Promise((resolve) => (finish = resolve))
        },
      },
      textField({ field: 'name' }),
      dirtyReader((state) => (dirty = state)),
      button({ variant: 'primary', events: { click: submitForm } }, 'Save'),
    ),
  )
  const input = control(host, 'imp-text-field')
  type(input, 'Grace')
  click(submitOf(host))
  type(input, 'Linus')
  finish()
  await flushed()
  expect(submitted).toEqual([{ name: 'Grace' }])
  expect(dirty.get()).toEqual(true)
  type(input, 'Grace')
  expect(dirty.get()).toEqual(false)
})

test('a failed submit keeps the values dirty', async () => {
  warnings()
  let dirty
  const host = mounted(
    form(
      { initialValues: { name: 'Ada' }, onSubmit: () => Promise.reject(new Error('Offline')) },
      textField({ field: 'name' }),
      dirtyReader((state) => (dirty = state)),
      button({ variant: 'primary', events: { click: submitForm } }, 'Save'),
    ),
  )
  type(control(host, 'imp-text-field'), 'Grace')
  click(submitOf(host))
  await flushed()
  expect(dirty.get()).toEqual(true)
})

test('a resetForm inside the submit handler wins over the save', async () => {
  let dirty
  let values
  let host = null
  host = mounted(
    form(
      {
        initialValues: { name: '' },
        onSubmit: async () => {
          await Promise.resolve()
          resetForm(submitOf(host))
        },
      },
      textField({ field: 'name' }),
      dirtyReader((state) => (dirty = state)),
      valuesReader((state) => (values = state)),
      button({ variant: 'primary', events: { click: submitForm } }, 'Add'),
    ),
  )
  type(control(host, 'imp-text-field'), 'Buy milk')
  click(submitOf(host))
  await flushed()
  expect(values.get()).toEqual({ name: '' })
  expect(dirty.get()).toEqual(false)
})

test('resetForm with values puts them in the form as the clean state', () => {
  let dirty
  let values
  const host = mounted(
    form(
      { initialValues: { name: null } },
      textField({ field: 'name' }),
      dirtyReader((state) => (dirty = state)),
      valuesReader((state) => (values = state)),
      button({ events: { click: resetForm } }, 'Reset'),
    ),
  )
  resetForm(submitOf(host), { name: 'Loaded' })
  expect(values.get()).toEqual({ name: 'Loaded' })
  expect(control(host, 'imp-text-field').value).toEqual('Loaded')
  expect(dirty.get()).toEqual(false)
  type(control(host, 'imp-text-field'), 'Edited')
  expect(dirty.get()).toEqual(true)
  resetForm(submitOf(host), values.get())
  expect(dirty.get()).toEqual(false)
  type(control(host, 'imp-text-field'), 'Again')
  click(submitOf(host))
  expect(values.get()).toEqual({ name: 'Edited' })
})

test('a FormError thrown by the submit handler shows its own message', () => {
  const warn = warnings()
  let formError
  const host = mounted(
    form(
      {
        initialValues: { name: 'Ada' },
        onSubmit: () => {
          throw new FormError('The name is taken\nsecond line')
        },
      },
      textField({ field: 'name' }),
      formStateReader({ name: 'imp.form.formError', sink: (state) => (formError = state) }),
      button({ variant: 'primary', events: { click: submitForm } }, 'Save'),
    ),
  )
  expect(formError.get()).toEqual(null)
  expect(failureShown(host)).toEqual(false)
  click(submitOf(host))
  expect(formError.get()).toEqual('The name is taken')
  expect(failureShown(host)).toEqual(true)
  expect(failureNoticeOf(host).shadowRoot.querySelector('.title').textContent)
    .toEqual('The name is taken')
  expect(failureNoticeOf(host).shadowRoot.querySelector('[role="alert"]')).toBeTruthy()
  expect(warned(warn, 'onSubmit failed')).toEqual(false)
})

test('a FormError with fields shows each message on its field and focuses the first', () => {
  const warn = warnings()
  let formError
  const host = mounted(
    form(
      {
        initialValues: { name: 'Ada', email: 'ada@example.com' },
        onSubmit: () => {
          throw new FormError('', { fields: { email: 'This email is taken', name: 'Too short' } })
        },
      },
      textField({ field: 'name' }),
      textField({ field: 'email' }),
      formStateReader({ name: 'imp.form.formError', sink: (state) => (formError = state) }),
      button({ variant: 'primary', events: { click: submitForm } }, 'Save'),
    ),
  )
  click(submitOf(host))
  const fields = host.shadowRoot.querySelectorAll('imp-text-field')
  expect(shadow(fields[0], '.error').textContent).toEqual('Too short')
  expect(shadow(fields[1], '.error').textContent).toEqual('This email is taken')
  expect(formError.get()).toEqual(null)
  expect(failureShown(host)).toEqual(false)
  expect(host.shadowRoot.activeElement).toEqual(fields[0])
  expect(warned(warn, 'onSubmit failed')).toEqual(false)
  type(control(host, 'imp-text-field'), 'Adalyn')
  expect(shadow(fields[0], '.error').textContent).toEqual('')
})

test('a FormError field that names an unknown path does not block the next submit', () => {
  const warn = warnings()
  const submit = spy(() => {
    if (submit.calls.length === 1) throw new FormError('Rejected', { fields: { ghost: 'nope' } })
  })
  const host = mounted(
    form(
      { initialValues: { name: 'Ada' }, onSubmit: submit },
      textField({ field: 'name' }),
      button({ variant: 'primary', events: { click: submitForm } }, 'Save'),
    ),
  )
  click(submitOf(host))
  click(submitOf(host))
  expect(submit.calls.length).toEqual(2)
  expect(warned(warn, 'onSubmit failed')).toEqual(false)
})

test('a field path with an index reads and writes an array of rows', () => {
  let values
  const host = mounted(
    form(
      { initialValues: { items: [{ name: 'One' }, { name: 'Two' }] } },
      textField({ field: 'items.1.name' }),
      textField({ field: 'items.2.name' }),
      formStateReader({ name: 'imp.form', sink: (state) => (values = state) }),
    ),
  )
  const fields = host.shadowRoot.querySelectorAll('imp-text-field')
  expect(shadow(fields[0], '#control').value).toEqual('Two')
  type(shadow(fields[1], '#control'), 'Three')
  expect(Array.isArray(values.get().items)).toEqual(true)
  expect(values.get().items).toEqual([{ name: 'One' }, { name: 'Two' }, { name: 'Three' }])
})

test('a field path with an index builds the array when the form has no value yet', () => {
  let values
  const host = mounted(
    form(
      { initialValues: {} },
      textField({ field: 'items.0.name' }),
      formStateReader({ name: 'imp.form', sink: (state) => (values = state) }),
    ),
  )
  type(control(host, 'imp-text-field'), 'First')
  expect(values.get()).toEqual({ items: [{ name: 'First' }] })
})

test('any other error shows the translated generic message and logs the error', async () => {
  const warn = warnings()
  const polish = { imp: { form: { submitFailed: 'Nie udalo sie wyslac formularza' } } }
  await init({
    translations: {
      en: () => Promise.resolve({ default: {} }),
      pl: () => Promise.resolve({ default: polish }),
    },
  })
  const failure = new TypeError('Cannot read properties of undefined')
  let formError
  const host = mounted(
    form(
      {
        initialValues: { name: 'Ada' },
        onSubmit: () => {
          throw failure
        },
      },
      textField({ field: 'name' }),
      formStateReader({ name: 'imp.form.formError', sink: (state) => (formError = state) }),
      button({ variant: 'primary', events: { click: submitForm } }, 'Save'),
    ),
  )
  click(submitOf(host))
  const title = () => failureNoticeOf(host).shadowRoot.querySelector('.title').textContent
  expect(formError.get()).toEqual('')
  expect(failureShown(host)).toEqual(true)
  expect(title()).toEqual('We could not send the form - try again')
  const logged = warn.calls.find(([first]) => String(first).includes('onSubmit failed'))
  expect(logged.includes(failure)).toEqual(true)
  await setLang('pl')
  expect(title()).toEqual('Nie udalo sie wyslac formularza')
  await setLang('en')
})

test('the failure notice sits above the last child, which holds the buttons', () => {
  const host = mounted(
    form(
      { initialValues: { name: 'Ada' } },
      textField({ field: 'name' }),
      button({ variant: 'primary', events: { click: submitForm } }, 'Save'),
    ),
  )
  const names = [...host.shadowRoot.querySelector('form').children].map((node) => node.localName)
  expect(names).toEqual(['imp-text-field', 'imp-notice', 'imp-button'])
})

test('a rejected submit sets formError, and the next submit clears it', async () => {
  warnings()
  let formError
  let attempt = 0
  const host = mounted(
    form(
      {
        initialValues: { name: 'Ada' },
        onSubmit: () => {
          attempt++
          return attempt === 1 ? Promise.reject(new FormError('Offline')) : new Promise(() => {})
        },
      },
      textField({ field: 'name' }),
      formStateReader({ name: 'imp.form.formError', sink: (state) => (formError = state) }),
      button({ variant: 'primary', events: { click: submitForm } }, 'Save'),
    ),
  )
  click(submitOf(host))
  await Promise.resolve()
  await Promise.resolve()
  expect(formError.get()).toEqual('Offline')
  click(submitOf(host))
  expect(formError.get()).toEqual(null)
  expect(failureShown(host)).toEqual(false)
})

test('a thrown value with no message shows the default failure text', () => {
  warnings()
  const host = mounted(
    form(
      {
        initialValues: { name: 'Ada' },
        onSubmit: () => {
          throw {}
        },
      },
      textField({ field: 'name' }),
      button({ variant: 'primary', events: { click: submitForm } }, 'Save'),
    ),
  )
  click(submitOf(host))
  expect(failureNoticeOf(host).shadowRoot.querySelector('.title').textContent)
    .toEqual('We could not send the form - try again')
})

test('an error stays hidden until the field is changed and left, or submit is attempted', () => {
  const host = mounted(
    form({ initialValues: { name: 'Ada' } }, textField({ field: 'name', required: true })),
  )
  const input = control(host, 'imp-text-field')
  input.dispatchEvent(new FocusEvent('blur'))
  expect(errorText(host, 'imp-text-field')).toEqual('')
  type(input, '')
  expect(errorText(host, 'imp-text-field')).toEqual('')
  input.dispatchEvent(new FocusEvent('blur'))
  expect(errorText(host, 'imp-text-field')).toEqual('This field is required')
})

test('resetForm hides the error again until the next change', () => {
  const host = mounted(
    form(
      { initialValues: { name: '' } },
      textField({ field: 'name', required: true }),
      button({ events: { click: resetForm } }, 'Reset'),
    ),
  )
  const input = control(host, 'imp-text-field')
  type(input, 'Ada')
  click(submitOf(host))
  input.dispatchEvent(new FocusEvent('blur'))
  expect(errorText(host, 'imp-text-field')).toEqual('')
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
    const input = shadow(field, '#control')
    type(input, input.value.slice(0, 1))
    input.dispatchEvent(new FocusEvent('blur'))
  }
  expect(shadow(fields[0], '.error').textContent).toEqual('Use at least 3 characters')
  expect(shadow(fields[1], '.error').textContent).toEqual('Say yes')
})

test('resetForm puts the initial values back', () => {
  const host = mounted(
    form(
      { initialValues: { name: 'Ada' } },
      textField({ field: 'name' }),
      button({ events: { click: resetForm } }, 'Reset'),
    ),
  )
  const input = control(host, 'imp-text-field')
  type(input, 'Grace')
  expect(input.value).toEqual('Grace')
  click(submitOf(host))
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
      { initialValues: { email: 'ada@example.com' } },
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
  type(input, '')
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
      button({ variant: 'primary', events: { click: submitForm } }, 'Save'),
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
      button({ variant: 'primary', events: { click: submitForm } }, 'Save'),
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
      { initialValues: { username: 'ada' } },
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
  type(control(host, 'imp-text-field'), '')
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
      button({ variant: 'primary', events: { click: submitForm } }, 'Save'),
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

const savingButton = component('inputs-saving-button', {
  setup: (self) =>
    button(
      {
        variant: 'primary',
        loading: useState(self, 'imp.form.submitting'),
        events: { click: submitForm },
      },
      'Save',
    ),
})

const savingOf = (host) => shadow(shadow(host, 'inputs-saving-button'), 'imp-button')

test('a button that reads imp.form.submitting spins while an async check is running', async () => {
  const check = deferred()
  const host = mounted(
    form(
      { initialValues: { username: 'ada' }, onSubmit: () => {} },
      textField({ field: 'username', validateAsync: () => check.promise }),
      savingButton(),
    ),
  )
  const native = savingOf(host).shadowRoot.querySelector('button')
  click(native)
  await settle()
  expect(native.getAttribute('aria-busy')).toEqual('true')
  check.settleIt(null)
  await settle()
  expect(native.getAttribute('aria-busy')).toEqual('false')
})

test('submitForm and resetForm outside a form warn and do nothing', () => {
  const warn = warnings()
  const loose = mounted(button({ events: { click: submitForm } }, 'Save'))
  click(loose.shadowRoot.querySelector('button'))
  expect(warned(warn, 'submitForm found no form around the node')).toBeTruthy()
  resetForm('nowhere')
  expect(warned(warn, 'resetForm takes the click event, or a node inside the form')).toBeTruthy()
})
