import { defineComponent } from '../shared/define.js'
import { div, el, p, span } from '../../api/html.js'
import { defaultMessages, lang, t } from '../../api/i18n.js'
import { impLogger } from '../../logger.js'
import { createState } from '../../state.js'
import { bindValue, oneOf, stopOnRemove } from '../shared/args.js'
import { button } from '../general/button.js'
import { icon } from '../general/icon.js'
import { luImagePlus } from '../../icons/lucide-icons.js'
import { createFieldBinding } from './field.js'
import { acceptsFile, formatFileSize, readAccept } from './file-rules.js'
import { FORM_MESSAGES } from './form-state.js'
import {
  asDataUrl,
  decodeImage,
  encodeImage,
  fitWithin,
  IMAGE_ACCEPT,
  isHeifFile,
  outputNameOf,
  outputTypeOf,
} from './image-tools.js'
import { BINDING_PROPS, CONTROL_ID, createShell, SHELL_PROPS, shellStyles } from './shell.js'
import { focusRing, fontFamily, forcedColors, token, visuallyHidden } from '../shared/css.js'
import { spinnerNode, spinnerStyles } from '../shared/spinner.js'
import { translatedLabel } from '../shared/translated-label.js'

const NAME = 'imageUpload'

const KNOWN_PROPS = [
  ...BINDING_PROPS,
  ...SHELL_PROPS,
  'shape',
  'aspect',
  'maxWidth',
  'maxHeight',
  'maxSize',
  'accept',
  'compact',
  'onImage',
  'validate',
  'validateAsync',
]

const SHAPES = ['rectangle', 'circle']

const DEFAULT_MAX_EDGE = 1920

const COMPACT_BOX = '6rem'

const WIDE_BOX = '24rem'

const ROUND_BOX = '12rem'

const WIDE_RATIO = 16 / 9

const MAX_ZOOM = 4

const ZOOM_STEP = 0.25

const KEY_PAN_FRACTION = 0.05

const HINT_ID = 'hint'

const ZOOM_ID = 'zoom'

const REQUIRED_KEY = 'imp.form.required'

const keyOf = (name) => `imp.${NAME}.${name}`

const messages = {
  [keyOf('prompt')]: 'Drop an image here, or browse',
  [keyOf('maxSize')]: 'Up to {size}',
  [keyOf('tooLarge')]: '{name} is larger than {size}',
  [keyOf('wrongType')]: '{name} is not an accepted image type',
  [keyOf('unreadable')]: '{name} could not be read as an image',
  [keyOf('heifUnreadable')]:
    'This browser cannot open the HEIC photo {name}. Save it as a JPEG and pick it again.',
  [keyOf('preparing')]: 'Preparing the image...',
  [keyOf('frame')]:
    'Picture position. Use the arrow keys to move the frame over the picture, and plus or minus to zoom.',
  [keyOf('zoom')]: 'Zoom',
  [keyOf('done')]: 'Done',
  [keyOf('cancel')]: 'Cancel',
  [keyOf('change')]: 'Change',
  [keyOf('adjust')]: 'Adjust',
  [keyOf('remove')]: 'Remove',
  [keyOf('preview')]: 'The chosen image',
}

const styles = () => `
  ${shellStyles()}
  ${spinnerStyles()}

  .upload {
    position: relative;
    display: flex;
    flex-direction: column;
    gap: ${token('space-2')};
    min-inline-size: 0;
    ${fontFamily()}
  }

  #${CONTROL_ID} {
    ${visuallyHidden}
  }

  .zone,
  .result {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: ${token('space-3')};
    min-inline-size: 0;
  }

  .zone {
    position: relative;
    color: ${token('color-secondary')};
  }

  .slot {
    display: flex;
    flex: none;
    align-items: center;
    justify-content: center;
    box-sizing: border-box;
    inline-size: 100%;
    max-inline-size: ${WIDE_BOX};
    aspect-ratio: var(--preview-ratio, 1);
    overflow: hidden;
    border-radius: ${token('radius-item')};
  }

  .slot.circle {
    max-inline-size: ${ROUND_BOX};
    border-radius: 50%;
  }

  .compact .slot {
    inline-size: ${COMPACT_BOX};
  }

  .placeholder {
    flex-direction: column;
    gap: ${token('space-2')};
    padding: ${token('space-4')};
    border: ${token('border-width')} dashed ${token('color-border')};
    background-color: ${token('color-surface')};
    color: ${token('color-secondary')};
    text-align: center;
    transition:
      background-color ${token('duration-fast')} ease-out,
      border-color ${token('duration-fast')} ease-out;
  }

  .compact .placeholder {
    padding: 0;
  }

  .compact .zone .words {
    text-align: start;
  }

  .zone:hover .placeholder,
  .zone.over .placeholder {
    border-color: ${token('color-primary')};
    background-color: ${token('color-surface-hover')};
  }

  .zone.over .placeholder {
    border-style: solid;
  }

  #${CONTROL_ID}:focus-visible + .zone .placeholder {${focusRing()}}

  #${CONTROL_ID}[aria-invalid='true'] + .zone .placeholder {
    border-color: ${token('color-danger')};
  }

  #${CONTROL_ID}:disabled + .zone {
    opacity: ${token('disabled-opacity')};
  }

  #${CONTROL_ID}:disabled + .zone .placeholder {
    border-color: ${token('color-border')};
    background-color: ${token('color-surface')};
  }

  .words {
    display: flex;
    flex-direction: column;
    gap: ${token('space-1')};
    min-inline-size: 0;
  }

  .compact .words {
    flex: 1 1 8rem;
  }

  .prompt {
    color: ${token('color-text')};
    font-size: ${token('font-size-md')};
    font-weight: ${token('font-weight-bold')};
    line-height: ${token('line-height-tight')};
    cursor: pointer;
  }

  .prompt::after {
    content: '';
    position: absolute;
    inset: 0;
    cursor: pointer;
  }

  #${CONTROL_ID}:disabled + .zone .prompt,
  #${CONTROL_ID}:disabled + .zone .prompt::after {
    cursor: not-allowed;
  }

  .hint {
    margin: 0;
    font-size: ${token('font-size-sm')};
    line-height: ${token('line-height-normal')};
  }

  .editor {
    display: flex;
    flex-direction: column;
    gap: ${token('space-2')};
    max-inline-size: 24rem;
  }

  .frame {
    position: relative;
    box-sizing: border-box;
    inline-size: 100%;
    aspect-ratio: var(--frame-ratio, 1);
    overflow: hidden;
    border: ${token('border-width')} solid ${token('color-border')};
    border-radius: ${token('radius-item')};
    background-color: ${token('color-surface-sunken')};
    direction: ltr;
    touch-action: none;
    user-select: none;
    cursor: grab;
  }

  .frame:focus-visible {${focusRing()}}

  .frame.dragging {
    cursor: grabbing;
  }

  .picture {
    display: block;
    position: absolute;
    inset-block-start: 0;
    inset-inline-start: 0;
    max-inline-size: none;
    block-size: auto;
    transform-origin: 0 0;
    pointer-events: none;
    user-select: none;
  }

  .frame.circle::after {
    content: '';
    position: absolute;
    inset: 0;
    border: ${token('border-width')} solid ${token('color-surface')};
    border-radius: 50%;
    box-shadow: 0 0 0 200rem color-mix(in oklab, ${token('color-text')} 55%, transparent);
    pointer-events: none;
  }

  .tools {
    display: flex;
    flex-direction: column;
    gap: ${token('space-2')};
  }

  .zoom {
    display: flex;
    align-items: center;
    gap: ${token('space-2')};
    min-inline-size: 0;
    color: ${token('color-secondary')};
    font-size: ${token('font-size-sm')};
    line-height: ${token('line-height-tight')};
  }

  .zoom input {
    flex: 1 1 auto;
    min-inline-size: 0;
    block-size: 1.5rem;
    margin: 0;
    background-color: transparent;
    accent-color: ${token('color-primary')};
    cursor: pointer;
  }

  .zoom input:focus-visible {
    ${focusRing()}
    border-radius: ${token('radius-item')};
  }

  .actions {
    display: flex;
    flex-wrap: wrap;
    gap: ${token('space-2')};
  }

  .compact .result .actions {
    flex-direction: column;
    align-items: flex-start;
  }

  .preview {
    display: block;
    max-inline-size: 100%;
    max-block-size: 100%;
    border-radius: ${token('radius-item')};
  }

  .preview.circle {
    aspect-ratio: 1;
    border-radius: 50%;
    object-fit: cover;
  }

  .busy {
    display: flex;
    align-items: center;
    gap: ${token('space-2')};
    color: ${token('color-secondary')};
    font-size: ${token('font-size-sm')};
    line-height: ${token('line-height-tight')};
  }

  [hidden] {
    display: none;
  }

  @media (prefers-reduced-motion: reduce) {
    .placeholder { transition: none }
  }

  ${forcedColors}

  @media (forced-colors: active) {
    .zone.over .placeholder { border-color: Highlight }
    .frame:focus-visible { outline-color: Highlight }
  }
`

const clamp = (value, min, max) => Math.min(Math.max(value, min), max)

const visibleSize = (source, ratio, zoom) => {
  const wide = source.width / source.height >= ratio
  const height = wide ? source.height / zoom : source.width / ratio / zoom
  const width = wide ? height * ratio : source.width / zoom
  return { width, height }
}

const clampedCenter = (source, view, center) => ({
  x: clamp(center.x, view.width / 2 / source.width, 1 - view.width / 2 / source.width),
  y: clamp(center.y, view.height / 2 / source.height, 1 - view.height / 2 / source.height),
})

const regionOf = (source, ratio, zoom, center) => {
  const view = visibleSize(source, ratio, zoom)
  const middle = clampedCenter(source, view, center)
  return {
    x: middle.x * source.width - view.width / 2,
    y: middle.y * source.height - view.height / 2,
    width: view.width,
    height: view.height,
  }
}

const isSrc = (value) => typeof value === 'string' && value !== ''

const readPositive = (prop, value, fallback) => {
  if (value === undefined) return fallback
  if (Number.isFinite(value) && value > 0) return value
  impLogger.warn(`${NAME}: '${prop}' must be a number above 0 - ignoring it`)
  return fallback
}

const readAspect = (shape, aspect) => {
  if (shape === 'circle') {
    if (aspect !== undefined && aspect !== 1) {
      impLogger.warn(`${NAME}: a 'circle' is always 1:1 - ignoring 'aspect'`)
    }
    return 1
  }
  return readPositive('aspect', aspect, null)
}

const readOnImage = (onImage) => {
  if (onImage === undefined) return null
  if (typeof onImage === 'function') return onImage
  impLogger.warn(`${NAME}: 'onImage' must be a function that takes the File, or null`)
  return null
}

const readValidate = (validate) => {
  if (validate === undefined) return null
  if (typeof validate === 'function') return validate
  impLogger.warn(`${NAME}: 'validate' must be a function returning a message or null - ignoring it`)
  return null
}

const definition = {
  styles,
  props: KNOWN_PROPS,
  setup: (self, props, children) => {
    if (children.length > 0) {
      impLogger.warn(`${NAME}: takes no content - the component draws the drop zone itself`)
    }
    const shape = oneOf(NAME, 'shape', props.shape, SHAPES, 'rectangle')
    const aspect = readAspect(shape, props.aspect)
    const maxWidth = readPositive('maxWidth', props.maxWidth, DEFAULT_MAX_EDGE)
    const maxHeight = readPositive('maxHeight', props.maxHeight, DEFAULT_MAX_EDGE)
    const maxSize = readPositive('maxSize', props.maxSize, null)
    const accept = readAccept(NAME, props.accept ?? IMAGE_ACCEPT)
    const compact = Boolean(props.compact)
    const circle = shape === 'circle'
    const boxRatio = aspect ?? (circle || compact ? 1 : WIDE_RATIO)
    const onImage = readOnImage(props.onImage)
    const blocked = createState(keyOf('blocked'), false)

    let disabled = false
    let busy = false
    let rejection = null
    let editing = null
    let produced = null
    let kept = null
    let handed = null
    let current = null
    let run = 0

    const ownValidate = readValidate(props.validate)
    const binding = createFieldBinding(
      NAME,
      {
        ...props,
        required: undefined,
        validate: (value) => {
          if (rejection) return rejection
          if (props.required && !isSrc(value)) return { key: REQUIRED_KEY }
          return ownValidate ? ownValidate(value) : null
        },
      },
      { self },
    )

    const control = el('input', {
      id: CONTROL_ID,
      type: 'file',
      accept: accept.join(','),
      events: {
        change: () => {
          const [file] = control.files
          if (file) pick(file)
          control.value = ''
        },
        blur: () => {
          binding.leave()
          binding.check()
        },
      },
    })

    const hint = maxSize === null ? null : p({ class: 'hint', id: HINT_ID })
    const zoneParts = () => {
      const mark = icon(luImagePlus, { size: compact ? 'md' : 'lg' })
      const words = div(
        { class: 'words' },
        el(
          'label',
          { class: 'prompt', for: CONTROL_ID },
          lang.text(() => t(keyOf('prompt'))),
        ),
        hint,
      )
      if (compact) return [div({ class: { slot: true, placeholder: true, circle } }, mark), words]
      return [div({ class: { slot: true, placeholder: true, circle } }, mark, words)]
    }

    const zone = div(
      {
        class: 'zone',
        events: {
          dragover: (event) => {
            if (disabled || busy) return
            event.preventDefault()
            zone.classList.add('over')
          },
          dragleave: (event) => {
            if (!zone.contains(event.relatedTarget)) zone.classList.remove('over')
          },
          drop: (event) => {
            if (disabled || busy) return
            event.preventDefault()
            zone.classList.remove('over')
            const [file] = [...(event.dataTransfer?.files ?? [])]
            if (file) pick(file)
          },
        },
      },
      ...zoneParts(),
    )

    const picture = el('img', { class: 'picture', alt: '', draggable: 'false' })
    const frame = div({ class: { frame: true, circle }, tabindex: '0' }, picture)
    frame.setAttribute('role', 'application')
    bindValue(self, translatedLabel(self, keyOf('frame')), (text) => {
      frame.setAttribute('aria-label', text)
    })

    const zoomInput = el('input', {
      id: ZOOM_ID,
      type: 'range',
      min: '1',
      max: String(MAX_ZOOM),
      step: '0.01',
      events: {
        input: () => zoomTo(Number(zoomInput.value)),
      },
    })

    const action = (key, options, onClick) =>
      button(
        { ...options, disabled: blocked, events: { click: onClick } },
        lang.text(() => t(keyOf(key))),
      )

    const editor = div(
      { class: 'editor' },
      frame,
      div(
        { class: 'tools' },
        div(
          { class: 'zoom' },
          el(
            'label',
            { for: ZOOM_ID },
            lang.text(() => t(keyOf('zoom'))),
          ),
          zoomInput,
        ),
        div(
          { class: 'actions' },
          action('done', { variant: 'primary' }, () => finish()),
          action('cancel', {}, () => cancel()),
        ),
      ),
    )

    const preview = el('img', { class: { preview: true, circle } })
    const changeButton = action('change', {}, () => control.click())
    const adjustButton = action('adjust', {}, () => adjust())
    const result = div(
      { class: 'result' },
      div({ class: { slot: true, circle } }, preview),
      div(
        { class: 'actions' },
        changeButton,
        adjustButton,
        action('remove', { variant: 'ghost' }, () => remove()),
      ),
    )

    const focusRest = () => {
      if (current === null) control.focus()
      else changeButton.focus()
    }

    const busyText = lang.text(() => t(keyOf('preparing')))
    const busyNode = div({ class: 'busy', role: 'status' }, spinnerNode(), span(busyText))

    const paint = () => {
      hint?.replaceChildren(
        span(t(keyOf('maxSize'), { size: formatFileSize(maxSize, lang.get()) })),
      )
      const mode = editing ? 'editing' : current ? 'filled' : 'empty'
      zone.hidden = mode !== 'empty'
      editor.hidden = mode !== 'editing'
      result.hidden = mode !== 'filled'
      adjustButton.hidden = kept === null
      busyNode.hidden = !busy
      preview.alt = t(keyOf('preview'))
      blocked.set(disabled || busy)
    }

    const setBusy = (value) => {
      busy = value
      upload.setAttribute('aria-busy', busy ? 'true' : 'false')
      paint()
    }

    const problemWith = (file) => {
      if (!acceptsFile(accept, file)) {
        return { key: keyOf('wrongType'), params: { name: file.name } }
      }
      if (maxSize !== null && file.size > maxSize) {
        return {
          key: keyOf('tooLarge'),
          params: { name: file.name, size: formatFileSize(maxSize, lang.get()) },
        }
      }
      return null
    }

    const render = () => {
      if (!editing) return
      const { source, ratio, zoom } = editing
      editing.center = clampedCenter(source, visibleSize(source, ratio, zoom), editing.center)
      const region = regionOf(source, ratio, zoom, editing.center)
      picture.style.setProperty('inline-size', `${(source.width / region.width) * 100}%`)
      picture.style.setProperty(
        'transform',
        `translate(${-(region.x / source.width) * 100}%, ${-(region.y / source.height) * 100}%)`,
      )
      if (zoomInput.value !== String(zoom)) zoomInput.value = String(zoom)
    }

    const zoomTo = (zoom) => {
      if (!editing) return
      editing.zoom = clamp(zoom, 1, MAX_ZOOM)
      render()
    }

    const panBy = (dx, dy) => {
      if (!editing) return
      const { source, ratio, zoom, center } = editing
      const view = visibleSize(source, ratio, zoom)
      editing.center = {
        x: center.x - (dx * view.width) / source.width,
        y: center.y - (dy * view.height) / source.height,
      }
      render()
    }

    const closeEditor = () => {
      if (!editing) return
      URL.revokeObjectURL(editing.url)
      editing.source.close()
      picture.removeAttribute('src')
      editing = null
    }

    const openEditor = (file, source, view) => {
      closeEditor()
      const ratio = aspect ?? source.width / source.height
      editing = { file, source, url: URL.createObjectURL(file), ratio, ...view }
      frame.style.setProperty('--frame-ratio', String(ratio))
      picture.src = editing.url
      render()
      paint()
      frame.focus()
    }

    const decode = async (file) => {
      const token = ++run
      setBusy(true)
      try {
        const source = await decodeImage(file)
        if (token !== run || self.abortSignal.aborted) {
          source.close()
          return null
        }
        return source
      } catch (error) {
        if (token !== run) return null
        impLogger.warn(`${NAME}: '${file.name}' could not be decoded`, error)
        rejection = {
          key: keyOf(isHeifFile(file) ? 'heifUnreadable' : 'unreadable'),
          params: { name: file.name },
        }
        return null
      } finally {
        if (token === run) setBusy(false)
      }
    }

    const pick = async (file) => {
      if (disabled || busy) return
      rejection = problemWith(file)
      binding.touch()
      if (rejection) {
        binding.check()
        return
      }
      const source = await decode(file)
      binding.check()
      if (source === null) return
      openEditor(file, source, { zoom: 1, center: { x: 0.5, y: 0.5 } })
    }

    const finish = async () => {
      if (!editing || busy) return
      const { file, source, ratio, zoom, center } = editing
      const region = regionOf(source, ratio, zoom, center)
      const size = fitWithin(region.width, region.height, maxWidth, maxHeight)
      const type = outputTypeOf(file)
      const token = ++run
      setBusy(true)
      try {
        const blob = await encodeImage(source, region, size, type)
        const src = await asDataUrl(blob)
        if (token !== run || self.abortSignal.aborted) return
        produced = { src, file: new File([blob], outputNameOf(file.name, type), { type }) }
        kept = { file, view: { zoom, center } }
        closeEditor()
        rejection = null
        binding.touch()
        binding.commit(src)
        binding.check()
      } catch (error) {
        if (token !== run) return
        impLogger.error(`${NAME}: '${file.name}' could not be prepared`, error)
        rejection = { key: keyOf('unreadable'), params: { name: file.name } }
        closeEditor()
        binding.check()
      } finally {
        if (token === run) setBusy(false)
      }
      if (!editing) focusRest()
    }

    const cancel = () => {
      if (!editing || busy) return
      closeEditor()
      paint()
      focusRest()
    }

    const adjust = async () => {
      if (kept === null || busy) return
      const source = await decode(kept.file)
      if (source === null) {
        binding.check()
        return
      }
      openEditor(kept.file, source, kept.view)
    }

    const remove = () => {
      if (busy) return
      run += 1
      closeEditor()
      produced = null
      kept = null
      rejection = null
      binding.touch()
      binding.commit(undefined)
      binding.check()
      control.focus()
    }

    const handOver = () => {
      const file = produced?.file ?? null
      if (file === handed) return
      handed = file
      if (!onImage) return
      try {
        Promise.resolve(onImage(file)).catch((error) =>
          impLogger.error(`${NAME}: 'onImage' failed`, error),
        )
      } catch (error) {
        impLogger.error(`${NAME}: 'onImage' failed`, error)
      }
    }

    const listen = (type, handler, options) => {
      frame.addEventListener(type, handler, { ...options, signal: self.abortSignal })
    }

    let pointer = null

    listen('pointerdown', (event) => {
      if (event.button !== 0 || disabled || busy || !editing) return
      frame.setPointerCapture(event.pointerId)
      pointer = { id: event.pointerId, x: event.clientX, y: event.clientY }
      frame.classList.add('dragging')
    })
    listen('pointermove', (event) => {
      if (pointer === null || event.pointerId !== pointer.id || !editing) return
      const rect = frame.getBoundingClientRect()
      if (rect.width === 0 || rect.height === 0) return
      const dx = event.clientX - pointer.x
      const dy = event.clientY - pointer.y
      pointer = { ...pointer, x: event.clientX, y: event.clientY }
      panBy(dx / rect.width, dy / rect.height)
    })
    const endPointer = (event) => {
      if (pointer === null || event.pointerId !== pointer.id) return
      pointer = null
      frame.classList.remove('dragging')
    }
    listen('pointerup', endPointer)
    listen('pointercancel', endPointer)
    listen(
      'wheel',
      (event) => {
        if (!editing || disabled || busy) return
        event.preventDefault()
        const pixels = event.deltaMode === 0 ? event.deltaY : event.deltaY * 40
        const notches = clamp(-pixels / 100, -1, 1)
        zoomTo(editing.zoom + notches * ZOOM_STEP)
      },
      { passive: false },
    )
    listen('keydown', (event) => {
      if (event.target !== frame || !editing || disabled || busy) return
      const actions = {
        ArrowLeft: () => panBy(KEY_PAN_FRACTION, 0),
        ArrowRight: () => panBy(-KEY_PAN_FRACTION, 0),
        ArrowUp: () => panBy(0, KEY_PAN_FRACTION),
        ArrowDown: () => panBy(0, -KEY_PAN_FRACTION),
        '+': () => zoomTo(editing.zoom + ZOOM_STEP),
        '=': () => zoomTo(editing.zoom + ZOOM_STEP),
        '-': () => zoomTo(editing.zoom - ZOOM_STEP),
      }
      const act = actions[event.key]
      if (!act) return
      event.preventDefault()
      act()
    })

    bindValue(self, props.disabled, (value) => {
      disabled = Boolean(value)
      control.disabled = disabled
      zoomInput.disabled = disabled
      frame.tabIndex = disabled ? -1 : 0
      paint()
    })
    stopOnRemove(
      self,
      binding.watch((value) => {
        current = isSrc(value) ? value : null
        if (current === null || produced?.src !== current) {
          produced = null
          kept = null
        }
        if (current === null) preview.removeAttribute('src')
        else if (preview.getAttribute('src') !== current) preview.src = current
        paint()
        handOver()
      }),
    )
    stopOnRemove(
      self,
      binding.watchSubmits(() => {
        rejection = null
      }),
    )
    stopOnRemove(self, () => {
      run += 1
      closeEditor()
    })
    lang.watch(self, paint)

    const upload = div(
      { class: { upload: true, compact } },
      control,
      zone,
      editor,
      result,
      busyNode,
    )
    upload.style.setProperty('--preview-ratio', String(boxRatio))
    const shell = createShell(self, props, control, {
      presented: upload,
      describedBy: hint ? [HINT_ID] : [],
    })
    shell.attach(binding)
    return shell.root
  },
}

const registerMessages = () => {
  defaultMessages(FORM_MESSAGES)
  defaultMessages(messages)
}

export const imageUpload = (...args) =>
  defineComponent(NAME, () => definition, registerMessages)(...args)
