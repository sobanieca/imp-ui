import { component } from '../../component.js'
import { div, p } from '../../api/html.js'
import { defaultMessages, lang, t } from '../../api/i18n.js'
import { bindText, oneOf, splitArgs, warnUnknownProps } from '../shared/args.js'
import { fontFamily } from '../shared/css.js'

const VARIANTS = ['empty', 'noResults']

const KNOWN_PROPS = ['variant', 'title', 'description']

const TITLE_KEYS = {
  empty: 'imp.state.empty',
  noResults: 'imp.state.noResults',
}

const messages = {
  'imp.state.empty': 'Nothing here yet',
  'imp.state.noResults': 'No results',
}

const styles = `
  .root {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: var(--imp-space-2, 8px);
    padding-block: var(--imp-space-6, 32px);
    padding-inline: var(--imp-space-4, 16px);
    ${fontFamily}
    text-align: center;
  }

  p {
    margin: 0;
    line-height: var(--imp-line-height-normal, 1.6);
  }

  .title {
    color: var(--imp-color-text, #0f172a);
    font-size: var(--imp-font-size-lg, 1.125rem);
    font-weight: var(--imp-font-weight-medium, 500);
  }

  .description {
    color: var(--imp-color-secondary, #64748b);
    font-size: var(--imp-font-size-sm, 0.875rem);
    max-inline-size: 60ch;
  }

  .actions {
    display: flex;
    flex-wrap: wrap;
    justify-content: center;
    gap: var(--imp-space-2, 8px);
    margin-block-start: var(--imp-space-2, 8px);
  }
`

const definition = {
  styles,
  onMount: (_instance, ...args) => {
    const { props, children } = splitArgs('emptyState', args)
    warnUnknownProps('emptyState', props, KNOWN_PROPS)
    const variant = oneOf('emptyState', 'variant', props.variant, VARIANTS, 'empty')
    const title = props.title === undefined
      ? lang.text(() => t(TITLE_KEYS[variant]))
      : bindText(props.title)
    return div(
      { class: 'root' },
      p({ class: 'title' }, title),
      props.description === undefined
        ? null
        : p({ class: 'description' }, bindText(props.description)),
      children.length === 0 ? null : div({ class: 'actions' }, ...children),
    )
  },
}

let create = null

export const emptyState = (...args) => {
  if (!create) {
    defaultMessages(messages)
    create = component('imp-empty-state', definition)
  }
  return create(...args)
}
