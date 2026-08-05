import { defineComponent } from '../shared/define.js'
import { div, el, label as labelFor } from '../../api/html.js'
import { defaultMessages } from '../../api/i18n.js'
import { impLogger } from '../../logger.js'
import { bindText, bindValue } from '../shared/args.js'
import { createFieldBinding } from './field.js'
import { FORM_MESSAGES } from './form_state.js'
import { checkableStyles } from './control_css.js'
import { BINDING_PROPS, CONTROL_ID, createShell, SHELL_PROPS, shellStyles } from './shell.js'
import { token } from '../shared/css.js'

const KNOWN_PROPS = [...BINDING_PROPS, ...SHELL_PROPS, 'validate', 'validateAsync']

const CHECK_LABEL_ID = 'check-label'

const isUnchecked = (value) => !value

const toggleStyles = () => `
  .switch input {
    inline-size: 2.25rem;
    block-size: 1.25rem;
    border-radius: 999px;
    appearance: none;
    background-color: ${token('color-border')};
    position: relative;
    transition: background-color ${token('duration-fast')} ease-out;
    cursor: pointer;
  }

  .switch input::after {
    content: '';
    position: absolute;
    inset-block-start: 2px;
    inset-inline-start: 2px;
    inline-size: 1rem;
    block-size: 1rem;
    border-radius: 50%;
    background-color: ${token('color-surface')};
    transition: translate ${token('duration-fast')} ease-out;
  }

  .switch input:checked {
    background-color: ${token('color-primary')};
  }

  .switch input:checked::after {
    translate: 1rem 0;
  }

  @media (prefers-reduced-motion: reduce) {
    .switch input,
    .switch input::after {
      transition: none;
    }
  }

  @media (forced-colors: active) {
    .switch input {
      border: ${token('border-width')} solid ButtonBorder;
    }

    .switch input:checked {
      background-color: Highlight;
    }
  }
`

const definitionFor = (name, { role, extraClass }) => ({
  styles: () => `${shellStyles()}\n${checkableStyles()}\n${toggleStyles()}`,
  props: KNOWN_PROPS,
  onMount: (instance, props, children) => {
    if (children.length > 0) {
      impLogger.warn(`${name}: takes no content - pass 'label' for the text beside the box`)
    }
    const binding = createFieldBinding(name, props, { emptyWhen: isUnchecked, instance })
    const control = el('input', {
      id: CONTROL_ID,
      type: 'checkbox',
      ...(role ? { role } : {}),
      events: {
        change: () => {
          binding.touch()
          binding.commit(control.checked)
          binding.check()
        },
      },
    })
    bindValue(props.disabled, (value) => {
      control.disabled = Boolean(value)
    })
    binding.watch((value) => {
      const next = Boolean(value)
      if (control.checked !== next) control.checked = next
    })
    const text = props.label === undefined ? null : labelFor(
      { class: 'check-label', id: CHECK_LABEL_ID, for: CONTROL_ID },
      bindText(props.label),
    )
    const row = div({ class: ['check', extraClass] }, control, text)
    const shell = createShell({ ...props, label: undefined }, control, { presented: row })
    shell.attach(binding)
    return shell.root
  },
})

export const createCheckable = (name, options = {}) => (...args) =>
  defineComponent(name, () => definitionFor(name, options), () => defaultMessages(FORM_MESSAGES))(
    ...args,
  )
