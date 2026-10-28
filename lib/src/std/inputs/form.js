import { defineComponent } from '../shared/define.js'
import { el } from '../../api/html.js'
import { defaultMessages, lang, t } from '../../api/i18n.js'
import { impLogger } from '../../logger.js'
import { valuesEqual } from '../../state.js'
import { oneOf, stopOnRemove } from '../shared/args.js'
import { fontFamily, token } from '../shared/css.js'
import { toSpace } from '../shared/layout.js'
import { applyValues, declarationStyles, resolveValue } from '../shared/declarations.js'
import { notice } from '../feedback/notice.js'
import {
  DIRTY,
  ERRORS,
  FORM_ACTION_EVENT,
  FORM_ERROR,
  FORM_MESSAGES,
  SUBMITS,
  SUBMITTING,
  TOUCHED,
  VALIDATING,
  VALUES,
} from './form-state.js'
import { computed, initState } from '../../api/state.js'
import { pathProblem } from '../shared/path.js'
import { provideSecrets } from './form-secrets.js'

const NAME = 'form'

const LAYOUTS = ['vertical', 'horizontal', 'inline']

const KNOWN_PROPS = ['initialValues', 'layout', 'gap', 'onSubmit', 'errorMessage']

const declarations = () => [{ property: 'gap', variable: 'gap', fallback: token('space-4') }]

const styles = () => `
  .root {
    display: flex;
    flex-direction: column;
    min-inline-size: 0;
    ${fontFamily()}
  }

  .inline {
    flex-direction: row;
    flex-wrap: wrap;
    align-items: flex-end;
  }

  ${declarationStyles('.root', declarations())}
`

const LAYOUT_TOKENS = {
  vertical: { 'field-direction': 'column', 'field-label-size': 'auto' },
  horizontal: { 'field-direction': 'row', 'field-label-size': '12rem' },
  inline: { 'field-direction': 'column', 'field-label-size': 'auto' },
}

const asProblem = (problem) => (typeof problem === 'string' ? { message: problem } : problem)

const fieldProblems = (fields) => {
  if (fields === undefined || fields === null) return {}
  if (typeof fields !== 'object' || Array.isArray(fields)) {
    impLogger.warn(
      `${NAME}: FormError 'fields' must be an object of { [path]: message } - ignoring it`,
    )
    return {}
  }
  const problems = {}
  for (const [path, problem] of Object.entries(fields)) {
    const invalid = pathProblem(path)
    if (invalid) {
      impLogger.warn(`${NAME}: FormError 'fields' ${invalid}`)
      continue
    }
    if (problem) problems[path] = asProblem(problem)
  }
  return problems
}

export class FormError extends Error {
  constructor(message = '', options) {
    super(message, options)
    this.name = 'FormError'
    this.fields = fieldProblems(options?.fields)
  }
}

const errorMessageOf = (errorMessage) => {
  if (errorMessage === undefined || errorMessage === null) return () => ''
  if (typeof errorMessage === 'function') return errorMessage
  impLogger.warn(
    `${NAME}: 'errorMessage' must be a function of the error, like (error) => error.body?.error`,
  )
  return () => ''
}

const failureMessage = (error, errorMessage) => {
  if (error instanceof FormError) return String(error.message ?? '').split('\n')[0]
  try {
    const text = errorMessage(error)
    return typeof text === 'string' ? text : ''
  } catch (problem) {
    impLogger.error(`${NAME}: the errorMessage function failed`, problem)
    return ''
  }
}

const withoutPaths = (current, paths) => {
  const rest = { ...(current ?? {}) }
  for (const path of paths) delete rest[path]
  return rest
}

const showFieldProblems = (states, root, problems) => {
  const paths = Object.keys(problems)
  if (paths.length === 0) return
  states.errors.set((all) => ({ ...(all ?? {}), ...problems }))
  states.serverPaths = paths
  focusFirstInvalid(root)
}

const failSubmit = (states, root, error) => {
  states.submitting.set(false)
  const problems = error instanceof FormError ? error.fields : {}
  const message = failureMessage(error, states.errorMessage)
  states.formError.set(message === '' && Object.keys(problems).length > 0 ? null : message)
  if (error instanceof FormError) {
    showFieldProblems(states, root, problems)
    impLogger.debug(`${NAME}: onSubmit threw a FormError - the form shows its message`, error)
    return
  }
  if (message !== '') {
    impLogger.debug(`${NAME}: onSubmit failed - the form shows the text of errorMessage`, error)
    return
  }
  impLogger.warn(
    `${NAME}: onSubmit failed - the form shows 'imp.form.submitFailed' above its buttons. `
      + "Throw a FormError, or pass 'errorMessage', to show a message of your own",
    error,
  )
}

const settleSubmitting = (states, root, outcome, succeed) => {
  if (outcome && typeof outcome.then === 'function') {
    states.submitting.set(true)
    outcome.then(
      () => {
        states.submitting.set(false)
        succeed()
      },
      (error) => failSubmit(states, root, error),
    )
    return
  }
  states.submitting.set(false)
  succeed()
}

const firstInvalidControl = (node) => {
  if (node.getAttribute?.('aria-invalid') === 'true') return node
  for (const child of [...(node.shadowRoot?.children ?? []), ...node.children]) {
    const found = firstInvalidControl(child)
    if (found) return found
  }
  return null
}

const focusFirstInvalid = (root) => {
  const control = firstInvalidControl(root)
  const target =
    control?.localName === 'fieldset'
      ? control.querySelector('input, select, textarea, button, [tabindex]')
      : control
  target?.focus()
}

const attemptSubmit = (onSubmit, states, root, beginSave) => {
  const failed = Object.keys(states.errors.get() ?? {})
  if (failed.length > 0) {
    impLogger.debug(
      `${NAME}: submit blocked by ${failed.length} invalid field(s) - ${failed.join(', ')}`,
    )
    states.submitting.set(false)
    focusFirstInvalid(root)
    return
  }
  if (typeof onSubmit !== 'function') {
    impLogger.warn(`${NAME}: nothing to submit to - pass 'onSubmit' to handle the values`)
    states.submitting.set(false)
    return
  }
  const submitted = states.values.get()
  const saved = beginSave(submitted)
  let outcome
  try {
    outcome = onSubmit(states.secrets.mergeInto(submitted))
  } catch (error) {
    failSubmit(states, root, error)
    return
  }
  settleSubmitting(states, root, outcome, saved)
}

const forgetServerProblems = (states) => {
  const paths = states.serverPaths
  states.serverPaths = []
  if (paths.length === 0) return
  states.errors.set((all) => withoutPaths(all, paths))
}

const runSubmit = (onSubmit, states, root, { settled, whenChecksSettle, beginSave }) => {
  if (states.submitting.get()) return
  states.formError.set(null)
  forgetServerProblems(states)
  states.submits.set((count) => (count ?? 0) + 1)
  if (settled()) {
    attemptSubmit(onSubmit, states, root, beginSave)
    return
  }
  states.submitting.set(true)
  whenChecksSettle().then(() => attemptSubmit(onSubmit, states, root, beginSave))
}

const failureNotice = (formError) =>
  notice({
    kind: 'error',
    title: computed([formError, lang], (message) => message || t('imp.form.submitFailed')),
    open: computed([formError], (message) => message !== null),
  })

const withFailureNotice = (children, failure) =>
  children.length === 0 ? [failure] : [...children.slice(0, -1), failure, children.at(-1)]

const nodeOf = (source) => {
  if (source instanceof Node) return source
  const node = source?.currentTarget ?? source?.target
  return node instanceof Node ? node : null
}

const requestAction = (helper, source, detail) => {
  const node = nodeOf(source)
  if (node === null) {
    impLogger.warn(`${NAME}: ${helper} takes the click event, or a node inside the form`)
    return
  }
  const unclaimed = node.dispatchEvent(
    new CustomEvent(FORM_ACTION_EVENT, {
      bubbles: true,
      composed: true,
      cancelable: true,
      detail,
    }),
  )
  if (unclaimed) {
    impLogger.warn(`${NAME}: ${helper} found no form around the node - nothing happened`)
  }
}

export const submitForm = (source) => requestAction('submitForm', source, { action: 'submit' })

export const resetForm = (source, values) =>
  requestAction('resetForm', source, { action: 'reset', values })

// A control that handles Enter itself, such as the link address of richTextEditor, prevents the
// default, and the form does not submit.
const isImplicitSubmit = (event) => {
  if (event.key !== 'Enter' || event.isComposing || event.defaultPrevented) return false
  if (event.shiftKey || event.altKey || event.ctrlKey || event.metaKey) return false
  const tag = event.composedPath()[0]?.localName
  return tag === 'input' || tag === 'select'
}

const definition = {
  styles,
  props: KNOWN_PROPS,
  setup: (self, props, children) => {
    const layout = oneOf(NAME, 'layout', props.layout, LAYOUTS, 'vertical')
    const states = {
      values: initState(self, VALUES, props.initialValues ?? null),
      errors: initState(self, ERRORS, {}),
      touched: initState(self, TOUCHED, {}),
      submitting: initState(self, SUBMITTING, false),
      submits: initState(self, SUBMITS, 0),
      validating: initState(self, VALIDATING, {}),
      dirty: initState(self, DIRTY, false),
      formError: initState(self, FORM_ERROR, null),
      secrets: provideSecrets(self),
      errorMessage: errorMessageOf(props.errorMessage),
      serverPaths: [],
    }
    let baseline = states.values.get()
    let resets = 0
    const updateDirty = () =>
      states.dirty.set(!valuesEqual(states.values.get(), baseline) || states.secrets.holdsAny())
    const beginSave = (submitted) => {
      const resetsAtSubmit = resets
      return () => {
        if (resets !== resetsAtSubmit) return
        baseline = submitted
        states.secrets.clear()
        updateDirty()
      }
    }
    states.values.watch(self, updateDirty)
    stopOnRemove(self, states.secrets.subscribe(updateDirty))
    const settled = () => Object.keys(states.validating.get() ?? {}).length === 0
    const waiters = []
    states.validating.watch(self, () => {
      if (!settled()) return
      for (const resolve of waiters.splice(0)) resolve()
    })
    const whenChecksSettle = () =>
      settled() ? Promise.resolve() : new Promise((resolve) => waiters.push(resolve))
    const submit = () =>
      runSubmit(props.onSubmit, states, root, { settled, whenChecksSettle, beginSave })
    const reset = (values) => {
      resets++
      if (values !== undefined) baseline = values
      states.values.set(baseline)
      states.secrets.clear()
      states.dirty.set(false)
      states.serverPaths = []
      states.errors.set({})
      states.touched.set({})
      states.submits.set(0)
      states.validating.set({})
      states.formError.set(null)
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
            event.preventDefault()
            if (event.detail.action === 'reset') reset(event.detail.values)
            else submit()
          },
        },
      },
      ...withFailureNotice(children, failureNotice(states.formError)),
    )
    for (const [token, value] of Object.entries(LAYOUT_TOKENS[layout])) {
      root.style.setProperty(`--imp-${token}`, value)
    }
    return applyValues(root, [['gap', resolveValue(props.gap, toSpace(NAME, 'gap', 4))]])
  },
}

export const form = (...args) =>
  defineComponent(
    NAME,
    () => definition,
    () => defaultMessages(FORM_MESSAGES),
  )(...args)
