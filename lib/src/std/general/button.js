import { defineComponent } from '../shared/define.js'
import { el, span } from '../../api/html.js'
import { defaultMessages, lang, t } from '../../api/i18n.js'
import { impLogger } from '../../logger.js'
import { isStateShaped } from '../../render.js'
import { bindValue, oneOf, stopOnRemove } from '../shared/args.js'
import { createToggle } from '../shared/toggle.js'
import { spinnerNode, spinnerStyles } from '../shared/spinner.js'
import { useState } from '../../api/state.js'
import { FORM_ACTION_EVENT, SUBMITTING } from '../inputs/form-state.js'
import {
  activeColor,
  controlBoxRules,
  focusRing,
  fontFamily,
  forcedColors,
  groupableSeam,
  hiddenRule,
  hoverColor,
  seamKeep,
  seamLift,
  SIZES,
  token,
  visuallyHidden,
} from '../shared/css.js'

const NAME = 'button'

const KNOWN_PROPS = [
  'variant',
  'size',
  'disabled',
  'loading',
  'block',
  'square',
  'label',
  'pressed',
  'expanded',
  'haspopup',
  'popoverTarget',
  'popoverAction',
  'submit',
  'hold',
  'events',
]

export const VARIANTS = ['default', 'primary', 'ghost', 'danger', 'link']

const POPUP_ROLES = ['menu', 'listbox']

const POPOVER_ACTIONS = ['toggle', 'show', 'hide']

const TOGGLE_EVENT = 'toggle'

const HOLD_MS = 5000

const HOLD_KEY = 'imp.button.hold'

const HOLD_HINT_ID = 'hold-hint'

const HOLD_KEYS = new Set(['Enter', ' '])

const messages = {
  [HOLD_KEY]: 'Press and hold to confirm',
}

const holdDuration = (hold) => {
  if (hold === undefined || hold === false) return 0
  if (hold === true) return HOLD_MS
  if (typeof hold === 'number' && Number.isFinite(hold) && hold > 0) return hold
  impLogger.warn(`${NAME}: 'hold' takes true or a positive number of milliseconds`)
  return HOLD_MS
}

const guardedEvents = (events, blocked) => {
  const entry = events?.click
  if (entry === undefined) return events
  const [listener, options] = Array.isArray(entry) ? entry : [entry, null]
  if (typeof listener !== 'function') return events
  return { ...events, click: [(event) => blocked() || listener(event), options] }
}

const formSubmitting = (self) => {
  try {
    return useState(self, SUBMITTING)
  } catch {
    impLogger.warn(`${NAME}: 'submit' needs a form around the button - the click does nothing`)
    return null
  }
}

const requestSubmit = (node) =>
  node.dispatchEvent(
    new CustomEvent(FORM_ACTION_EVENT, {
      bubbles: true,
      composed: true,
      cancelable: true,
      detail: { action: 'submit' },
    }),
  )

const primaryTint = (amount) =>
  `color-mix(in oklab, ${token('color-primary')} ${amount}, ${token('color-surface')})`

const styles = () => `
  ${hiddenRule}

  .button {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: ${token('space-2')};
    margin: 0;
    border: ${token('border-width')} solid transparent;
    ${groupableSeam()}
    ${fontFamily()}
    font-weight: ${token('font-weight-bold')};
    line-height: ${token('line-height-tight')};
    cursor: pointer;
    transition:
      background-color ${token('duration-fast')} ease-out,
      border-color ${token('duration-fast')} ease-out,
      color ${token('duration-fast')} ease-out;
  }

  .button:focus-visible {${focusRing()}}

  ${seamLift('.button')}

  .button:is(:disabled, [aria-disabled='true']) {
    cursor: not-allowed;
    opacity: ${token('disabled-opacity')};
  }

  ${seamKeep(".button[aria-pressed='true']")}

  .button[aria-pressed='true'] {
    background-color: ${primaryTint('12%')};
    border-color: ${token('color-primary')};
    color: color-mix(in oklab, ${token('color-primary')} 62%, ${token('color-text')});
  }

  .button[aria-pressed='true']:hover:not(:disabled, [aria-disabled='true']) {
    background-color: ${primaryTint('20%')};
  }

  .button[aria-pressed='true']:active:not(:disabled, [aria-disabled='true']) {
    background-color: ${primaryTint('28%')};
  }

  @media (forced-colors: active) {
    .button[aria-pressed='true'] {
      background-color: Highlight;
      color: HighlightText;
      forced-color-adjust: none;
    }
  }

  ${controlBoxRules()}

  .variant-default {
    background-color: ${token('color-surface')};
    border-color: ${token('color-border')};
    color: ${token('color-text')};
  }

  .variant-default:hover:not(:disabled, [aria-disabled='true']) {
    background-color: ${token('color-surface-hover')};
  }

  .variant-default:active:not(:disabled, [aria-disabled='true']) {
    background-color: ${activeColor('color-surface')};
  }

  .variant-primary {
    background-color: ${token('color-primary')};
    color: ${token('color-on-primary')};
  }

  .variant-primary:hover:not(:disabled, [aria-disabled='true']) {
    background-color: ${hoverColor('color-primary')};
  }

  .variant-primary:active:not(:disabled, [aria-disabled='true']) {
    background-color: ${activeColor('color-primary')};
  }

  .variant-ghost {
    background-color: transparent;
    color: ${token('color-text')};
  }

  .variant-ghost:hover:not(:disabled, [aria-disabled='true']) {
    background-color: ${token('color-surface-hover')};
  }

  .variant-ghost:active:not(:disabled, [aria-disabled='true']) {
    background-color: ${activeColor('color-surface')};
  }

  .variant-danger {
    background-color: ${token('color-danger')};
    color: ${token('color-on-danger')};
  }

  .variant-danger:hover:not(:disabled, [aria-disabled='true']) {
    background-color: ${hoverColor('color-danger')};
  }

  .variant-danger:active:not(:disabled, [aria-disabled='true']) {
    background-color: ${activeColor('color-danger')};
  }

  .variant-link {
    min-block-size: 0;
    padding: 0;
    border: none;
    background-color: transparent;
    color: ${token('color-primary')};
    font-weight: ${token('font-weight-normal')};
    line-height: ${token('line-height-normal')};
    text-decoration: underline;
    text-underline-offset: 2px;
  }

  .variant-link:hover:not(:disabled, [aria-disabled='true']) {
    color: ${hoverColor('color-primary')};
  }

  .variant-link:active:not(:disabled, [aria-disabled='true']) {
    color: ${activeColor('color-primary')};
  }

  .label {
    display: inline-flex;
    align-items: center;
    gap: ${token('space-2')};
  }

  .label .icon {
    display: block;
    inline-size: 1em;
    block-size: 1em;
  }

  .square .label {
    block-size: 1lh;
  }

  ${spinnerStyles()}

  .block {
    inline-size: 100%;
  }

  .hold {
    position: relative;
    isolation: isolate;
    overflow: hidden;
    user-select: none;
    -webkit-user-select: none;
    -webkit-touch-callout: none;
  }

  .hold::before {
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

  .hold.holding::before {
    inline-size: 100%;
    transition: inline-size var(--hold-duration) linear;
  }

  .hold-hint {${visuallyHidden}}

  @media (prefers-reduced-motion: reduce) {
    .button { transition: none }
    .hold.holding::before { transition-timing-function: steps(5, jump-start) }
  }

  ${forcedColors}
`

const definition = {
  styles,
  props: KNOWN_PROPS,
  setup: (self, props, children) => {
    const variant = oneOf(NAME, 'variant', props.variant, VARIANTS, 'default')
    const size = oneOf(NAME, 'size', props.size, SIZES, 'md')
    const spinner = spinnerNode({ hidden: true })
    let disabled = false
    let loading = false
    const blocked = () => disabled || loading
    const holdMs = holdDuration(props.hold)
    let confirming = false
    const clickBlocked = () => blocked() || (holdMs > 0 && !confirming)
    const control = el(
      'button',
      {
        type: 'button',
        class: [
          'button',
          `variant-${variant}`,
          `size-${size}`,
          props.block && 'block',
          props.square && 'square',
          holdMs > 0 && 'hold',
        ],
        events: guardedEvents(props.events, clickBlocked),
      },
      spinner,
      span({ class: 'label' }, ...children),
    )
    if (props.haspopup !== undefined) {
      control.setAttribute(
        'aria-haspopup',
        oneOf(NAME, 'haspopup', props.haspopup, POPUP_ROLES, 'menu'),
      )
    }
    if (props.popoverTarget !== undefined) {
      if (props.popoverTarget instanceof Element) {
        control.popoverTargetElement = props.popoverTarget
        control.popoverTargetAction = oneOf(
          NAME,
          'popoverAction',
          props.popoverAction,
          POPOVER_ACTIONS,
          'toggle',
        )
      } else {
        impLogger.warn(`${NAME}: 'popoverTarget' must be an element with a popover attribute`)
      }
    }
    let holdTimer = 0
    const cancelHold = () => {
      clearTimeout(holdTimer)
      holdTimer = 0
      control.classList.remove('holding')
    }
    const confirmHold = () => {
      cancelHold()
      confirming = true
      try {
        control.click()
      } finally {
        confirming = false
      }
    }
    const startHold = () => {
      if (blocked() || holdTimer) return
      control.classList.add('holding')
      holdTimer = setTimeout(confirmHold, holdMs)
    }
    let focused = false
    const applyStates = () => {
      const keepsFocus = blocked() && focused
      control.disabled = blocked() && !keepsFocus
      if (keepsFocus) control.setAttribute('aria-disabled', 'true')
      else control.removeAttribute('aria-disabled')
      control.setAttribute('aria-busy', String(loading))
      spinner.hidden = !loading
      if (blocked()) cancelHold()
    }
    control.addEventListener('focus', () => {
      focused = true
    })
    control.addEventListener('blur', () => {
      focused = false
      applyStates()
    })
    control.addEventListener('click', (event) => {
      if (!clickBlocked()) return
      event.preventDefault()
      event.stopPropagation()
    })
    bindValue(self, props.disabled, (value) => {
      disabled = Boolean(value)
      applyStates()
    })
    let ownLoading = false
    let submitting = false
    const paintLoading = () => {
      loading = ownLoading || submitting
      applyStates()
    }
    bindValue(self, props.loading, (value) => {
      ownLoading = Boolean(value)
      paintLoading()
    })
    if (props.submit !== undefined && props.submit !== false) {
      if (props.submit !== true) impLogger.warn(`${NAME}: 'submit' takes true or false`)
      const state = formSubmitting(self)
      if (state) {
        bindValue(self, state, (value) => {
          submitting = Boolean(value)
          paintLoading()
        })
        control.addEventListener('click', () => {
          if (!clickBlocked()) requestSubmit(control)
        })
      }
    }
    bindValue(self, props.label, (value) => {
      if (value !== undefined) control.setAttribute('aria-label', String(value))
    })
    if (props.expanded !== undefined) {
      control.setAttribute('aria-expanded', 'false')
      bindValue(self, props.expanded, (value) => {
        control.setAttribute('aria-expanded', String(Boolean(value)))
      })
    }
    if (props.pressed !== undefined) {
      const pressed = createToggle(NAME, {
        prop: 'pressed',
        source: props.pressed,
        node: control,
        event: TOGGLE_EVENT,
        detail: 'pressed',
        paint: (value) => control.setAttribute('aria-pressed', String(value)),
      })
      control.setAttribute('aria-pressed', 'false')
      const followsReadOnlyState =
        isStateShaped(props.pressed) && typeof props.pressed.set !== 'function'
      control.addEventListener('click', () => {
        if (!followsReadOnlyState && !clickBlocked())
          pressed.change(!pressed.get(), { notify: true })
      })
      pressed.follow(self)
    }
    if (!holdMs) return control
    control.style.setProperty('--hold-duration', `${holdMs}ms`)
    control.setAttribute('aria-describedby', HOLD_HINT_ID)
    control.addEventListener('pointerdown', (event) => {
      if (event.button === 0) startHold()
    })
    for (const type of ['pointerup', 'pointerleave', 'pointercancel', 'blur']) {
      control.addEventListener(type, cancelHold)
    }
    control.addEventListener('contextmenu', (event) => {
      if (holdTimer) event.preventDefault()
    })
    control.addEventListener('keydown', (event) => {
      if (HOLD_KEYS.has(event.key) && !event.repeat) startHold()
    })
    control.addEventListener('keyup', (event) => {
      if (HOLD_KEYS.has(event.key)) cancelHold()
    })
    stopOnRemove(self, cancelHold)
    const hint = span({ class: 'hold-hint', id: HOLD_HINT_ID }, t(HOLD_KEY))
    lang.watch(self, () => {
      hint.textContent = t(HOLD_KEY)
    })
    return [control, hint]
  },
}

export const button = (...args) =>
  defineComponent(
    NAME,
    () => definition,
    () => defaultMessages(messages),
  )(...args)
