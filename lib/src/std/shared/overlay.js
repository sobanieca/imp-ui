import { impLogger } from '../../logger.js'
import { allowedBy } from '../../veto.js'
import { token } from './css.js'

const CLOSING = 'data-closing'

const SHOWN = ['[open]', ':popover-open']

const DRAG_STEP = 16

const ARROW_STEPS = {
  ArrowLeft: [-1, 0],
  ArrowRight: [1, 0],
  ArrowUp: [0, -1],
  ArrowDown: [0, 1],
}

const pageScroll = { holds: 0, restore: '' }

const holdPageScroll = () => {
  if (pageScroll.holds === 0) {
    pageScroll.restore = document.documentElement.style.overflow
    document.documentElement.style.overflow = 'hidden'
  }
  pageScroll.holds += 1
}

const dropPageScroll = () => {
  pageScroll.holds -= 1
  if (pageScroll.holds > 0) return
  document.documentElement.style.overflow = pageScroll.restore
}

const deepActiveElement = () => {
  let active = document.activeElement
  while (active?.shadowRoot?.activeElement) active = active.shadowRoot.activeElement
  return active
}

const settled = (element) =>
  Promise.all(element.getAnimations().map(({ finished }) => finished.catch(() => {})))

export const slideOut = async (element, hide) => {
  if (element.hasAttribute(CLOSING)) return
  element.setAttribute(CLOSING, '')
  await settled(element)
  if (!element.hasAttribute(CLOSING)) return
  element.removeAttribute(CLOSING)
  hide()
}

const shownSelectors = (selector, suffix = '') =>
  SHOWN.map((state) => `${selector}${state}${suffix}`).join(',\n    ')

export const overlayMotion = (selector) => `
  ${selector} {
    opacity: 1;
    translate: 0 0;
    transition:
      opacity ${token('duration-medium')} ease-out,
      translate ${token('duration-medium')} ease-out;
  }

  ${selector}::backdrop {
    opacity: 1;
    transition: opacity ${token('duration-medium')} ease-out;
  }

  @starting-style {
    ${shownSelectors(selector)} {
      opacity: 0;
      translate: var(--overlay-offset, 0 0);
    }

    ${shownSelectors(selector, '::backdrop')} { opacity: 0 }
  }

  ${selector}[${CLOSING}] {
    opacity: 0;
    translate: var(--overlay-offset, 0 0);
  }

  ${selector}[${CLOSING}]::backdrop { opacity: 0 }

  @media (prefers-reduced-motion: reduce) {
    ${selector},
    ${selector}::backdrop {
      transition: none;
    }
  }
`

export const overlayScrim = (selector) => `
  ${selector}::backdrop {
    background-color: rgb(0 0 0 / 45%);
  }
`

export const dismissal = (name, beforeClose) => {
  if (beforeClose !== undefined && typeof beforeClose !== 'function') {
    impLogger.warn(
      `${name}: 'beforeClose' must be a function like () => !dirty.get() - ignoring it`,
    )
  }
  const check = typeof beforeClose === 'function' ? beforeClose : null
  let asking = false
  return (proceed) => {
    if (!check) {
      proceed()
      return
    }
    if (asking) return
    asking = true
    allowedBy([check], `${name}: beforeClose`).then((allowed) => {
      asking = false
      if (allowed) proceed()
    })
  }
}

const closeAtOnce = (proceed) => proceed()

export const modalOverlay = (dialog, { signal, dismiss = closeAtOnce } = {}) => {
  let held = false
  let pressedBackdrop = false

  const release = () => {
    if (!held) return
    held = false
    dropPageScroll()
  }

  const open = () => {
    dialog.removeAttribute(CLOSING)
    if (dialog.open) return
    dialog.showModal()
    held = true
    holdPageScroll()
  }

  const close = (returnValue) =>
    dialog.open ? slideOut(dialog, () => dialog.close(returnValue)) : Promise.resolve()

  const requestClose = () => dismiss(close)

  dialog.addEventListener('close', () => {
    dialog.removeAttribute(CLOSING)
    release()
  }, { signal })

  dialog.addEventListener('keydown', (event) => {
    if (event.key !== 'Escape' || event.isComposing || event.defaultPrevented) return
    if (!dialog.open) return
    event.preventDefault()
    requestClose()
  }, { signal })

  dialog.addEventListener('cancel', (event) => {
    if (!event.cancelable) return
    event.preventDefault()
    requestClose()
  }, { signal })

  dialog.addEventListener('pointerdown', (event) => {
    pressedBackdrop = event.target === dialog
  }, { signal })

  dialog.addEventListener('click', (event) => {
    const dismissed = pressedBackdrop && event.target === dialog
    pressedBackdrop = false
    if (dismissed) requestClose()
  }, { signal })

  signal?.addEventListener('abort', release)

  return { open, close }
}

export const panelOverlay = (panel, { signal } = {}) => {
  let shown = false
  let invoker = null

  const open = () => {
    panel.removeAttribute(CLOSING)
    if (shown) return
    shown = true
    invoker = deepActiveElement()
    panel.showPopover()
    panel.focus({ preventScroll: true })
  }

  const close = () =>
    shown
      ? slideOut(panel, () => {
        shown = false
        panel.hidePopover()
        invoker?.focus()
        invoker = null
      })
      : Promise.resolve()

  signal?.addEventListener('abort', () => {
    shown = false
    invoker = null
  })

  return { open, close }
}

export const draggable = (element, handle, { signal } = {}) => {
  let x = 0
  let y = 0
  let grabX = 0
  let grabY = 0
  let held = false

  const paint = () => {
    element.style.setProperty('--drag-x', `${x}px`)
    element.style.setProperty('--drag-y', `${y}px`)
  }

  const withinViewport = () => {
    paint()
    const box = element.getBoundingClientRect()
    const viewport = document.documentElement
    let shiftX = -Math.max(0, box.right - viewport.clientWidth)
    if (box.left + shiftX < 0) shiftX = -box.left
    let shiftY = -Math.max(0, box.bottom - viewport.clientHeight)
    if (box.top + shiftY < 0) shiftY = -box.top
    if (shiftX === 0 && shiftY === 0) return
    x += shiftX
    y += shiftY
    paint()
  }

  const moveTo = (nextX, nextY) => {
    x = nextX
    y = nextY
    withinViewport()
  }

  handle.addEventListener('pointerdown', (event) => {
    if (event.button !== 0 || event.target.closest('button')) return
    held = true
    grabX = event.clientX - x
    grabY = event.clientY - y
    handle.setPointerCapture(event.pointerId)
    event.preventDefault()
  }, { signal })

  handle.addEventListener('pointermove', (event) => {
    if (!held) return
    moveTo(event.clientX - grabX, event.clientY - grabY)
  }, { signal })

  const drop = (event) => {
    if (!held) return
    held = false
    handle.releasePointerCapture(event.pointerId)
  }

  handle.addEventListener('pointerup', drop, { signal })
  handle.addEventListener('pointercancel', drop, { signal })

  handle.addEventListener('keydown', (event) => {
    const step = ARROW_STEPS[event.key]
    if (!step) return
    event.preventDefault()
    moveTo(x + step[0] * DRAG_STEP, y + step[1] * DRAG_STEP)
  }, { signal })

  document.defaultView.addEventListener('resize', withinViewport, { signal })

  return {
    reset: () => {
      x = 0
      y = 0
      paint()
    },
  }
}
