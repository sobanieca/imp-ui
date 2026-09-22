import { defineComponent } from '../shared/define.js'
import { div, el } from '../../api/html.js'
import { defaultMessages } from '../../api/i18n.js'
import { impLogger } from '../../logger.js'
import { bindValue, stopOnRemove } from '../shared/args.js'
import { createFieldBinding } from './field.js'
import { FORM_MESSAGES } from './form-state.js'
import { BINDING_PROPS, CONTROL_ID, createShell, SHELL_PROPS, shellStyles } from './shell.js'
import { focusRing, fontFamily, forcedColors, token } from '../shared/css.js'

const NAME = 'slider'

const KNOWN_PROPS = [
  ...BINDING_PROPS,
  ...SHELL_PROPS,
  'min',
  'max',
  'step',
  'showValue',
  'format',
  'validate',
  'validateAsync',
]

const DEFAULT_RANGE = { min: 0, max: 100, step: 1 }

const styles = () => `
  ${shellStyles()}

  .header {
    display: flex;
    flex: 0 0 var(--imp-field-label-size, auto);
    align-items: baseline;
    justify-content: space-between;
    gap: ${token('space-2')};
    min-inline-size: 0;
  }

  .header .label {
    flex: 1 1 auto;
  }

  .value {
    margin-inline-start: auto;
    color: ${token('color-secondary')};
    ${fontFamily()}
    font-size: ${token('font-size-sm')};
    font-variant-numeric: tabular-nums;
    line-height: ${token('line-height-tight')};
    white-space: nowrap;
  }

  input {
    display: block;
    box-sizing: border-box;
    inline-size: 100%;
    block-size: 1.5rem;
    margin: 0;
    background-color: transparent;
    accent-color: ${token('color-primary')};
    cursor: pointer;
  }

  input:focus-visible {
    ${focusRing()}
    border-radius: ${token('radius-item')};
  }

  input:disabled {
    cursor: not-allowed;
    opacity: ${token('disabled-opacity')};
  }

  ${forcedColors}
`

const finiteOr = (value, fallback, prop) => {
  if (value === undefined || value === null) return fallback
  const number = Number(value)
  if (Number.isFinite(number)) return number
  impLogger.warn(`${NAME}: '${prop}' must be a number - got '${value}', using ${fallback}`)
  return fallback
}

const readRange = (props) => {
  const range = {
    min: finiteOr(props.min, DEFAULT_RANGE.min, 'min'),
    max: finiteOr(props.max, DEFAULT_RANGE.max, 'max'),
    step: finiteOr(props.step, DEFAULT_RANGE.step, 'step'),
  }
  if (range.min >= range.max) {
    impLogger.warn(
      `${NAME}: 'min' (${range.min}) must be less than 'max' (${range.max}) - using 0 and 100`,
    )
    return { ...range, min: DEFAULT_RANGE.min, max: DEFAULT_RANGE.max }
  }
  if (range.step <= 0) {
    impLogger.warn(`${NAME}: 'step' must be more than 0 - got ${range.step}, using 1`)
    return { ...range, step: DEFAULT_RANGE.step }
  }
  return range
}

const readFormat = (format) => {
  if (format === undefined) return null
  if (typeof format === 'function') return format
  impLogger.warn(`${NAME}: 'format' must be a function of the value that returns a string`)
  return null
}

const placeInHeader = (root, output) => {
  const header = div({ class: 'header' })
  const label = root.querySelector('.label')
  if (label) label.replaceWith(header)
  else root.prepend(header)
  header.append(...[label, output].filter(Boolean))
}

const definition = {
  styles,
  props: KNOWN_PROPS,
  setup: (self, props, children) => {
    if (children.length > 0) {
      impLogger.warn(`${NAME}: takes no content - pass 'label' for the text above the track`)
    }
    const range = readRange(props)
    const format = readFormat(props.format)
    const binding = createFieldBinding(NAME, { ...props, min: undefined, max: undefined }, { self })
    const control = el('input', {
      id: CONTROL_ID,
      type: 'range',
      min: String(range.min),
      max: String(range.max),
      step: String(range.step),
      events: {
        input: () => binding.commit(Number(control.value)),
        change: () => binding.touch(),
        blur: () => {
          binding.touch()
          binding.check()
        },
      },
    })
    const output = props.showValue === false
      ? null
      : el('output', { class: 'value', for: CONTROL_ID, 'aria-hidden': 'true' })

    const describe = () => {
      const shown = Number(control.value)
      const text = format ? String(format(shown)) : String(shown)
      if (format) control.setAttribute('aria-valuetext', text)
      if (output) output.textContent = text
    }

    bindValue(self, props.disabled, (value) => {
      control.disabled = Boolean(value)
    })
    stopOnRemove(
      self,
      binding.watch((value) => {
        const number = Number(value)
        const next = String(
          value === undefined || value === null || Number.isNaN(number) ? range.min : number,
        )
        if (control.value !== next) control.value = next
        describe()
      }),
    )
    const shell = createShell(self, props, control)
    if (output) placeInHeader(shell.root, output)
    shell.attach(binding)
    return shell.root
  },
}

export const slider = (...args) =>
  defineComponent(NAME, () => definition, () => defaultMessages(FORM_MESSAGES))(...args)
