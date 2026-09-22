import { defineComponent } from '../shared/define.js'
import { div, el } from '../../api/html.js'
import { defaultMessages } from '../../api/i18n.js'
import { bindValue, oneOf, stopOnRemove } from '../shared/args.js'
import { createFieldBinding } from './field.js'
import { FORM_MESSAGES } from './form-state.js'
import { controlStyles } from './control-css.js'
import { impLogger } from '../../logger.js'
import { button } from '../general/button.js'
import { icon } from '../general/icon.js'
import { luMinus, luPlus } from '../../icons/lucide-icons.js'
import { translatedLabel } from '../shared/translated-label.js'
import { groupSeamRules } from '../shared/css.js'
import {
  BINDING_PROPS,
  CONTROL_ID,
  createShell,
  SHELL_PROPS,
  shellStyles,
  VALIDATION_PROPS,
} from './shell.js'

const NAME = 'textField'

const TYPES = ['text', 'email', 'tel', 'url', 'password', 'search', 'number']

const KNOWN_PROPS = [
  ...BINDING_PROPS,
  ...SHELL_PROPS,
  ...VALIDATION_PROPS,
  'type',
  'rows',
  'step',
  'placeholder',
  'readonly',
  'autocomplete',
  'stepper',
]

const STEP_DOWN_KEY = 'imp.form.stepDown'

const STEP_UP_KEY = 'imp.form.stepUp'

const asDisplayValue = (value) => (value === undefined || value === null ? '' : String(value))

const numberFrom = (raw) => {
  if (raw.trim() === '') return undefined
  const parsed = Number(raw)
  return Number.isNaN(parsed) ? raw : parsed
}

const numberCheck = (value) =>
  typeof value === 'string' && value.trim() !== '' ? { key: 'imp.form.number' } : null

const multilineOf = (props) => {
  if (props.rows === undefined) return false
  if (props.type !== undefined && props.type !== 'text') {
    impLogger.warn(
      `${NAME}: 'rows' makes a multi-line field, which has no 'type' - ignoring type '${props.type}'`,
    )
  }
  return true
}

const stepOf = (props, numeric) => {
  if (props.step === undefined) return {}
  if (numeric) return { step: props.step }
  impLogger.warn(`${NAME}: 'step' applies to type 'number' only - ignoring it`)
  return {}
}

const stepperOf = (props, numeric) => {
  if (!props.stepper) return false
  if (numeric) return true
  impLogger.warn(`${NAME}: 'stepper' applies to type 'number' only - ignoring it`)
  return false
}

const stepperStyles = () => `
  .stepper {
    display: flex;
    align-items: stretch;
  }

  .stepper input {
    flex: 1 1 auto;
    min-inline-size: 0;
    appearance: textfield;
  }

  .stepper input::-webkit-inner-spin-button,
  .stepper input::-webkit-outer-spin-button {
    appearance: none;
    margin: 0;
  }

  ${groupSeamRules('.stepper')}
`

const definition = {
  styles: () => `${shellStyles()}\n${controlStyles()}\n${stepperStyles()}`,
  props: KNOWN_PROPS,
  setup: (self, props, children) => {
    if (children.length > 0) {
      impLogger.warn(`${NAME}: takes no content - pass 'label' and 'help' instead of children`)
    }
    const multiline = multilineOf(props)
    const type = multiline ? null : oneOf(NAME, 'type', props.type, TYPES, 'text')
    const numeric = type === 'number'
    const validate = numeric
      ? (value) => numberCheck(value) ?? (props.validate ? props.validate(value) : null)
      : props.validate
    const binding = createFieldBinding(NAME, { ...props, validate }, { self })
    const control = el(multiline ? 'textarea' : 'input', {
      id: CONTROL_ID,
      ...(multiline ? { rows: props.rows } : { type }),
      ...(props.placeholder === undefined ? {} : { placeholder: props.placeholder }),
      ...(props.autocomplete === undefined ? {} : { autocomplete: props.autocomplete }),
      ...(props.readonly ? { readonly: true } : {}),
      ...stepOf(props, numeric),
      events: {
        input: () => binding.commit(numeric ? numberFrom(control.value) : control.value),
        blur: () => {
          binding.touch()
          binding.check()
        },
      },
    })
    bindValue(self, props.disabled, (value) => {
      control.disabled = Boolean(value)
    })
    stopOnRemove(
      self,
      binding.watch((value) => {
        const next = asDisplayValue(value)
        if (control.value !== next) control.value = next
      }),
    )
    const nudge = (direction) => {
      if (direction > 0) control.stepUp()
      else control.stepDown()
      binding.touch()
      binding.commit(numberFrom(control.value))
      binding.check()
    }
    const stepButton = (direction, key, glyph) =>
      button({
        square: true,
        label: translatedLabel(self, key),
        disabled: props.readonly ? true : props.disabled,
        events: { click: () => nudge(direction) },
      }, icon(glyph))
    const presented = stepperOf(props, numeric)
      ? div(
        { class: 'stepper' },
        stepButton(-1, STEP_DOWN_KEY, luMinus),
        control,
        stepButton(1, STEP_UP_KEY, luPlus),
      )
      : null
    const shell = createShell(self, props, control, { presented })
    shell.attach(binding)
    return shell.root
  },
}

export const textField = (...args) =>
  defineComponent(NAME, () => definition, () => defaultMessages(FORM_MESSAGES))(...args)
