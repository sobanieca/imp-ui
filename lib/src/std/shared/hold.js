import { span } from '../../api/html.js'
import { lang, t } from '../../api/i18n.js'
import { impLogger } from '../../logger.js'
import { createState } from '../../state.js'
import { createTooltip, tooltipStyles } from '../display/tooltip.js'
import { stopOnRemove } from './args.js'
import { token, visuallyHidden } from './css.js'

// A held press: a control whose click fires only after the person holds the pointer, `Enter` or
// `Space` on it for the whole time. The button and the options of a menu share it.

const HOLD_MS = 1500

const HOLD_KEY = 'imp.button.hold'

const HOLD_LONGER_KEY = 'imp.button.holdLonger'

export const holdMessages = {
  [HOLD_KEY]: 'Press and hold to confirm',
  [HOLD_LONGER_KEY]: 'Hold longer to confirm',
}

// How long the tooltip stays after a press that ended too soon.
const SHORT_PRESS_TIP_MS = 2500

const HOLD_KEYS = new Set(['Enter', ' '])

// The time of a hold in milliseconds, from `true` or a number; 0 for no hold.
export const holdDuration = (name, hold, prop = 'hold') => {
  if (hold === undefined || hold === false) return 0
  if (hold === true) return HOLD_MS
  if (typeof hold === 'number' && Number.isFinite(hold) && hold > 0) return hold
  impLogger.warn(`${name}: '${prop}' takes true or a positive number of milliseconds`)
  return HOLD_MS
}

// The fill that sweeps across a control while it is held, for the controls that match `selector`.
export const holdStyles = (selector = '.hold') => `
  ${selector} {
    position: relative;
    isolation: isolate;
    overflow: hidden;
    user-select: none;
    -webkit-user-select: none;
    -webkit-touch-callout: none;
  }

  ${selector}::before {
    content: '';
    position: absolute;
    inset-block: 0;
    inset-inline-start: 0;
    z-index: -1;
    inline-size: 0;
    background-color: currentColor;
    opacity: 0.22;
    pointer-events: none;
    transition: inline-size ${token('duration-fast')} ease-out;
  }

  ${selector}.holding::before {
    inline-size: 100%;
    transition: inline-size var(--hold-duration) linear;
  }

  .hold-hint {${visuallyHidden}}

  @media (prefers-reduced-motion: reduce) {
    ${selector}.holding::before { transition-timing-function: steps(5, jump-start) }
  }

  ${tooltipStyles()}
`

// The words that tell assistive technology to hold, for `aria-describedby` of a held control.
export const holdHint = (self, id) => {
  const hint = span({ class: 'hold-hint', id }, t(HOLD_KEY))
  lang.watch(self, () => {
    hint.textContent = t(HOLD_KEY)
  })
  return hint
}

// Makes `node` a held control. A plain click on it must be ignored by its owner while
// `confirming()` is false; after the hold, `wireHold` clicks it with `confirming()` true. `tip` is
// the tooltip of the control, for the owner to put in the same shadow root: "Press and hold to
// confirm" on a hover or a keyboard focus, and "Hold longer to confirm" after every press that ends
// too soon, so each click of a rage click shows it again.
export const wireHold = (self, node, { ms, hintId, blocked = () => false }) => {
  let timer = 0
  let confirming = false
  let short = false
  const words = createState('imp.hold.tip', t(HOLD_KEY))
  const paintWords = () => words.set(t(short ? HOLD_LONGER_KEY : HOLD_KEY))
  // The tooltip listens first, so its own hide on a release runs before the flash below.
  const tooltip = createTooltip(self, node, words, {
    enabled: () => !blocked(),
    focusVisible: true,
  })
  tooltip.tip.addEventListener('toggle', (event) => {
    if (event.newState !== 'closed' || !short) return
    short = false
    paintWords()
  })
  lang.watch(self, paintWords)
  const pressEnded = () => {
    if (!timer) return
    cancel()
    short = true
    paintWords()
    tooltip.flash(SHORT_PRESS_TIP_MS)
  }
  const cancel = () => {
    clearTimeout(timer)
    timer = 0
    node.classList.remove('holding')
  }
  const confirm = () => {
    cancel()
    confirming = true
    try {
      node.click()
    } finally {
      confirming = false
    }
  }
  const start = () => {
    if (blocked() || timer) return
    node.classList.add('holding')
    timer = setTimeout(confirm, ms)
  }
  node.classList.add('hold')
  node.style.setProperty('--hold-duration', `${ms}ms`)
  if (hintId) node.setAttribute('aria-describedby', hintId)
  node.addEventListener('pointerdown', (event) => {
    if (event.button === 0) start()
  })
  node.addEventListener('pointerup', pressEnded)
  for (const type of ['pointerleave', 'pointercancel', 'blur']) {
    node.addEventListener(type, cancel)
  }
  node.addEventListener('contextmenu', (event) => {
    if (timer) event.preventDefault()
  })
  node.addEventListener('keydown', (event) => {
    if (HOLD_KEYS.has(event.key) && !event.repeat) start()
  })
  node.addEventListener('keyup', (event) => {
    if (HOLD_KEYS.has(event.key)) pressEnded()
  })
  stopOnRemove(self, cancel)
  return { confirming: () => confirming, cancel, tip: tooltip.tip }
}
