import { defineComponent } from '../shared/define.js'
import { el } from '../../api/html.js'
import { defaultMessages } from '../../api/i18n.js'
import { bindValue, oneOf } from '../shared/args.js'

const TEXT_TYPES = ['text', 'email', 'tel', 'url']
import { createFieldBinding } from './field.js'
import { FORM_MESSAGES } from './form_state.js'
import { controlStyles } from './control_css.js'
import { impLogger } from '../../logger.js'
import {
  BINDING_PROPS,
  CONTROL_ID,
  createShell,
  SHELL_PROPS,
  shellStyles,
  VALIDATION_PROPS,
} from './shell.js'

const TEXT_PROPS = [
  ...BINDING_PROPS,
  ...SHELL_PROPS,
  ...VALIDATION_PROPS,
  'placeholder',
  'readonly',
  'autocomplete',
]

const asDisplayValue = (value) => (value === undefined || value === null ? '' : String(value))

const numberFrom = (raw) => {
  if (raw.trim() === '') return undefined
  const parsed = Number(raw)
  return Number.isNaN(parsed) ? raw : parsed
}

const numberCheck = (value) =>
  typeof value === 'string' && value.trim() !== '' ? { key: 'imp.form.number' } : null

const definitionFor = (name, { tag, type, numeric, extraProps }) => ({
  styles: () => `${shellStyles()}\n${controlStyles()}`,
  props: [...TEXT_PROPS, ...extraProps],
  onMount: (instance, props, children) => {
    if (children.length > 0) {
      impLogger.warn(`${name}: takes no content - pass 'label' and 'help' instead of children`)
    }
    const validate = numeric
      ? (value) => numberCheck(value) ?? (props.validate ? props.validate(value) : null)
      : props.validate
    const binding = createFieldBinding(name, { ...props, validate }, { instance })
    const inputType = props.type === undefined
      ? type
      : oneOf(name, 'type', props.type, TEXT_TYPES, type)
    const control = el(tag, {
      id: CONTROL_ID,
      ...(inputType ? { type: inputType } : {}),
      ...(props.placeholder === undefined ? {} : { placeholder: props.placeholder }),
      ...(props.autocomplete === undefined ? {} : { autocomplete: props.autocomplete }),
      ...(props.readonly ? { readonly: true } : {}),
      ...(props.rows === undefined ? {} : { rows: props.rows }),
      ...(props.step === undefined ? {} : { step: props.step }),
      events: {
        input: () => binding.commit(numeric ? numberFrom(control.value) : control.value),
        blur: () => {
          binding.touch()
          binding.check()
        },
      },
    })
    bindValue(props.disabled, (value) => {
      control.disabled = Boolean(value)
    })
    binding.watch((value) => {
      const next = asDisplayValue(value)
      if (control.value !== next) control.value = next
    })
    const shell = createShell(props, control)
    shell.attach(binding)
    return shell.root
  },
})

export const createTextComponent = (name, options) => (...args) =>
  defineComponent(
    name,
    () => definitionFor(name, { extraProps: [], ...options }),
    () => defaultMessages(FORM_MESSAGES),
  )(...args)
