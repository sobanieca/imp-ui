import { defineComponent } from '../shared/define.js'
import { div, span } from '../../api/html.js'
import { impLogger } from '../../logger.js'
import { bindContent } from '../shared/args.js'
import { fontFamily, token } from '../shared/css.js'

const NAME = 'tooltip'
const PLACEMENTS = ['block-start', 'block-end', 'inline-start', 'inline-end']

const EDGE_ZONE = 0.15

const HOVER_DELAY_MS = 150

const TOUCH_HOLD_MS = 350

let tooltipCount = 0

export const tooltipStyles = () => `
  .tip {
    position: fixed;
    position-try-fallbacks: flip-block, flip-inline, flip-block flip-inline;
    position-visibility: anchors-visible;
    box-sizing: border-box;
    inset: auto;
    inline-size: max-content;
    max-inline-size: 20rem;
    margin: ${token('space-1')};
    padding-block: ${token('space-1')};
    padding-inline: ${token('space-2')};
    border: ${token('border-width')} solid transparent;
    border-radius: ${token('radius-item')};
    background-color: ${token('color-text')};
    color: ${token('color-surface')};
    ${fontFamily()}
    font-size: ${token('font-size-sm')};
    line-height: ${token('line-height-tight')};
    box-shadow: ${token('shadow-sm')};
    pointer-events: none;
    overflow: visible;
    opacity: 1;
    transition: opacity ${token('duration-fast')} ease-out;
  }

  .tip.block-start { position-area: block-start center }
  .tip.block-end { position-area: block-end center }
  .tip.inline-start { position-area: center inline-start }
  .tip.inline-end { position-area: center inline-end }

  .tip:not(:popover-open) { display: none }

  @starting-style {
    .tip:popover-open { opacity: 0 }
  }

  @media (prefers-reduced-motion: reduce) {
    .tip { transition: none }
  }

  @media (forced-colors: active) {
    .tip { border-color: CanvasText }
  }
`

const sideOf = (trigger) => {
  const rect = trigger.getBoundingClientRect()
  const { clientWidth, clientHeight } = document.documentElement
  const centerX = rect.left + rect.width / 2
  const centerY = rect.top + rect.height / 2
  const rightToLeft = getComputedStyle(trigger).direction === 'rtl'
  if (centerX < clientWidth * EDGE_ZONE) return rightToLeft ? 'inline-start' : 'inline-end'
  if (centerX > clientWidth * (1 - EDGE_ZONE)) return rightToLeft ? 'inline-end' : 'inline-start'
  return centerY < clientHeight / 2 ? 'block-end' : 'block-start'
}

export const attachTooltip = (self, trigger, content, { enabled = () => true } = {}) => {
  tooltipCount += 1
  const anchor = `--imp-tip-${tooltipCount}`
  const tip = div(
    { class: 'tip', 'aria-hidden': 'true', popover: 'manual' },
    bindContent(self, content),
  )
  tip.style.positionAnchor = anchor
  let timer = null
  let held = false
  const isOpen = () => tip.matches(':popover-open')
  let anchored = false
  let restingAnchors = ''

  const anchorTrigger = () => {
    if (anchored) return
    anchored = true
    restingAnchors = trigger.style.anchorName
    const declared = getComputedStyle(trigger).anchorName
    trigger.style.anchorName = !declared || declared === 'none' ? anchor : `${declared}, ${anchor}`
  }
  const releaseTrigger = () => {
    if (!anchored) return
    anchored = false
    trigger.style.anchorName = restingAnchors
  }

  tip.addEventListener('toggle', () => {
    if (!isOpen()) releaseTrigger()
  })

  const show = () => {
    timer = null
    if (!enabled() || !tip.isConnected || !trigger.isConnected || isOpen()) return
    tip.classList.remove(...PLACEMENTS)
    tip.classList.add(sideOf(trigger))
    anchorTrigger()
    tip.showPopover()
  }
  const hide = () => {
    clearTimeout(timer)
    timer = null
    held = false
    if (isOpen()) tip.hidePopover()
    releaseTrigger()
  }
  const showAfter = (delay) => {
    clearTimeout(timer)
    timer = setTimeout(show, delay)
  }

  self.abortSignal.addEventListener(
    'abort',
    () => {
      clearTimeout(timer)
      timer = null
      if (isOpen()) tip.hidePopover()
      releaseTrigger()
    },
    { once: true },
  )

  const listen = (type, handler) =>
    trigger.addEventListener(type, handler, { signal: self.abortSignal })
  listen('pointerenter', (event) => {
    if (event.pointerType !== 'touch') showAfter(HOVER_DELAY_MS)
  })
  listen('pointerleave', hide)
  listen('pointerdown', (event) => {
    if (event.pointerType !== 'touch') return hide()
    held = true
    showAfter(TOUCH_HOLD_MS)
  })
  listen('pointerup', hide)
  listen('pointercancel', hide)
  listen('contextmenu', (event) => {
    if (held) event.preventDefault()
  })
  listen('focusin', show)
  listen('focusout', hide)
  listen('keydown', (event) => {
    if (event.key === 'Escape') hide()
  })
  return tip
}

const KNOWN_PROPS = ['text']

const styles = () => `
  :host {
    display: inline-block;
  }

  .anchor {
    display: block;
  }

  ${tooltipStyles()}
`

const definition = {
  styles,
  props: KNOWN_PROPS,
  setup: (self, props, children) => {
    if (props.text === undefined || props.text === null) {
      impLogger.warn(`${NAME}: pass 'text' - it is what the tooltip shows`)
    }
    if (children.length === 0) {
      impLogger.warn(
        `${NAME}: pass the control as a child - the tooltip needs a trigger to anchor to`,
      )
    }
    const anchor = span({ class: 'anchor' }, ...children)
    const tip = attachTooltip(self, anchor, props.text ?? '')
    return [anchor, tip]
  },
}

export const tooltip = (...args) => defineComponent(NAME, () => definition)(...args)
