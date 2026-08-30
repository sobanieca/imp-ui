import { defineComponent } from '../shared/define.js'
import { div, p } from '../../api/html.js'
import { defaultMessages, lang, t } from '../../api/i18n.js'
import { bindText, oneOf } from '../shared/args.js'
import { fontFamily, token } from '../shared/css.js'

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

const styles = () => `
  .root {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: ${token('space-2')};
    padding-block: ${token('space-6')};
    padding-inline: ${token('space-4')};
    ${fontFamily()}
    text-align: center;
  }

  p {
    margin: 0;
    line-height: ${token('line-height-normal')};
  }

  .title {
    color: ${token('color-text')};
    font-size: ${token('font-size-lg')};
    font-weight: ${token('font-weight-medium')};
  }

  .description {
    color: ${token('color-secondary')};
    font-size: ${token('font-size-sm')};
    max-inline-size: 60ch;
  }

  .actions {
    display: flex;
    flex-wrap: wrap;
    justify-content: center;
    gap: ${token('space-2')};
    margin-block-start: ${token('space-2')};
  }
`

const definition = {
  styles,
  props: KNOWN_PROPS,
  build: (_instance, props, children) => {
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

export const emptyState = (...args) =>
  defineComponent('emptyState', () => definition, () => defaultMessages(messages))(...args)
