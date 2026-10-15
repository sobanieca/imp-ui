import { div, el, p, span } from '../../api/html.js'
import { lang } from '../../api/i18n.js'
import { bindText, bindValue, stopOnRemove } from '../shared/args.js'
import { describeError } from './field.js'
import { token } from '../shared/css.js'

export const CONTROL_ID = 'control'

export const LABEL_ID = 'label'

const HELP_ID = 'help'

const ERROR_ID = 'error'

export const SHELL_PROPS = ['label', 'ariaLabel', 'help', 'required', 'disabled']

export const VALIDATION_PROPS = [
  'minLength',
  'maxLength',
  'min',
  'max',
  'pattern',
  'validate',
  'validateAsync',
]

export const BINDING_PROPS = ['field', 'value', 'secret']

export const shellStyles = () => `
  .field {
    display: flex;
    flex-direction: var(--imp-field-direction, column);
    gap: ${token('space-2')};
    min-inline-size: 0;
  }

  .label {
    flex: 0 0 var(--imp-field-label-size, auto);
    color: ${token('color-text')};
    font-size: ${token('font-size-sm')};
    font-weight: ${token('font-weight-bold')};
    line-height: ${token('line-height-tight')};
  }

  legend.label {
    float: inline-start;
    padding: 0;
  }

  .required {
    color: ${token('color-danger')};
  }

  .optional {
    color: ${token('color-secondary')};
    font-weight: ${token('font-weight-normal')};
  }

  .body {
    display: flex;
    flex: 1 1 auto;
    flex-direction: column;
    gap: ${token('space-1')};
    min-inline-size: 0;
  }

  .help,
  .error {
    margin: 0;
    font-size: ${token('font-size-sm')};
    line-height: ${token('line-height-normal')};
  }

  .help {
    color: ${token('color-secondary')};
  }

  .error {
    color: ${token('color-danger')};
  }

  [hidden] {
    display: none;
  }

  fieldset {
    margin: 0;
    padding: 0;
    border: 0;
    min-inline-size: 0;
  }
`

export const createShell = (
  self,
  props,
  control,
  { grouping = false, presented = null, describedBy = [] } = {},
) => {
  const hasLabel = props.label !== undefined
  const marker = props.required ? span({ class: 'required', 'aria-hidden': 'true' }, ' *') : null
  const labelText = hasLabel ? bindText(self, props.label) : null
  const label = grouping
    ? el('legend', { class: 'label', id: LABEL_ID }, labelText, marker)
    : el('label', { class: 'label', id: LABEL_ID, for: CONTROL_ID }, labelText, marker)
  const help =
    props.help === undefined ? null : p({ class: 'help', id: HELP_ID }, bindText(self, props.help))
  const errorText = document.createTextNode('')
  const error = p({ class: 'error', id: ERROR_ID, 'aria-live': 'polite' }, errorText)
  const body = div({ class: 'body' }, presented ?? control, help, error)
  const root = grouping
    ? el('fieldset', { class: 'field' }, hasLabel ? label : null, body)
    : div({ class: 'field' }, hasLabel ? label : null, body)

  const described = help ? [HELP_ID, ...describedBy] : [...describedBy]
  const target = grouping ? root : control
  if (props.ariaLabel !== undefined) {
    bindValue(self, props.ariaLabel, (value) => target.setAttribute('aria-label', String(value)))
  }
  if (props.required) target.setAttribute('aria-required', 'true')

  let current = null
  let visible = false

  const paint = () => {
    const showing = visible && current !== null
    const message = showing ? describeError(current) : ''
    if (errorText.data !== message) errorText.data = message
    error.hidden = !showing
    target.setAttribute('aria-invalid', showing ? 'true' : 'false')
    const ids = showing ? [...described, ERROR_ID] : described
    if (ids.length === 0) target.removeAttribute('aria-describedby')
    else target.setAttribute('aria-describedby', ids.join(' '))
  }

  const attach = (binding) => {
    stopOnRemove(
      self,
      binding.watchError((problem) => {
        current = problem
        paint()
      }),
    )
    stopOnRemove(
      self,
      binding.watchVisible((showing) => {
        visible = showing
        paint()
      }),
    )
    stopOnRemove(
      self,
      binding.watchSubmits((attempts) => {
        if (attempts > 0) binding.check()
      }),
    )
    stopOnRemove(
      self,
      binding.watchChecking((checking) => {
        target.setAttribute('aria-busy', checking ? 'true' : 'false')
      }),
    )
    lang.watch(self, () => paint())
  }

  paint()
  return { root, attach }
}
