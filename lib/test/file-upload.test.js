import { component, mount } from 'imp'
import { fileUpload, form, resetForm, submitForm } from 'imp/std/inputs'
import { button } from 'imp/std'
import { beforeEach, expect, spy, test } from 'imp/test'
import { initState, useState } from 'imp/state'
import {
  acceptsFile,
  fileTypeOf,
  formatFileSize,
  readAccept,
} from '../src/std/inputs/file-rules.js'

const mounted = (host) => {
  mount(document.body, host)
  return host
}

const inner = (host, selector) => host.shadowRoot.querySelector(selector)

const click = (node) => node.dispatchEvent(new MouseEvent('click', { bubbles: true }))

const warnings = () => spy(console, 'warn', () => {})

const warned = (warn, text) => warn.calls.some(([first]) => String(first).includes(text))

const fileOf = (name, type, size = 4) => new File(['x'.repeat(size)], name, { type })

const pick = (control, files) => {
  const input = inner(control, '#control')
  Object.defineProperty(input, 'files', { value: files, configurable: true })
  input.dispatchEvent(new Event('change', { bubbles: true }))
}

const dragEvent = (type, files) => {
  const event = new Event(type, { bubbles: true, cancelable: true })
  Object.defineProperty(event, 'dataTransfer', { value: { files } })
  return event
}

const rowsOf = (control) => [...control.shadowRoot.querySelectorAll('.file')]

const removeButtonOf = (row) => inner(row.querySelector('imp-button'), 'button')

const formButton = (host) => inner(inner(host, 'imp-button'), 'button')

const inForm = (initialValues, ...controls) => {
  let values
  const reader = component(`upload-reader-${Math.random().toString(36).slice(2)}`, {
    setup: (self) => {
      values = useState(self, 'imp.form')
      return document.createTextNode('')
    },
  })
  const host = mounted(form({ initialValues }, ...controls, reader()))
  return { host, values, control: inner(host, 'imp-file-upload') }
}

beforeEach(() => {
  document.body.replaceChildren()
})

test('fileUpload renders a labelled native file input and a drop zone', () => {
  const { control } = inForm(
    { attachments: [] },
    fileUpload({
      field: 'attachments',
      label: 'Attachments',
      multiple: true,
      accept: 'image/*,.pdf',
      maxSize: 5_000_000,
    }),
  )
  const input = inner(control, '#control')
  expect(input.localName).toEqual('input')
  expect(input.type).toEqual('file')
  expect(input.multiple).toEqual(true)
  expect(input.getAttribute('accept')).toEqual('image/*,.pdf')
  expect(inner(control, 'label.label').getAttribute('for')).toEqual('control')
  expect(inner(control, 'label.label').textContent).toContain('Attachments')
  const prompt = inner(control, 'label.prompt')
  expect(prompt.getAttribute('for')).toEqual('control')
  expect(prompt.textContent).toEqual('Drop files here, or browse')
  const hint = inner(control, '#hint')
  expect(hint.textContent).toContain('Accepts image/*, .pdf')
  expect(hint.textContent).toContain('5 MB')
  expect(input.getAttribute('aria-describedby')).toEqual('hint')
  expect(inner(control, '.files').hidden).toEqual(true)
})

test('a pick writes plain entries to the field and hands the File objects to onFiles', () => {
  const handed = []
  const { control, values } = inForm(
    { attachments: [] },
    fileUpload({ field: 'attachments', multiple: true, onFiles: (files) => handed.push(files) }),
  )
  const photo = fileOf('photo.png', 'image/png', 1200)
  pick(control, [photo])
  const [entry] = values.get().attachments
  expect({ ...entry, id: typeof entry.id }).toEqual({
    id: 'string',
    name: 'photo.png',
    size: 1200,
    type: 'image/png',
  })
  expect(handed.length).toEqual(1)
  expect(handed[0][0]).toEqual(photo)
  const [row] = rowsOf(control)
  expect(row.querySelector('.name').textContent).toEqual('photo.png')
  expect(row.querySelector('.size').textContent).toContain('1.2')
  expect(removeButtonOf(row).getAttribute('aria-label')).toEqual('Remove photo.png')
})

test('a size under one kilobyte reads in whole bytes', () => {
  expect(formatFileSize(16, 'en')).toEqual('16 bytes')
  expect(formatFileSize(1, 'en')).toEqual('1 byte')
  expect(formatFileSize(1200, 'en')).toEqual('1.2 kB')
})

test('multiple adds to the list and a single upload replaces its file', () => {
  const many = inForm({ files: [] }, fileUpload({ field: 'files', multiple: true }))
  pick(many.control, [fileOf('a.txt', 'text/plain')])
  pick(many.control, [fileOf('b.txt', 'text/plain'), fileOf('c.txt', 'text/plain')])
  expect(many.values.get().files.map(({ name }) => name)).toEqual(['a.txt', 'b.txt', 'c.txt'])

  document.body.replaceChildren()
  const handed = []
  const one = inForm(
    { file: [] },
    fileUpload({ field: 'file', onFiles: (files) => handed.push(files.map(({ name }) => name)) }),
  )
  pick(one.control, [fileOf('a.txt', 'text/plain')])
  pick(one.control, [fileOf('b.txt', 'text/plain'), fileOf('c.txt', 'text/plain')])
  expect(one.values.get().file.map(({ name }) => name)).toEqual(['b.txt'])
  expect(handed).toEqual([['a.txt'], ['b.txt']])
})

test('the remove button drops the entry and its File', () => {
  const handed = []
  const { control, values } = inForm(
    { files: [] },
    fileUpload({
      field: 'files',
      multiple: true,
      onFiles: (files) => handed.push(files.map(({ name }) => name)),
    }),
  )
  pick(control, [fileOf('a.txt', 'text/plain'), fileOf('b.txt', 'text/plain')])
  click(removeButtonOf(rowsOf(control)[0]))
  expect(values.get().files.map(({ name }) => name)).toEqual(['b.txt'])
  expect(handed.at(-1)).toEqual(['b.txt'])
  expect(rowsOf(control).length).toEqual(1)
  expect(control.shadowRoot.activeElement).toEqual(inner(control, '#control'))
})

test('a drop on the zone adds the files', () => {
  const { control, values } = inForm({ files: [] }, fileUpload({ field: 'files', multiple: true }))
  const zone = inner(control, '.zone')
  const over = dragEvent('dragover', [])
  zone.dispatchEvent(over)
  expect(over.defaultPrevented).toEqual(true)
  expect(zone.classList.contains('over')).toEqual(true)
  zone.dispatchEvent(dragEvent('drop', [fileOf('dropped.pdf', 'application/pdf')]))
  expect(zone.classList.contains('over')).toEqual(false)
  expect(values.get().files.map(({ name }) => name)).toEqual(['dropped.pdf'])
})

test('a file over maxSize or outside accept is refused with a field error', () => {
  const { control, values } = inForm(
    { files: [] },
    fileUpload({ field: 'files', multiple: true, accept: 'image/*,.pdf', maxSize: 1000 }),
  )
  pick(control, [fileOf('big.png', 'image/png', 2000), fileOf('ok.PDF', '', 10)])
  expect(values.get().files.map(({ name }) => name)).toEqual(['ok.PDF'])
  expect(inner(control, '.error').textContent).toEqual('big.png is larger than 1 kB')
  expect(inner(control, '#control').getAttribute('aria-invalid')).toEqual('true')
  pick(control, [fileOf('notes.txt', 'text/plain', 10)])
  expect(inner(control, '.error').textContent).toEqual('notes.txt is not an accepted file type')
  pick(control, [fileOf('photo.jpg', 'image/jpeg', 10)])
  expect(inner(control, '.error').textContent).toEqual('')
})

test('a HEIC or HEIF file with no type takes its type from the extension', () => {
  expect(fileTypeOf(fileOf('IMG_0001.HEIC', ''))).toEqual('image/heic')
  expect(fileTypeOf(fileOf('scan.heif', ''))).toEqual('image/heif')
  expect(fileTypeOf(fileOf('photo.heic', 'image/heic'))).toEqual('image/heic')
  expect(fileTypeOf(fileOf('notes', ''))).toEqual('')
  expect(fileTypeOf(fileOf('archive.xyz', ''))).toEqual('')
  const images = readAccept('fileUpload', 'image/*')
  expect(acceptsFile(images, fileOf('IMG_0001.HEIC', ''))).toEqual(true)
  expect(acceptsFile(images, fileOf('archive.xyz', ''))).toEqual(false)
  expect(acceptsFile(readAccept('fileUpload', 'image/heic'), fileOf('a.heic', ''))).toEqual(true)
})

test('a refused file does not block the next submit', () => {
  const submitted = []
  const host = mounted(form(
    { initialValues: { files: [] }, onSubmit: (values) => submitted.push(values) },
    fileUpload({ field: 'files', multiple: true, maxSize: 1000 }),
    button({ variant: 'primary', events: { click: submitForm } }, 'Save'),
  ))
  const control = inner(host, 'imp-file-upload')
  pick(control, [fileOf('big.png', 'image/png', 2000)])
  expect(inner(control, '.error').textContent).toContain('big.png')
  click(formButton(host))
  expect(submitted).toEqual([{ files: [] }])
  expect(inner(control, '.error').textContent).toEqual('')
})

test('required reports an empty list on submit', () => {
  const { host, control } = inForm(
    { files: [] },
    fileUpload({ field: 'files', label: 'Files', required: true }),
    button({ variant: 'primary', events: { click: submitForm } }, 'Save'),
  )
  click(formButton(host))
  expect(inner(control, '.error').textContent).toEqual('This field is required')
  expect(inner(control, '#control').getAttribute('aria-required')).toEqual('true')
})

test('a form reset empties the list and tells onFiles', () => {
  const handed = []
  const { host, control, values } = inForm(
    { files: [] },
    fileUpload({ field: 'files', multiple: true, onFiles: (files) => handed.push(files.length) }),
    button({ events: { click: resetForm } }, 'Reset'),
  )
  pick(control, [fileOf('a.txt', 'text/plain')])
  click(formButton(host))
  expect(values.get().files).toEqual([])
  expect(rowsOf(control).length).toEqual(0)
  expect(handed).toEqual([1, 0])
})

test('a bound state works without a form, and a stored entry shows with no File', () => {
  let files
  const handed = []
  const holder = component('upload-holder', {
    setup: (self) => {
      files = initState(self, 'demo.files', [
        { id: 'stored-1', name: 'contract.pdf', size: 48_000, type: 'application/pdf' },
      ])
      return fileUpload({
        value: files,
        label: 'Files',
        multiple: true,
        onFiles: (list) => handed.push(list.map(({ name }) => name)),
      })
    },
  })
  const control = inner(mounted(holder()), 'imp-file-upload')
  expect(rowsOf(control).map((row) => row.querySelector('.name').textContent))
    .toEqual(['contract.pdf'])
  expect(handed).toEqual([])
  pick(control, [fileOf('new.txt', 'text/plain')])
  expect(files.get().map(({ name }) => name)).toEqual(['contract.pdf', 'new.txt'])
  expect(handed).toEqual([['new.txt']])
})

test('a rejected onFiles promise is logged', async () => {
  const errors = spy(console, 'error', () => {})
  const control = mounted(fileUpload({
    value: [],
    ariaLabel: 'Files',
    onFiles: () => Promise.reject(new Error('offline')),
  }))
  pick(control, [fileOf('a.txt', 'text/plain')])
  await new Promise((resolve) => setTimeout(resolve, 0))
  expect(errors.calls.some(([first]) => String(first).includes("'onFiles' failed"))).toBeTruthy()
})

test('disabled blocks the input, the drop and the remove buttons', () => {
  let blocked
  let files
  const holder = component('upload-disabled-holder', {
    setup: (self) => {
      blocked = initState(self, 'demo.blocked', true)
      files = initState(self, 'demo.files', [{ id: 'a', name: 'a.txt', size: 10, type: '' }])
      return fileUpload({ value: files, label: 'Files', multiple: true, disabled: blocked })
    },
  })
  const control = inner(mounted(holder()), 'imp-file-upload')
  expect(inner(control, '#control').disabled).toEqual(true)
  expect(removeButtonOf(rowsOf(control)[0]).disabled).toEqual(true)
  inner(control, '.zone').dispatchEvent(dragEvent('drop', [fileOf('b.txt', 'text/plain')]))
  expect(files.get().length).toEqual(1)
  blocked.set(false)
  expect(removeButtonOf(rowsOf(control)[0]).disabled).toEqual(false)
})

test('bad props are logged', () => {
  const warn = warnings()
  mounted(fileUpload({ value: [], accept: ['.pdf'], maxSize: -1, onFiles: 'save', upload: true }))
  expect(warned(warn, "'accept' must be a string")).toBeTruthy()
  expect(warned(warn, "'maxSize' must be a number of bytes")).toBeTruthy()
  expect(warned(warn, "'onFiles' must be a function")).toBeTruthy()
  expect(warned(warn, "unknown prop 'upload'")).toBeTruthy()
})
