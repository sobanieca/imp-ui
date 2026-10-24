import { defineComponent } from '../shared/define.js'
import { el, option, span } from '../../api/html.js'
import { defaultMessages } from '../../api/i18n.js'
import { impLogger } from '../../logger.js'
import { bindValue, stopOnRemove } from '../shared/args.js'
import { createFieldBinding } from './field.js'
import { normalizeOptions, rawValueOf, valueKey } from './options.js'
import { FORM_MESSAGES } from './form-state.js'
import { controlStyles } from './control-css.js'
import { chevronDownIcon } from '../shared/icons.js'
import { token } from '../shared/css.js'
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

const arrowStyles = () => `
  .select-box {
    position: relative;
    display: block;
  }

  .select-arrow {
    position: absolute;
    inset-inline-end: ${token('space-3')};
    inset-block-start: 50%;
    inline-size: 1em;
    block-size: 1em;
    translate: 0 -50%;
    color: ${token('color-secondary')};
    pointer-events: none;
  }

  select:disabled + .select-arrow {
    opacity: ${token('disabled-opacity')};
  }
`

const definition = {
  styles: () => `${shellStyles()}\n${controlStyles()}\n${arrowStyles()}`,
  props: KNOWN_PROPS,
  setup: (self, props, children) => {
    if (children.length > 0) {
      impLogger.warn(`${NAME}: takes no content - pass the choices as 'options'`)
    }
    const options = normalizeOptions(NAME, props.options ?? [])
    const binding = createFieldBinding(NAME, props, { self })
    const control = el(
      'select',
      {
        id: CONTROL_ID,
        events: {
          change: () => {
            binding.touch()
            binding.commit(rawValueOf(options, control.value))
          },
          blur: () => {
            binding.leave()
            binding.check()
          },
        },
      },
      props.placeholder === undefined
        ? null
        : option({ value: PLACEHOLDER_VALUE, disabled: true }, props.placeholder),
      ...options.map(({ value, label, disabled }) =>
        option({ value, ...(disabled ? { disabled: true } : {}) }, label),
      ),
    )
    bindValue(self, props.disabled, (value) => {
      control.disabled = Boolean(value)
    })
    stopOnRemove(
      self,
      binding.watch((value) => {
        const next = valueKey(value)
        if (control.value !== next) control.value = next
      }),
    )
    const presented = span({ class: 'select-box' }, control, chevronDownIcon('select-arrow'))
    const shell = createShell(self, props, control, { presented })
    shell.attach(binding)
    return shell.root
  },
}

export const select = (...args) =>
  defineComponent(
    NAME,
    () => definition,
    () => defaultMessages(FORM_MESSAGES),
  )(...args)
