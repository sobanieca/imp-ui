import { defineComponent } from '../shared/define.js'
import { el, option } from '../../api/html.js'
import { defaultMessages } from '../../api/i18n.js'
import { impLogger } from '../../logger.js'
import { bindValue } from '../shared/args.js'
import { createFieldBinding } from './field.js'
import { FORM_MESSAGES } from './form_state.js'
import { controlStyles } from './control_css.js'
import {
  BINDING_PROPS,
  CONTROL_ID,
  createShell,
  SHELL_PROPS,
  shellStyles,
  VALIDATION_PROPS,
} from './shell.js'

const NAME = 'select'

const KNOWN_PROPS = [
  ...BINDING_PROPS,
  ...SHELL_PROPS,
  ...VALIDATION_PROPS,
  'options',
  'placeholder',
]

const PLACEHOLDER_VALUE = ''

const normalizeOptions = (options) => {
  if (!Array.isArray(options)) {
    impLogger.warn(
      `${NAME}: 'options' must be an array of { value, label } or plain strings - rendering none`,
    )
    return []
  }
  return options.flatMap((entry) => {
    if (typeof entry === 'string' || typeof entry === 'number') {
      return [{ value: String(entry), label: String(entry) }]
    }
    if (entry && typeof entry === 'object' && entry.value !== undefined) {
      return [{
        value: String(entry.value),
        label: String(entry.label ?? entry.value),
        disabled: Boolean(entry.disabled),
      }]
    }
    impLogger.warn(`${NAME}: an option is neither a string nor { value, label } - skipping it`)
    return []
  })
}

const definition = {
  styles: () => `${shellStyles()}\n${controlStyles()}`,
  props: KNOWN_PROPS,
  build: (instance, props, children) => {
    if (children.length > 0) {
      impLogger.warn(`${NAME}: takes no content - pass the choices as 'options'`)
    }
    const options = normalizeOptions(props.options ?? [])
    const binding = createFieldBinding(NAME, props, { instance })
    const control = el(
      'select',
      {
        id: CONTROL_ID,
        events: {
          change: () => {
            binding.touch()
            binding.commit(control.value === PLACEHOLDER_VALUE ? undefined : control.value)
          },
          blur: () => {
            binding.touch()
            binding.check()
          },
        },
      },
      props.placeholder === undefined
        ? null
        : option({ value: PLACEHOLDER_VALUE, disabled: true }, props.placeholder),
      ...options.map(({ value, label, disabled }) =>
        option({ value, ...(disabled ? { disabled: true } : {}) }, label)
      ),
    )
    bindValue(props.disabled, (value) => {
      control.disabled = Boolean(value)
    })
    binding.watch((value) => {
      const next = value === undefined || value === null ? PLACEHOLDER_VALUE : String(value)
      if (control.value !== next) control.value = next
    })
    const shell = createShell(props, control)
    shell.attach(binding)
    return shell.root
  },
}

export const select = (...args) =>
  defineComponent(NAME, () => definition, () => defaultMessages(FORM_MESSAGES))(...args)
