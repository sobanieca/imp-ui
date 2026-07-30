import { component } from '../../component.js'
import { useState } from '../../api/state.js'
import { button } from '../general/button.js'
import { oneOf, splitArgs, warnUnknownProps } from '../shared/args.js'
import { SIZES } from '../shared/css.js'
import { FORM_ACTION_EVENT, SUBMITTING } from './form_state.js'

const KNOWN_PROPS = ['variant', 'size', 'disabled']

const VARIANTS = ['default', 'primary', 'ghost', 'danger']

const definitionFor = (name, { action, defaultVariant, tracksSubmitting }) => ({
  onMount: (instance, ...args) => {
    const { props, children } = splitArgs(name, args)
    warnUnknownProps(name, props, KNOWN_PROPS)
    const variant = oneOf(name, 'variant', props.variant, VARIANTS, defaultVariant)
    const size = oneOf(name, 'size', props.size, SIZES, 'md')
    let submitting = null
    try {
      submitting = useState(SUBMITTING)
    } catch {
      throw new Error(
        `imp: ${name}: there is no form around this button — render it inside form({ initialValues, onSubmit })`,
      )
    }
    const fire = () => {
      instance.host.dispatchEvent(
        new CustomEvent(FORM_ACTION_EVENT, {
          bubbles: true,
          composed: true,
          detail: { action },
        }),
      )
    }
    return button(
      {
        variant,
        size,
        disabled: props.disabled,
        ...(tracksSubmitting ? { loading: submitting } : {}),
        events: { click: fire },
      },
      ...children,
    )
  },
})

export const createFormButton = (elementName, name, options) => {
  let create = null
  return (...args) => {
    create ??= component(elementName, definitionFor(name, options))
    return create(...args)
  }
}
