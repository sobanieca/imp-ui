import { defineComponent } from '../shared/define.js'
import { el, span } from '../../api/html.js'
import { bindValue, oneOf } from '../shared/args.js'
import {
  focusRing,
  fontFamily,
  forcedColors,
  hiddenRule,
  sizeRules,
  SIZES,
  token,
} from '../shared/css.js'

const KNOWN_PROPS = ['variant', 'size', 'disabled', 'loading', 'block', 'label', 'events']

const VARIANTS = ['default', 'primary', 'ghost', 'danger', 'link']

const styles = () => `
  ${hiddenRule}

  .button {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: ${token('space-2')};
    margin: 0;
    border: ${token('border-width')} solid transparent;
    border-radius: ${token('radius-md')};
    ${fontFamily()}
    font-weight: ${token('font-weight-medium')};
    line-height: ${token('line-height-tight')};
    cursor: pointer;
    transition:
      background-color ${token('duration-fast')} ease-out,
      border-color ${token('duration-fast')} ease-out,
      color ${token('duration-fast')} ease-out;
  }

  .button:focus-visible {${focusRing()}}

  .button:disabled {
    cursor: not-allowed;
    opacity: ${token('disabled-opacity')};
  }

  ${sizeRules()}

  .size-sm {
    padding-block: ${token('space-1')};
    padding-inline: ${token('space-3')};
  }

  .size-md {
    padding-block: ${token('space-2')};
    padding-inline: ${token('space-4')};
  }

  .size-lg {
    padding-block: ${token('space-3')};
    padding-inline: ${token('space-5')};
  }

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
    background-color: ${token('color-primary-hover')};
  }

  .variant-primary:active:not(:disabled) {
    background-color: ${token('color-primary-active')};
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
    background-color: ${token('color-danger-hover')};
  }

  .variant-danger:active:not(:disabled) {
    background-color: ${token('color-danger-active')};
  }

  .variant-link {
    padding: 0;
    border: none;
    border-radius: ${token('radius-sm')};
    background-color: transparent;
    color: ${token('color-link')};
    font-weight: ${token('font-weight-normal')};
    line-height: ${token('line-height-normal')};
    text-decoration: underline;
    text-underline-offset: 2px;
  }

  .variant-link:hover:not(:disabled) {
    color: ${token('color-link-hover')};
  }

  .spinner {
    inline-size: 1em;
    block-size: 1em;
    border: 2px solid currentColor;
    border-block-start-color: transparent;
    border-radius: 50%;
    animation: imp-button-spin 600ms linear infinite;
  }

  @keyframes imp-button-spin {
    to { transform: rotate(360deg) }
  }

  .block {
    inline-size: 100%;
  }

  @media (prefers-reduced-motion: reduce) {
    .button { transition: none }
    .spinner { animation-duration: 2s }
  }

  ${forcedColors}
`

const definition = {
  styles,
  props: KNOWN_PROPS,
  onMount: (_instance, props, children) => {
    const variant = oneOf('button', 'variant', props.variant, VARIANTS, 'default')
    const size = oneOf('button', 'size', props.size, SIZES, 'md')
    const spinner = span({ class: 'spinner', 'aria-hidden': 'true', hidden: true })
    const control = el(
      'button',
      {
        type: 'button',
        class: ['button', `variant-${variant}`, `size-${size}`, props.block && 'block'],
        events: props.events,
      },
      spinner,
      span({ class: 'label' }, ...children),
    )
    let disabled = false
    let loading = false
    const applyStates = () => {
      control.disabled = disabled || loading
      control.setAttribute('aria-busy', String(loading))
      spinner.hidden = !loading
    }
    bindValue(props.disabled, (value) => {
      disabled = Boolean(value)
      applyStates()
    })
    bindValue(props.loading, (value) => {
      loading = Boolean(value)
      applyStates()
    })
    bindValue(props.label, (value) => {
      if (value !== undefined) control.setAttribute('aria-label', String(value))
    })
    return control
  },
}

export const button = (...args) => defineComponent('button', () => definition)(...args)
