import { component } from '../../component.js'
import { div, el, label as labelFor } from '../../api/html.js'
import { defaultMessages } from '../../api/i18n.js'
import { createLogger } from '../../logger.js'
import { bindText, bindValue, splitArgs, warnUnknownProps } from '../shared/args.js'
import { createFieldBinding } from './field.js'
import { FORM_MESSAGES } from './form_state.js'
import { checkableStyles } from './control_css.js'
import { BINDING_PROPS, CONTROL_ID, createShell, SHELL_PROPS, shellStyles } from './shell.js'

const log = createLogger('imp')

const KNOWN_PROPS = [...BINDING_PROPS, ...SHELL_PROPS, 'validate', 'validateAsync']

const CHECK_LABEL_ID = 'check-label'

const isUnchecked = (value) => !value

const toggleStyles = `
  .switch input {
    inline-size: 2.25rem;
    block-size: 1.25rem;
    border-radius: 999px;
    appearance: none;
    background-color: var(--imp-color-border, #cbd5e1);
    position: relative;
    transition: background-color var(--imp-duration-fast, 120ms) ease-out;
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
    background-color: var(--imp-color-surface, #ffffff);
    transition: translate var(--imp-duration-fast, 120ms) ease-out;
  }

  .switch input:checked {
    background-color: var(--imp-color-primary, #2563eb);
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
      border: var(--imp-border-width, 1px) solid ButtonBorder;
    }

    .switch input:checked {
      background-color: Highlight;
    }
  }
`

const definitionFor = (name, { role, extraClass }) => ({
  styles: `${shellStyles}\n${checkableStyles}\n${toggleStyles}`,
  onMount: (instance, ...args) => {
    const { props, children } = splitArgs(name, args)
    warnUnknownProps(name, props, KNOWN_PROPS)
    if (children.length > 0) {
      log.warn(`${name}: takes no content — pass 'label' for the text beside the box`)
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

export const createCheckable = (elementName, name, options = {}) => {
  let create = null
  return (...args) => {
    if (!create) {
      defaultMessages(FORM_MESSAGES)
      create = component(elementName, definitionFor(name, options))
    }
    return create(...args)
  }
}
