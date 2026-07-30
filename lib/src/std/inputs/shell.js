import { div, el, p, span } from '../../api/html.js'
import { lang } from '../../api/i18n.js'
import { bindText, bindValue } from '../shared/args.js'
import { describeError } from './field.js'

export const CONTROL_ID = 'control'

const LABEL_ID = 'label'

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

export const BINDING_PROPS = ['field', 'value']

export const shellStyles = `
  .field {
    display: flex;
    flex-direction: var(--imp-field-direction, column);
    gap: var(--imp-space-2, 8px);
    min-inline-size: 0;
  }

  .label {
    flex: 0 0 var(--imp-field-label-size, auto);
    color: var(--imp-color-text, #0f172a);
    font-size: var(--imp-font-size-sm, 0.875rem);
    font-weight: var(--imp-font-weight-medium, 500);
    line-height: var(--imp-line-height-tight, 1.25);
  }

  legend.label {
    padding: 0;
  }

  .required {
    color: var(--imp-color-danger, #dc2626);
  }

  .optional {
    color: var(--imp-color-secondary, #64748b);
    font-weight: var(--imp-font-weight-normal, 400);
  }

  .body {
    display: flex;
    flex: 1 1 auto;
    flex-direction: column;
    gap: var(--imp-space-1, 4px);
    min-inline-size: 0;
  }

  .help,
  .error {
    margin: 0;
    font-size: var(--imp-font-size-sm, 0.875rem);
    line-height: var(--imp-line-height-normal, 1.6);
  }

  .help {
    color: var(--imp-color-secondary, #64748b);
  }

  .error {
    color: var(--imp-color-danger, #dc2626);
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

export const createShell = (props, control, { grouping = false, presented = null } = {}) => {
  const hasLabel = props.label !== undefined
  const marker = props.required ? span({ class: 'required', 'aria-hidden': 'true' }, ' *') : null
  const labelText = hasLabel ? bindText(props.label) : null
  const label = grouping
    ? el('legend', { class: 'label', id: LABEL_ID }, labelText, marker)
    : el('label', { class: 'label', id: LABEL_ID, for: CONTROL_ID }, labelText, marker)
  const help = props.help === undefined
    ? null
    : p({ class: 'help', id: HELP_ID }, bindText(props.help))
  const errorText = document.createTextNode('')
  const error = p({ class: 'error', id: ERROR_ID, 'aria-live': 'polite' }, errorText)
  const body = div({ class: 'body' }, presented ?? control, help, error)
  const root = grouping
    ? el('fieldset', { class: 'field' }, hasLabel ? label : null, body)
    : div({ class: 'field' }, hasLabel ? label : null, body)

  const described = []
  if (help) described.push(HELP_ID)
  const target = grouping ? root : control
  if (props.ariaLabel !== undefined) {
    bindValue(props.ariaLabel, (value) => target.setAttribute('aria-label', String(value)))
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
    binding.watchError((problem) => {
      current = problem
      paint()
    })
    binding.watchVisible((showing) => {
      visible = showing
      paint()
    })
    binding.watchSubmits((attempts) => {
      if (attempts > 0) binding.check()
    })
    binding.watchChecking((checking) => {
      target.setAttribute('aria-busy', checking ? 'true' : 'false')
    })
    lang.watch(() => paint())
  }

  paint()
  return { root, attach }
}
