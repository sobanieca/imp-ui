import { defineComponent } from '../shared/define.js'
import { isRightToLeft } from '../shared/roving.js'
import { div } from '../../api/html.js'
import { defaultMessages, lang, t } from '../../api/i18n.js'
import { impLogger } from '../../logger.js'
import { isStateShaped } from '../../render.js'
import { bindValue, oneOf } from '../shared/args.js'
import { focusRing, token } from '../shared/css.js'
import { ownEvents } from '../shared/own-events.js'

const NAME = 'splitPane'

const KNOWN_PROPS = ['orientation', 'size', 'min', 'max', 'label', 'events']

const ORIENTATIONS = ['horizontal', 'vertical']

const RESIZE_EVENT = 'resize'

const RESIZE_KEY = 'imp.splitPane.resize'

const KEY_STEP = 5

const PAGE_STEP = 25

const DEFAULTS = { size: 50, min: 10, max: 90 }

const START_PANE_ID = 'start-pane'

const DRAG_END_EVENTS = ['pointerup', 'pointercancel', 'lostpointercapture']

const HIT_SIZE = '24px'

const messages = {
  [RESIZE_KEY]: 'Resize the panes',
}

const styles = () => `
  :host {
    display: block;
    block-size: 100%;
    min-inline-size: 0;
  }

  .root {
    display: grid;
    box-sizing: border-box;
    inline-size: 100%;
    block-size: 100%;
    min-inline-size: 0;
    min-block-size: 0;
  }

  .horizontal {
    grid-template-columns: minmax(0, var(--split-start)) auto minmax(0, var(--split-end));
    grid-template-rows: minmax(0, 1fr);
  }

  .vertical {
    grid-template-rows: minmax(0, var(--split-start)) auto minmax(0, var(--split-end));
    grid-template-columns: minmax(0, 1fr);
  }

  .pane {
    min-inline-size: 0;
    min-block-size: 0;
    overflow: auto;
  }

  .handle {
    position: relative;
    z-index: 1;
    display: flex;
    align-items: center;
    justify-content: center;
    box-sizing: border-box;
    touch-action: none;
    outline: none;
    background: transparent;
  }

  .handle::before {
    content: '';
    position: absolute;
  }

  .horizontal > .handle {
    inline-size: ${token('space-2')};
    cursor: col-resize;
  }

  .horizontal > .handle::before {
    inset-block: 0;
    inset-inline: calc(50% - ${HIT_SIZE} / 2);
  }

  .vertical > .handle {
    block-size: ${token('space-2')};
    cursor: row-resize;
  }

  .vertical > .handle::before {
    inset-inline: 0;
    inset-block: calc(50% - ${HIT_SIZE} / 2);
  }

  .line {
    background-color: ${token('color-border')};
    transition: background-color ${token('duration-fast')} ease;
  }

  .horizontal .line {
    inline-size: ${token('border-width')};
    block-size: 100%;
  }

  .vertical .line {
    inline-size: 100%;
    block-size: ${token('border-width')};
  }

  .handle:hover .line,
  .dragging .line {
    background-color: ${token('color-primary')};
  }

  .handle:focus-visible {
    ${focusRing()}
    outline-offset: 0;
  }

  .handle:focus-visible .line {
    background-color: ${token('color-primary')};
  }

  .dragging {
    user-select: none;
  }

  @media (prefers-reduced-motion: reduce) {
    .line { transition: none }
  }

  @media (forced-colors: active) {
    .line { background-color: CanvasText }
    .handle:hover .line,
    .handle:focus-visible .line,
    .dragging .line { background-color: Highlight }
  }
`

const percentOf = (prop, value, fallback) => {
  if (value === undefined || value === null) return fallback
  if (typeof value === 'number' && Number.isFinite(value) && value >= 0 && value <= 100) {
    return value
  }
  impLogger.warn(
    `${NAME}: '${prop}' must be a percent from 0 to 100 - got '${value}', using ${fallback}`,
  )
  return fallback
}

const rangeOf = (props) => {
  const min = percentOf('min', props.min, DEFAULTS.min)
  const max = percentOf('max', props.max, DEFAULTS.max)
  if (min <= max) return { min, max }
  impLogger.warn(`${NAME}: 'min' ${min} is above 'max' ${max} - using ${max} for both`)
  return { min: max, max }
}

const keyDelta = (key, vertical, rightToLeft) => {
  if (vertical) {
    if (key === 'ArrowUp') return -KEY_STEP
    if (key === 'ArrowDown') return KEY_STEP
    return null
  }
  if (key === 'ArrowLeft') return rightToLeft ? KEY_STEP : -KEY_STEP
  if (key === 'ArrowRight') return rightToLeft ? -KEY_STEP : KEY_STEP
  return null
}

const pointerPercent = (event, box, vertical, rightToLeft) => {
  if (vertical) return ((event.clientY - box.top) / box.height) * 100
  const offset = rightToLeft ? box.right - event.clientX : event.clientX - box.left
  return (offset / box.width) * 100
}

const panesOf = (children) => {
  if (children.length !== 2) {
    impLogger.warn(
      `${NAME}: takes exactly two children, the start pane and the end pane - got ${children.length}; nest a splitPane for a third pane`,
    )
  }
  return [children[0] ?? null, children.slice(1)]
}

const definition = {
  styles,
  props: KNOWN_PROPS,
  setup: (self, props, children) => {
    const orientation = oneOf(NAME, 'orientation', props.orientation, ORIENTATIONS, 'horizontal')
    const vertical = orientation === 'vertical'
    const { min, max } = rangeOf(props)
    const state = isStateShaped(props.size) ? props.size : null
    const clamp = (value) => Math.round(Math.min(max, Math.max(min, value)) * 10) / 10
    let size = clamp(DEFAULTS.size)

    const [startContent, endContent] = panesOf(children)
    const startPane = div({ class: 'pane', id: START_PANE_ID }, startContent)
    const endPane = div({ class: 'pane' }, ...endContent)
    const handle = div({
      class: 'handle',
      role: 'separator',
      tabindex: '0',
      'aria-orientation': vertical ? 'horizontal' : 'vertical',
      'aria-controls': START_PANE_ID,
      'aria-valuemin': String(min),
      'aria-valuemax': String(max),
    }, div({ class: 'line' }))

    const root = div(
      {
        class: ['root', orientation],
        events: ownEvents(props.events, [RESIZE_EVENT]),
      },
      startPane,
      handle,
      endPane,
    )

    const paint = () => {
      root.style.setProperty('--split-start', `${size}fr`)
      root.style.setProperty('--split-end', `${100 - size}fr`)
      handle.setAttribute('aria-valuenow', String(size))
    }

    const change = (next, { notify }) => {
      const value = clamp(next)
      if (value === size) return
      size = value
      paint()
      if (!notify) return
      if (state) {
        if (typeof state.set === 'function') state.set(size)
        else {
          impLogger.warn(
            `${NAME}: 'size' is a read-only state - pass a writable state so ${NAME} can write it back`,
          )
        }
      }
      root.dispatchEvent(
        new CustomEvent(RESIZE_EVENT, { bubbles: true, composed: true, detail: { size } }),
      )
    }

    const follow = (value) => {
      if (value === undefined || value === null) return
      change(percentOf('size', value, size), { notify: false })
    }
    bindValue(self, props.size, follow)

    if (props.label === undefined) {
      const nameFromMessages = () => handle.setAttribute('aria-label', t(RESIZE_KEY))
      nameFromMessages()
      lang.watch(self, nameFromMessages)
    } else {
      bindValue(self, props.label, (value) => handle.setAttribute('aria-label', String(value)))
    }

    handle.addEventListener('keydown', (event) => {
      if (event.altKey || event.ctrlKey || event.metaKey) return
      const delta = keyDelta(event.key, vertical, isRightToLeft(root))
      let next = null
      if (delta !== null) next = size + delta
      else if (event.key === 'PageUp') next = size - PAGE_STEP
      else if (event.key === 'PageDown') next = size + PAGE_STEP
      else if (event.key === 'Home') next = min
      else if (event.key === 'End') next = max
      if (next === null) return
      event.preventDefault()
      change(next, { notify: true })
    })

    let drag = null

    handle.addEventListener('pointerdown', (event) => {
      if (event.button !== 0) return
      if (drag !== null) {
        if (handle.hasPointerCapture(drag.pointerId)) return
        drag.end()
      }
      event.preventDefault()
      handle.focus()
      handle.setPointerCapture(event.pointerId)
      const { pointerId } = event
      const box = root.getBoundingClientRect()
      const rightToLeft = isRightToLeft(root)
      const grab = pointerPercent(event, box, vertical, rightToLeft) - size
      const move = (moveEvent) => {
        if (moveEvent.pointerId !== pointerId) return
        change(pointerPercent(moveEvent, box, vertical, rightToLeft) - grab, { notify: true })
      }
      const stop = (endEvent) => {
        if (endEvent.pointerId === pointerId) drag?.end()
      }
      const end = () => {
        drag = null
        root.classList.remove('dragging')
        handle.removeEventListener('pointermove', move)
        for (const type of DRAG_END_EVENTS) handle.removeEventListener(type, stop)
      }
      drag = { pointerId, end }
      root.classList.add('dragging')
      handle.addEventListener('pointermove', move)
      for (const type of DRAG_END_EVENTS) handle.addEventListener(type, stop)
    })

    paint()
    return root
  },
}

export const splitPane = (...args) =>
  defineComponent(NAME, () => definition, () => defaultMessages(messages))(...args)
