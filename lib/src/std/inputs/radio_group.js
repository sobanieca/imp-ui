import { defineComponent } from '../shared/define.js'
import { div, el, label as labelFor } from '../../api/html.js'
import { defaultMessages } from '../../api/i18n.js'
import { impLogger } from '../../logger.js'
import { bindValue, oneOf } from '../shared/args.js'
import { createFieldBinding } from './field.js'
import { FORM_MESSAGES } from './form_state.js'
import { checkableStyles } from './control_css.js'
import { BINDING_PROPS, createShell, SHELL_PROPS, shellStyles } from './shell.js'
import { token } from '../shared/css.js'

const NAME = 'radioGroup'

const ORIENTATIONS = ['vertical', 'horizontal']

const KNOWN_PROPS = [
  ...BINDING_PROPS,
  ...SHELL_PROPS,
  'options',
  'orientation',
  'validate',
  'validateAsync',
]

const styles = () => `
  ${shellStyles()}
  ${checkableStyles()}

  .choices {
    display: flex;
    flex-direction: column;
    gap: ${token('space-2')};
  }

  .choices.horizontal {
    flex-direction: row;
    flex-wrap: wrap;
    gap: ${token('space-4')};
  }
`

const normalizeOptions = (options) => {
  if (!Array.isArray(options)) {
    impLogger.warn(`${NAME}: 'options' must be an array of { value, label } or plain strings`)
    return []
  }
  return options.flatMap((entry, index) => {
    if (typeof entry === 'string' || typeof entry === 'number') {
      return [{ value: String(entry), label: String(entry), id: `choice-${index}` }]
    }
    if (entry && typeof entry === 'object' && entry.value !== undefined) {
      return [{
        value: String(entry.value),
        label: String(entry.label ?? entry.value),
        disabled: Boolean(entry.disabled),
        id: `choice-${index}`,
      }]
    }
    impLogger.warn(`${NAME}: an option is neither a string nor { value, label } - skipping it`)
    return []
  })
}

const definition = {
  styles,
  props: KNOWN_PROPS,
  onMount: (instance, props, children) => {
    if (children.length > 0) {
      impLogger.warn(`${NAME}: takes no content - pass the choices as 'options'`)
    }
    const orientation = oneOf(NAME, 'orientation', props.orientation, ORIENTATIONS, 'vertical')
    const options = normalizeOptions(props.options ?? [])
    const binding = createFieldBinding(NAME, props, { instance })
    const groupName = binding.path ?? NAME
    const radios = options.map(({ value, label, disabled, id }) => {
      const input = el('input', {
        id,
        type: 'radio',
        name: groupName,
        value,
        ...(disabled ? { disabled: true } : {}),
        events: {
          change: () => {
            if (!input.checked) return
            binding.touch()
            binding.commit(value)
            binding.check()
          },
        },
      })
      return {
        input,
        node: div(
          { class: 'check' },
          input,
          labelFor({ class: 'check-label', for: id }, label),
        ),
      }
    })
    bindValue(props.disabled, (value) => {
      for (const { input } of radios) input.disabled = Boolean(value)
    })
    binding.watch((value) => {
      const selected = value === undefined || value === null ? null : String(value)
      for (const { input } of radios) {
        const next = input.value === selected
        if (input.checked !== next) input.checked = next
      }
    })
    const choices = div(
      { class: ['choices', orientation === 'horizontal' && 'horizontal'] },
      ...radios.map(({ node }) => node),
    )
    const shell = createShell(props, choices, { grouping: true, presented: choices })
    shell.attach(binding)
    return shell.root
  },
}

export const radioGroup = (...args) =>
  defineComponent(NAME, () => definition, () => defaultMessages(FORM_MESSAGES))(...args)
