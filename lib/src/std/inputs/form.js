import { defineComponent } from '../shared/define.js'
import { el } from '../../api/html.js'
import { initState } from '../../api/state.js'
import { defaultMessages } from '../../api/i18n.js'
import { impLogger } from '../../logger.js'
import { oneOf } from '../shared/args.js'
import { fontFamily, token } from '../shared/css.js'
import { toSpace } from '../shared/layout.js'
import {
  applyResponsive,
  displayDeclaration,
  resolveResponsive,
  resolveVisibility,
  responsiveStyles,
  VISIBILITY_PROPS,
} from '../shared/responsive.js'
import {
  ERRORS,
  FORM_ACTION_EVENT,
  FORM_MESSAGES,
  SUBMITS,
  SUBMITTING,
  TOUCHED,
  VALIDATING,
  VALUES,
} from './form_state.js'

const NAME = 'form'

const LAYOUTS = ['vertical', 'horizontal', 'inline']

const KNOWN_PROPS = ['initialValues', 'layout', 'gap', 'onSubmit', ...VISIBILITY_PROPS]

const declarations = [
  displayDeclaration('flex'),
  { property: 'gap', variable: 'gap', fallback: token('space-4') },
]

const styles = () => `
  .root {
    flex-direction: column;
    min-inline-size: 0;
    ${fontFamily()}
  }

  .inline {
    flex-direction: row;
    flex-wrap: wrap;
    align-items: flex-end;
  }

  ${responsiveStyles('.root', declarations)}
`

const LAYOUT_TOKENS = {
  vertical: { 'field-direction': 'column', 'field-label-size': 'auto' },
  horizontal: { 'field-direction': 'row', 'field-label-size': '12rem' },
  inline: { 'field-direction': 'column', 'field-label-size': 'auto' },
}

const settleSubmitting = (states, outcome) => {
  if (outcome && typeof outcome.then === 'function') {
    states.submitting.set(true)
    outcome.then(() => states.submitting.set(false), (error) => {
      states.submitting.set(false)
      impLogger.error(`${NAME}: onSubmit failed`, error)
    })
    return
  }
  states.submitting.set(false)
}

const attemptSubmit = (onSubmit, states) => {
  const failed = Object.keys(states.errors.get() ?? {})
  if (failed.length > 0) {
    impLogger.debug(
      `${NAME}: submit blocked by ${failed.length} invalid field(s) - ${failed.join(', ')}`,
    )
    states.submitting.set(false)
    return
  }
  if (typeof onSubmit !== 'function') {
    impLogger.warn(`${NAME}: nothing to submit to - pass 'onSubmit' to handle the values`)
    states.submitting.set(false)
    return
  }
  let outcome
  try {
    outcome = onSubmit(states.values.get())
  } catch (error) {
    states.submitting.set(false)
    impLogger.error(`${NAME}: onSubmit failed`, error)
    return
  }
  settleSubmitting(states, outcome)
}

const runSubmit = (onSubmit, states, { settled, whenChecksSettle }) => {
  if (states.submitting.get()) return
  states.submits.set((count) => (count ?? 0) + 1)
  if (settled()) {
    attemptSubmit(onSubmit, states)
    return
  }
  states.submitting.set(true)
  whenChecksSettle().then(() => attemptSubmit(onSubmit, states))
}

const isImplicitSubmit = (event) => {
  if (event.key !== 'Enter' || event.isComposing) return false
  if (event.shiftKey || event.altKey || event.ctrlKey || event.metaKey) return false
  const tag = event.composedPath()[0]?.localName
  return tag === 'input' || tag === 'select'
}

const definition = {
  styles,
  props: KNOWN_PROPS,
  onMount: (_instance, props, children) => {
    const layout = oneOf(NAME, 'layout', props.layout, LAYOUTS, 'vertical')
    const states = {
      values: initState(VALUES, props.initialValues ?? null),
      errors: initState(ERRORS, {}),
      touched: initState(TOUCHED, {}),
      submitting: initState(SUBMITTING, false),
      submits: initState(SUBMITS, 0),
      validating: initState(VALIDATING, {}),
    }
    const initialValues = states.values.get()
    const settled = () => Object.keys(states.validating.get() ?? {}).length === 0
    const waiters = []
    states.validating.watch(() => {
      if (!settled()) return
      for (const resolve of waiters.splice(0)) resolve()
    })
    const whenChecksSettle = () =>
      settled() ? Promise.resolve() : new Promise((resolve) => waiters.push(resolve))
    const submit = () => runSubmit(props.onSubmit, states, { settled, whenChecksSettle })
    const reset = () => {
      states.values.set(initialValues)
      states.errors.set({})
      states.touched.set({})
      states.submits.set(0)
      states.validating.set({})
    }
    const root = el(
      'form',
      {
        class: ['root', layout === 'inline' && 'inline'],
        novalidate: true,
        events: {
          submit: (event) => {
            event.preventDefault()
            submit()
          },
          keydown: (event) => {
            if (!isImplicitSubmit(event)) return
            event.preventDefault()
            submit()
          },
          [FORM_ACTION_EVENT]: (event) => {
            event.stopPropagation()
            if (event.detail.action === 'reset') reset()
            else submit()
          },
        },
      },
      ...children,
    )
    for (const [token, value] of Object.entries(LAYOUT_TOKENS[layout])) {
      root.style.setProperty(`--imp-${token}`, value)
    }
    applyResponsive(root, 'display', resolveVisibility(NAME, props))
    applyResponsive(root, 'gap', resolveResponsive(NAME, 'gap', props.gap, toSpace(NAME, 'gap', 4)))
    return root
  },
}

export const form = (...args) =>
  defineComponent(NAME, () => definition, () => defaultMessages(FORM_MESSAGES))(...args)
