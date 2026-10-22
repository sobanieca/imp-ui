import { defineComponent } from '../shared/define.js'
import { div, el } from '../../api/html.js'
import { defaultMessages, lang, t } from '../../api/i18n.js'
import { impLogger } from '../../logger.js'
import { isHexColor } from '../../theme-colors.js'
import { bindValue, stopOnRemove } from '../shared/args.js'
import { createFieldBinding } from './field.js'
import { FORM_MESSAGES } from './form-state.js'
import { controlStyles } from './control-css.js'
import { groupSeamRules, token } from '../shared/css.js'
import { BINDING_PROPS, CONTROL_ID, createShell, SHELL_PROPS, shellStyles } from './shell.js'

const NAME = 'colorPicker'

const KNOWN_PROPS = [...BINDING_PROPS, ...SHELL_PROPS, 'validate', 'validateAsync']

const PICK_KEY = 'imp.colorPicker.pick'

const COLOR_MESSAGE_KEY = 'imp.form.color'

const messages = {
  [PICK_KEY]: 'Pick {label}',
  [COLOR_MESSAGE_KEY]: 'Enter a colour as #rrggbb',
}

const FALLBACK_SWATCH = '#000000'

const styles = () => `
  ${shellStyles()}
  ${controlStyles()}

  .row {
    display: flex;
    align-items: stretch;
  }

  .row input[type='text'] {
    flex: 1 1 auto;
    min-inline-size: 0;
    font-family: ${token('font-family-mono')};
  }

  .swatch {
    flex: none;
    inline-size: 2.75rem;
    block-size: auto;
    padding: ${token('space-1')};
    cursor: pointer;
  }

  .swatch::-webkit-color-swatch-wrapper {
    padding: 0;
  }

  .swatch::-webkit-color-swatch {
    border: 0;
    border-radius: calc(${token('radius-item')} - ${token('space-1')});
  }

  .swatch::-moz-color-swatch {
    border: 0;
    border-radius: calc(${token('radius-item')} - ${token('space-1')});
  }

  .swatch:disabled {
    cursor: not-allowed;
  }

  ${groupSeamRules('.row')}
`

const asSwatchValue = (value) => {
  if (!isHexColor(value)) return null
  const digits = value.slice(1).toLowerCase()
  return `#${digits.length === 3 ? digits.replace(/./g, (digit) => digit + digit) : digits}`
}

const asDisplayValue = (value) => (value === undefined || value === null ? '' : String(value))

const textValue = (raw) => (raw.trim() === '' ? undefined : raw.trim())

const colorCheck = (value) =>
  typeof value === 'string' && value.trim() !== '' && !isHexColor(value)
    ? { key: COLOR_MESSAGE_KEY }
    : null

const definition = {
  styles,
  props: KNOWN_PROPS,
  setup: (self, props, children) => {
    if (children.length > 0) {
      impLogger.warn(`${NAME}: takes no content - pass 'label' and 'help' instead of children`)
    }
    const validate = (value, context) =>
      colorCheck(value) ?? (props.validate ? props.validate(value, context) : null)
    const binding = createFieldBinding(NAME, { ...props, validate }, { self })
    const control = el('input', {
      id: CONTROL_ID,
      type: 'text',
      autocomplete: 'off',
      autocapitalize: 'none',
      spellcheck: 'false',
      events: {
        input: () => binding.commit(textValue(control.value)),
        blur: () => {
          binding.leave()
          binding.check()
        },
      },
    })
    const swatch = el('input', {
      class: 'swatch',
      type: 'color',
      value: FALLBACK_SWATCH,
      events: {
        input: () => {
          binding.touch()
          binding.commit(swatch.value)
          binding.check()
        },
      },
    })

    let name = ''
    const nameSwatch = () => swatch.setAttribute('aria-label', t(PICK_KEY, { label: name }))
    bindValue(self, props.label ?? props.ariaLabel ?? '', (value) => {
      name = asDisplayValue(value)
      nameSwatch()
    })
    lang.watch(self, nameSwatch)

    bindValue(self, props.disabled, (value) => {
      control.disabled = Boolean(value)
      swatch.disabled = Boolean(value)
    })
    stopOnRemove(
      self,
      binding.watch((value) => {
        const next = asDisplayValue(value)
        if (control.value !== next) control.value = next
        const shown = asSwatchValue(next)
        if (shown !== null && swatch.value !== shown) swatch.value = shown
      }),
    )
    const shell = createShell(self, props, control, {
      presented: div({ class: 'row' }, control, swatch),
    })
    shell.attach(binding)
    return shell.root
  },
}

const registerMessages = () => {
  defaultMessages(FORM_MESSAGES)
  defaultMessages(messages)
}

export const colorPicker = (...args) =>
  defineComponent(NAME, () => definition, registerMessages)(...args)
