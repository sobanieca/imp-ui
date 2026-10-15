import { component, mount } from 'imp'
import { form, imageUpload, resetForm, submitForm } from 'imp/std/inputs'
import { button } from 'imp/std'
import { beforeEach, expect, spy, test } from 'imp/test'
import { initState, useState } from 'imp/state'
import { embedImage } from '../src/std/inputs/image-tools.js'

const mounted = (host) => {
  mount(document.body, host)
  return host
}

const inner = (host, selector) => host.shadowRoot.querySelector(selector)

const click = (node) => node.dispatchEvent(new MouseEvent('click', { bubbles: true }))

const warnings = () => spy(console, 'warn', () => {})

const warned = (warn, text) => warn.calls.some(([first]) => String(first).includes(text))

const fileOf = (name, type, size = 4) => new File(['x'.repeat(size)], name, { type })

const settle = async () => {
  for (let tick = 0; tick < 6; tick++) await new Promise((resolve) => setTimeout(resolve, 0))
}

const pick = async (control, file) => {
  const input = inner(control, '#control')
  Object.defineProperty(input, 'files', { value: [file], configurable: true })
  input.dispatchEvent(new Event('change', { bubbles: true }))
  await settle()
}

const press = (node, key) =>
  node.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true }))

const buttonOf = (control, index) =>
  inner([...control.shadowRoot.querySelectorAll('imp-button')][index], 'button')

const actionHost = (control, text) =>
  [...control.shadowRoot.querySelectorAll('imp-button')].find(
    (host) => inner(host, 'button').textContent === text,
  )

const actionButton = (control, text) => inner(actionHost(control, text), 'button')

const formButton = (host) => inner(inner(host, 'imp-button'), 'button')

const drawn = []

let decoded = { width: 1920, height: 1080 }

let failDecode = false

const stubPlatform = () => {
  drawn.length = 0
  failDecode = false
  decoded = { width: 1920, height: 1080 }
  globalThis.createImageBitmap = (file) =>
    failDecode
      ? Promise.reject(new Error('not an image'))
      : Promise.resolve({ ...decoded, name: file.name, close: () => {} })
  globalThis.OffscreenCanvas = class {
    constructor(width, height) {
      this.width = width
      this.height = height
    }
    getContext() {
      return { drawImage: (...args) => drawn.push({ canvas: this, args }) }
    }
    convertToBlob({ type }) {
      return Promise.resolve(new Blob([`${this.width}x${this.height}`], { type }))
    }
  }
}

const inForm = (initialValues, ...controls) => {
  let values
  const reader = component(`image-reader-${Math.random().toString(36).slice(2)}`, {
    setup: (self) => {
      values = useState(self, 'imp.form')
      return document.createTextNode('')
    },
  })
  const host = mounted(form({ initialValues }, ...controls, reader()))
  return { host, values, control: inner(host, 'imp-image-upload') }
}

const lastDraw = () => {
  const { canvas, args } = drawn.at(-1)
  const [, x, y, width, height] = args
  return { x, y, width, height, out: [canvas.width, canvas.height] }
}

beforeEach(() => {
  document.body.replaceChildren()
  stubPlatform()
})

test('imageUpload renders a labelled native file input behind a drop zone', () => {
  const { control } = inForm(
    { avatar: undefined },
    imageUpload({ field: 'avatar', label: 'Profile picture', maxSize: 5_000_000 }),
  )
  const input = inner(control, '#control')
  expect(input.localName).toEqual('input')
  expect(input.type).toEqual('file')
  expect(input.multiple).toEqual(false)
  expect(input.getAttribute('accept')).toEqual('image/*,.heic,.heif')
  expect(inner(control, 'label.label').getAttribute('for')).toEqual('control')
  expect(inner(control, 'label.prompt').textContent).toEqual('Drop an image here, or browse')
  expect(inner(control, '#hint').textContent).toEqual('Up to 5 MB')
  expect(input.getAttribute('aria-describedby')).toEqual('hint')
  expect(inner(control, '.zone').hidden).toEqual(false)
  expect(inner(control, '.editor').hidden).toEqual(true)
  expect(inner(control, '.result').hidden).toEqual(true)
  const upload = inner(control, '.upload')
  expect(upload.classList.contains('compact')).toEqual(false)
  expect(upload.style.getPropertyValue('--preview-ratio')).toEqual(String(16 / 9))
  expect(inner(control, '.zone .slot').classList.contains('placeholder')).toEqual(true)
  expect(inner(control, '.zone .slot').contains(inner(control, 'label.prompt'))).toEqual(true)
  expect(inner(control, '.result .slot').contains(inner(control, '.preview'))).toEqual(true)
})

test('compact puts a small box beside the prompt, and the box keeps the ratio of the crop', () => {
  const wide = mounted(imageUpload({ value: undefined, label: 'Cover', aspect: 4 / 3 }))
  expect(inner(wide, '.upload').style.getPropertyValue('--preview-ratio')).toEqual(String(4 / 3))
  const small = mounted(imageUpload({ value: undefined, label: 'Cover', compact: true }))
  const upload = inner(small, '.upload')
  expect(upload.classList.contains('compact')).toEqual(true)
  expect(upload.style.getPropertyValue('--preview-ratio')).toEqual('1')
  expect(inner(small, '.zone .slot').contains(inner(small, 'label.prompt'))).toEqual(false)
  expect(inner(small, '.zone > .words')).toBeTruthy()
  const round = mounted(imageUpload({ value: '/a.png', label: 'Cover', shape: 'circle' }))
  expect(inner(round, '.upload').style.getPropertyValue('--preview-ratio')).toEqual('1')
  expect(inner(round, '.zone .slot').classList.contains('circle')).toEqual(true)
  expect(inner(round, '.result .slot').classList.contains('circle')).toEqual(true)
})

test('a pick opens the editor with the picture covering a frame of the aspect', async () => {
  const { control, values } = inForm(
    { cover: undefined },
    imageUpload({ field: 'cover', label: 'Cover', aspect: 1 }),
  )
  await pick(control, fileOf('photo.jpg', 'image/jpeg'))
  expect(values.get().cover).toEqual(undefined)
  expect(inner(control, '.zone').hidden).toEqual(true)
  expect(inner(control, '.editor').hidden).toEqual(false)
  const frame = inner(control, '.frame')
  expect(frame.getAttribute('role')).toEqual('application')
  expect(frame.getAttribute('aria-label')).toContain('arrow keys')
  expect(frame.style.getPropertyValue('--frame-ratio')).toEqual('1')
  expect(control.shadowRoot.activeElement).toEqual(frame)
  const picture = inner(control, '.picture')
  const pictureSize = picture.style.getPropertyValue('inline-size')
  expect(pictureSize.endsWith('%')).toEqual(true)
  expect(Math.abs(Number.parseFloat(pictureSize) - (1920 / 1080) * 100) < 0.001).toEqual(true)
  expect(picture.style.getPropertyValue('transform')).toEqual(
    `translate(${-(420 / 1920) * 100}%, 0%)`,
  )
  const zoom = inner(control, '#zoom')
  expect(zoom.type).toEqual('range')
  expect(inner(control, 'label[for="zoom"]').textContent).toEqual('Zoom')
  expect([zoom.min, zoom.max, zoom.value]).toEqual(['1', '4', '1'])
})

test('Done crops the centre of a wide picture to a square and resizes it', async () => {
  const handed = []
  const { control, values } = inForm(
    { avatar: undefined },
    imageUpload({
      field: 'avatar',
      label: 'Avatar',
      shape: 'circle',
      maxWidth: 256,
      maxHeight: 256,
      onImage: (file) => handed.push(file),
    }),
  )
  await pick(control, fileOf('photo.jpg', 'image/jpeg'))
  expect(inner(control, '.frame').classList.contains('circle')).toEqual(true)
  click(actionButton(control, 'Done'))
  await settle()
  expect(lastDraw()).toEqual({ x: 420, y: 0, width: 1080, height: 1080, out: [256, 256] })
  expect(values.get().avatar.startsWith('data:image/jpeg;base64,')).toEqual(true)
  expect(handed.length).toEqual(1)
  expect([handed[0].name, handed[0].type]).toEqual(['photo.jpg', 'image/jpeg'])
  expect(inner(control, '.editor').hidden).toEqual(true)
  expect(inner(control, '.result').hidden).toEqual(false)
  const preview = inner(control, '.preview')
  expect(preview.getAttribute('src')).toEqual(values.get().avatar)
  expect(preview.classList.contains('circle')).toEqual(true)
  expect(preview.alt).toEqual('The chosen image')
  expect(actionHost(control, 'Adjust').hidden).toEqual(false)
})

test('the arrow keys and the zoom move the frame within the picture', async () => {
  const control = mounted(imageUpload({ value: undefined, label: 'Cover', aspect: 1 }))
  await pick(control, fileOf('photo.jpg', 'image/jpeg'))
  const frame = inner(control, '.frame')
  const left = press(frame, 'ArrowLeft')
  expect(left).toEqual(false)
  click(actionButton(control, 'Done'))
  await settle()
  expect(lastDraw().x).toEqual(420 - 54)
})

test('the frame stops at the edge of the picture', async () => {
  const control = mounted(imageUpload({ value: undefined, label: 'Cover', aspect: 1 }))
  await pick(control, fileOf('photo.jpg', 'image/jpeg'))
  const frame = inner(control, '.frame')
  for (let step = 0; step < 20; step++) press(frame, 'ArrowRight')
  press(frame, 'ArrowUp')
  click(actionButton(control, 'Done'))
  await settle()
  expect(lastDraw()).toEqual({ x: 840, y: 0, width: 1080, height: 1080, out: [1080, 1080] })
})

test('zoom shrinks the crop and the output does not upscale', async () => {
  const control = mounted(
    imageUpload({ value: undefined, label: 'Cover', aspect: 1, maxWidth: 2000, maxHeight: 2000 }),
  )
  await pick(control, fileOf('photo.jpg', 'image/jpeg'))
  const zoom = inner(control, '#zoom')
  zoom.value = '2'
  zoom.dispatchEvent(new Event('input', { bubbles: true }))
  const frame = inner(control, '.frame')
  press(frame, '+')
  expect(zoom.value).toEqual('2.25')
  click(actionButton(control, 'Done'))
  await settle()
  expect(lastDraw()).toEqual({ x: 720, y: 300, width: 480, height: 480, out: [480, 480] })
})

test('without aspect the frame takes the ratio of the picture', async () => {
  decoded = { width: 800, height: 1000 }
  const control = mounted(imageUpload({ value: undefined, label: 'Photo', maxHeight: 500 }))
  await pick(control, fileOf('tall.png', 'image/png'))
  expect(inner(control, '.frame').style.getPropertyValue('--frame-ratio')).toEqual('0.8')
  click(actionButton(control, 'Done'))
  await settle()
  expect(lastDraw()).toEqual({ x: 0, y: 0, width: 800, height: 1000, out: [400, 500] })
})

test('a PNG source stays a PNG and the output name follows the type', async () => {
  const handed = []
  const control = mounted(
    imageUpload({ value: undefined, label: 'Photo', onImage: (file) => handed.push(file) }),
  )
  await pick(control, fileOf('shot.PNG', 'image/png'))
  click(actionButton(control, 'Done'))
  await settle()
  expect([handed[0].name, handed[0].type]).toEqual(['shot.png', 'image/png'])
  document.body.replaceChildren()
  const other = mounted(
    imageUpload({ value: undefined, label: 'Photo', onImage: (file) => handed.push(file) }),
  )
  await pick(other, fileOf('IMG_0001.heic', 'image/heic'))
  click(actionButton(other, 'Done'))
  await settle()
  expect([handed[1].name, handed[1].type]).toEqual(['IMG_0001.jpg', 'image/jpeg'])
})

test('Cancel closes the editor and writes nothing', async () => {
  const { control, values } = inForm(
    { avatar: undefined },
    imageUpload({ field: 'avatar', label: 'Avatar' }),
  )
  await pick(control, fileOf('photo.jpg', 'image/jpeg'))
  click(actionButton(control, 'Cancel'))
  expect(values.get().avatar).toEqual(undefined)
  expect(inner(control, '.editor').hidden).toEqual(true)
  expect(inner(control, '.zone').hidden).toEqual(false)
  expect(inner(control, '.picture').hasAttribute('src')).toEqual(false)
  expect(control.shadowRoot.activeElement).toEqual(inner(control, '#control'))
})

test('Adjust reopens the editor with the same crop, and Remove clears the value', async () => {
  const handed = []
  const { control, values } = inForm(
    { avatar: undefined },
    imageUpload({
      field: 'avatar',
      label: 'Avatar',
      aspect: 1,
      onImage: (file) => handed.push(file),
    }),
  )
  await pick(control, fileOf('photo.jpg', 'image/jpeg'))
  const frame = inner(control, '.frame')
  press(frame, 'ArrowRight')
  press(frame, '+')
  click(actionButton(control, 'Done'))
  await settle()
  const first = lastDraw()
  click(actionButton(control, 'Adjust'))
  await settle()
  expect(inner(control, '.editor').hidden).toEqual(false)
  expect(inner(control, '#zoom').value).toEqual('1.25')
  click(actionButton(control, 'Done'))
  await settle()
  expect(lastDraw()).toEqual(first)
  click(actionButton(control, 'Remove'))
  expect(values.get().avatar).toEqual(undefined)
  expect(handed.map((file) => file && file.name)).toEqual(['photo.jpg', null])
  expect(inner(control, '.zone').hidden).toEqual(false)
  expect(inner(control, '.preview').hasAttribute('src')).toEqual(false)
})

test('a stored URL shows the preview with no Adjust and no onImage call', () => {
  const handed = []
  const control = mounted(
    imageUpload({
      value: '/pictures/42.png',
      label: 'Photo',
      onImage: (file) => handed.push(file),
    }),
  )
  expect(inner(control, '.result').hidden).toEqual(false)
  expect(inner(control, '.preview').getAttribute('src')).toEqual('/pictures/42.png')
  expect(actionHost(control, 'Adjust').hidden).toEqual(true)
  expect(handed).toEqual([])
})

test('a file outside accept, above maxSize, or one that cannot be decoded is refused', async () => {
  const { control, values } = inForm(
    { avatar: undefined },
    imageUpload({
      field: 'avatar',
      label: 'Avatar',
      accept: 'image/png,image/jpeg',
      maxSize: 1000,
    }),
  )
  await pick(control, fileOf('notes.txt', 'text/plain'))
  expect(inner(control, '.error').textContent).toEqual('notes.txt is not an accepted image type')
  expect(inner(control, '#control').getAttribute('aria-invalid')).toEqual('true')
  await pick(control, fileOf('big.png', 'image/png', 2000))
  expect(inner(control, '.error').textContent).toEqual('big.png is larger than 1 kB')
  failDecode = true
  const warn = warnings()
  await pick(control, fileOf('broken.png', 'image/png'))
  expect(inner(control, '.error').textContent).toEqual('broken.png could not be read as an image')
  expect(warned(warn, "'broken.png' could not be decoded")).toBeTruthy()
  expect(inner(control, '.editor').hidden).toEqual(true)
  expect(values.get().avatar).toEqual(undefined)
  failDecode = false
  await pick(control, fileOf('fine.png', 'image/png'))
  expect(inner(control, '.error').textContent).toEqual('')
})

test('a HEIC photo with no type is taken by its extension, and becomes a JPEG', async () => {
  const handed = []
  const control = mounted(
    imageUpload({ value: undefined, label: 'Photo', onImage: (file) => handed.push(file) }),
  )
  await pick(control, fileOf('IMG_0002.HEIF', ''))
  expect(inner(control, '.error').textContent).toEqual('')
  expect(inner(control, '.editor').hidden).toEqual(false)
  click(actionButton(control, 'Done'))
  await settle()
  expect([handed[0].name, handed[0].type]).toEqual(['IMG_0002.jpg', 'image/jpeg'])
})

test('a HEIC photo that the browser cannot decode gets a message that names HEIC', async () => {
  const { control, values } = inForm(
    { avatar: undefined },
    imageUpload({ field: 'avatar', label: 'Avatar' }),
  )
  failDecode = true
  const warn = warnings()
  await pick(control, fileOf('IMG_0001.HEIC', ''))
  expect(inner(control, '.error').textContent).toEqual(
    'This browser cannot open the HEIC photo IMG_0001.HEIC. Save it as a JPEG and pick it again.',
  )
  expect(warned(warn, "'IMG_0001.HEIC' could not be decoded")).toBeTruthy()
  expect(inner(control, '.editor').hidden).toEqual(true)
  expect(values.get().avatar).toEqual(undefined)
  await pick(control, fileOf('photo.heic', 'image/heic'))
  expect(inner(control, '.error').textContent).toEqual(
    'This browser cannot open the HEIC photo photo.heic. Save it as a JPEG and pick it again.',
  )
})

test('an accept list without HEIC refuses a HEIC photo before the decode', async () => {
  const control = mounted(
    imageUpload({ value: undefined, label: 'Photo', accept: 'image/png,image/jpeg' }),
  )
  await pick(control, fileOf('IMG_0003.heic', ''))
  expect(inner(control, '.error').textContent).toEqual(
    'IMG_0003.heic is not an accepted image type',
  )
})

test('a drop on the zone takes the first file', async () => {
  const control = mounted(imageUpload({ value: undefined, label: 'Photo' }))
  const zone = inner(control, '.zone')
  const over = new Event('dragover', { bubbles: true, cancelable: true })
  zone.dispatchEvent(over)
  expect(over.defaultPrevented).toEqual(true)
  expect(zone.classList.contains('over')).toEqual(true)
  const drop = new Event('drop', { bubbles: true, cancelable: true })
  Object.defineProperty(drop, 'dataTransfer', {
    value: { files: [fileOf('a.jpg', 'image/jpeg'), fileOf('b.jpg', 'image/jpeg')] },
  })
  zone.dispatchEvent(drop)
  await settle()
  expect(zone.classList.contains('over')).toEqual(false)
  expect(inner(control, '.editor').hidden).toEqual(false)
  expect(inner(control, '.picture').getAttribute('src').startsWith('blob:')).toEqual(true)
})

test('required reports a missing picture on submit', () => {
  const { host, control } = inForm(
    { avatar: undefined },
    imageUpload({ field: 'avatar', label: 'Avatar', required: true }),
    button({ variant: 'primary', events: { click: submitForm } }, 'Save'),
  )
  click(formButton(host))
  expect(inner(control, '.error').textContent).toEqual('This field is required')
  expect(inner(control, '#control').getAttribute('aria-required')).toEqual('true')
})

test('a form reset clears the preview and tells onImage', async () => {
  const handed = []
  const { host, control, values } = inForm(
    { avatar: undefined },
    imageUpload({ field: 'avatar', label: 'Avatar', onImage: (file) => handed.push(file) }),
    button({ events: { click: resetForm } }, 'Reset'),
  )
  await pick(control, fileOf('photo.jpg', 'image/jpeg'))
  click(actionButton(control, 'Done'))
  await settle()
  expect(values.get().avatar.startsWith('data:')).toEqual(true)
  click(formButton(host))
  expect(values.get().avatar).toEqual(undefined)
  expect(inner(control, '.result').hidden).toEqual(true)
  expect(handed.map((file) => file && file.name)).toEqual(['photo.jpg', null])
})

test('a bound state works without a form', async () => {
  let picture
  const holder = component('image-holder', {
    setup: (self) => {
      picture = initState(self, 'demo.picture', undefined)
      return imageUpload({ value: picture, label: 'Photo' })
    },
  })
  const control = inner(mounted(holder()), 'imp-image-upload')
  await pick(control, fileOf('photo.jpg', 'image/jpeg'))
  click(actionButton(control, 'Done'))
  await settle()
  expect(picture.get().startsWith('data:image/jpeg')).toEqual(true)
  picture.set('/stored.png')
  expect(inner(control, '.preview').getAttribute('src')).toEqual('/stored.png')
  expect(actionHost(control, 'Adjust').hidden).toEqual(true)
})

test('a rejected onImage promise is logged', async () => {
  const errors = spy(console, 'error', () => {})
  const control = mounted(
    imageUpload({
      value: undefined,
      ariaLabel: 'Photo',
      onImage: () => Promise.reject(new Error('offline')),
    }),
  )
  await pick(control, fileOf('photo.jpg', 'image/jpeg'))
  click(actionButton(control, 'Done'))
  await settle()
  await settle()
  expect(errors.calls.some(([first]) => String(first).includes("'onImage' failed"))).toBeTruthy()
})

test('disabled blocks the input, the drop, the frame and the buttons', async () => {
  let blocked
  const holder = component('image-disabled-holder', {
    setup: (self) => {
      blocked = initState(self, 'demo.blocked', true)
      return imageUpload({ value: '/stored.png', label: 'Photo', disabled: blocked })
    },
  })
  const control = inner(mounted(holder()), 'imp-image-upload')
  expect(inner(control, '#control').disabled).toEqual(true)
  expect(inner(control, '.frame').tabIndex).toEqual(-1)
  expect(buttonOf(control, 0).disabled).toEqual(true)
  await pick(control, fileOf('photo.jpg', 'image/jpeg'))
  expect(inner(control, '.editor').hidden).toEqual(true)
  blocked.set(false)
  expect(buttonOf(control, 0).disabled).toEqual(false)
  expect(inner(control, '.frame').tabIndex).toEqual(0)
})

test('bad props are logged', () => {
  const warn = warnings()
  mounted(
    imageUpload({
      value: undefined,
      shape: 'circle',
      aspect: 2,
      maxWidth: 0,
      maxHeight: 'big',
      maxSize: -1,
      accept: ['.png'],
      onImage: 'save',
      multiple: true,
    }),
  )
  expect(warned(warn, "a 'circle' is always 1:1")).toBeTruthy()
  expect(warned(warn, "'maxWidth' must be a number above 0")).toBeTruthy()
  expect(warned(warn, "'maxHeight' must be a number above 0")).toBeTruthy()
  expect(warned(warn, "'maxSize' must be a number above 0")).toBeTruthy()
  expect(warned(warn, "'accept' must be a string")).toBeTruthy()
  expect(warned(warn, "'onImage' must be a function")).toBeTruthy()
  expect(warned(warn, "unknown prop 'multiple'")).toBeTruthy()
})

test('embedImage closes the decoded bitmap when the encoding fails', async () => {
  const bitmap = { width: 40, height: 20, closed: false, close: () => (bitmap.closed = true) }
  const { createImageBitmap, OffscreenCanvas } = globalThis
  globalThis.createImageBitmap = () => Promise.resolve(bitmap)
  globalThis.OffscreenCanvas = class {
    constructor() {
      throw new Error('no canvas')
    }
  }
  try {
    let failed = null
    await embedImage(fileOf('shot.png', 'image/png'), 100).catch((error) => (failed = error))
    expect(failed?.message).toEqual('no canvas')
    expect(bitmap.closed).toEqual(true)
  } finally {
    Object.assign(globalThis, { createImageBitmap, OffscreenCanvas })
  }
})
