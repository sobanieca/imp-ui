import { component } from '../../component.js'
import { el, span } from '../../api/html.js'
import { bindValue, oneOf, splitArgs, warnUnknownProps } from '../shared/args.js'
import { focusRing, fontFamily, forcedColors, hiddenRule, sizeRules, SIZES } from '../shared/css.js'

const VARIANTS = ['default', 'primary', 'ghost', 'danger']

const KNOWN_PROPS = ['variant', 'size', 'disabled', 'loading', 'block', 'events']

const styles = `
  ${hiddenRule}
  button {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: var(--imp-space-2, 8px);
    margin: 0;
    border: var(--imp-border-width, 1px) solid transparent;
    border-radius: var(--imp-radius-md, 6px);
    ${fontFamily}
    font-weight: var(--imp-font-weight-medium, 500);
    line-height: var(--imp-line-height-tight, 1.25);
    cursor: pointer;
    transition:
      background-color var(--imp-duration-fast, 120ms) ease-out,
      border-color var(--imp-duration-fast, 120ms) ease-out,
      color var(--imp-duration-fast, 120ms) ease-out;
  }

  button:focus-visible {${focusRing}}

  button:disabled {
    cursor: not-allowed;
    opacity: var(--imp-disabled-opacity, 0.55);
  }

  ${sizeRules}

  .size-sm {
    padding-block: var(--imp-space-1, 4px);
    padding-inline: var(--imp-space-3, 12px);
  }

  .size-md {
    padding-block: var(--imp-space-2, 8px);
    padding-inline: var(--imp-space-4, 16px);
  }

  .size-lg {
    padding-block: var(--imp-space-3, 12px);
    padding-inline: var(--imp-space-5, 24px);
  }

  .variant-default {
    background-color: var(--imp-color-surface, #ffffff);
    border-color: var(--imp-color-border, #cbd5e1);
    color: var(--imp-color-text, #0f172a);
  }

  .variant-default:hover:not(:disabled) {
    background-color: var(--imp-color-surface-hover, #f1f5f9);
  }

  .variant-primary {
    background-color: var(--imp-color-primary, #2563eb);
    color: var(--imp-color-on-primary, #ffffff);
  }

  .variant-primary:hover:not(:disabled) {
    background-color: var(--imp-color-primary-hover, #1d4ed8);
  }

  .variant-primary:active:not(:disabled) {
    background-color: var(--imp-color-primary-active, #1e40af);
  }

  .variant-ghost {
    background-color: transparent;
    color: var(--imp-color-text, #0f172a);
  }

  .variant-ghost:hover:not(:disabled) {
    background-color: var(--imp-color-surface-hover, #f1f5f9);
  }

  .variant-danger {
    background-color: var(--imp-color-danger, #dc2626);
    color: var(--imp-color-on-danger, #ffffff);
  }

  .variant-danger:hover:not(:disabled) {
    background-color: var(--imp-color-danger-hover, #b91c1c);
  }

  .variant-danger:active:not(:disabled) {
    background-color: var(--imp-color-danger-active, #991b1b);
  }

  .block {
    inline-size: 100%;
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

  @media (prefers-reduced-motion: reduce) {
    button { transition: none }
    .spinner { animation-duration: 2s }
  }

  ${forcedColors}
`

const definition = {
  styles,
  onMount: (_instance, ...args) => {
    const { props, children } = splitArgs('button', args)
    warnUnknownProps('button', props, KNOWN_PROPS)
    const variant = oneOf('button', 'variant', props.variant, VARIANTS, 'default')
    const size = oneOf('button', 'size', props.size, SIZES, 'md')
    const spinner = span({ class: 'spinner', 'aria-hidden': 'true', hidden: true })
    const control = el(
      'button',
      {
        type: 'button',
        class: [`variant-${variant}`, `size-${size}`, props.block && 'block'],
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
    return control
  },
}

let create = null

export const button = (...args) => {
  create ??= component('imp-button', definition)
  return create(...args)
}
