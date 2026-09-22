import { defineComponent } from '../shared/define.js'
import { el, span } from '../../api/html.js'
import { impLogger } from '../../logger.js'
import { bindValue, oneOf } from '../shared/args.js'
import { createToggle } from '../shared/toggle.js'
import { spinnerNode, spinnerStyles } from '../shared/spinner.js'
import {
  activeColor,
  controlPaddingRules,
  focusRing,
  fontFamily,
  forcedColors,
  groupableSeam,
  hiddenRule,
  hoverColor,
  seamLift,
  sizeRules,
  SIZES,
  token,
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
  'events',
]

export const VARIANTS = ['default', 'primary', 'ghost', 'danger', 'link']

const POPUP_ROLES = ['menu', 'listbox']

const POPOVER_ACTIONS = ['toggle', 'show', 'hide']

const TOGGLE_EVENT = 'toggle'

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

  .button:disabled {
    cursor: not-allowed;
    opacity: ${token('disabled-opacity')};
  }

  .button[aria-pressed='true'] {
    background-color: ${token('color-surface-sunken')};
    border-color: ${token('color-primary')};
    color: ${token('color-primary')};
    box-shadow: inset 0 0 0 ${token('border-width')} ${token('color-primary')};
  }

  .button[aria-pressed='true']:hover:not(:disabled) {
    background-color: ${token('color-surface-hover')};
  }

  @media (forced-colors: active) {
    .button[aria-pressed='true'] {
      background-color: Highlight;
      color: HighlightText;
      forced-color-adjust: none;
    }
  }

  ${sizeRules()}

  ${controlPaddingRules()}

  .variant-default {
    background-color: ${token('color-surface')};
    border-color: ${token('color-border')};
    color: ${token('color-text')};
  }

  .variant-default:hover:not(:disabled) {
    background-color: ${token('color-surface-hover')};
  }

  .variant-primary {
    background-color: ${token('color-primary')};
    color: ${token('color-on-primary')};
  }

  .variant-primary:hover:not(:disabled) {
    background-color: ${hoverColor('color-primary')};
  }

  .variant-primary:active:not(:disabled) {
    background-color: ${activeColor('color-primary')};
  }

  .variant-ghost {
    background-color: transparent;
    color: ${token('color-text')};
  }

  .variant-ghost:hover:not(:disabled) {
    background-color: ${token('color-surface-hover')};
  }

  .variant-danger {
    background-color: ${token('color-danger')};
    color: ${token('color-on-danger')};
  }

  .variant-danger:hover:not(:disabled) {
    background-color: ${hoverColor('color-danger')};
  }

  .variant-danger:active:not(:disabled) {
    background-color: ${activeColor('color-danger')};
  }

  .variant-link {
    padding: 0;
    border: none;
    background-color: transparent;
    color: ${token('color-primary')};
    font-weight: ${token('font-weight-normal')};
    line-height: ${token('line-height-normal')};
    text-decoration: underline;
    text-underline-offset: 2px;
  }

  .variant-link:hover:not(:disabled) {
    color: ${hoverColor('color-primary')};
  }

  .label .icon {
    display: block;
    inline-size: 1em;
    block-size: 1em;
  }

  ${spinnerStyles()}

  .block {
    inline-size: 100%;
  }

  @media (prefers-reduced-motion: reduce) {
    .button { transition: none }
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
        ],
        events: props.events,
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
    let disabled = false
    let loading = false
    const applyStates = () => {
      control.disabled = disabled || loading
      control.setAttribute('aria-busy', String(loading))
      spinner.hidden = !loading
    }
    bindValue(self, props.disabled, (value) => {
      disabled = Boolean(value)
      applyStates()
    })
    bindValue(self, props.loading, (value) => {
      loading = Boolean(value)
      applyStates()
    })
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
      control.addEventListener('click', () => {
        if (!control.disabled) pressed.change(!pressed.get(), { notify: true })
      })
      pressed.follow(self)
    }
    return control
  },
}

export const button = (...args) => defineComponent(NAME, () => definition)(...args)
