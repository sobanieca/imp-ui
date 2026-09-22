import { defineComponent } from '../shared/define.js'
import { div, p, span } from '../../api/html.js'
import { defaultMessages, lang, t } from '../../api/i18n.js'
import { impLogger } from '../../logger.js'
import { bindText, oneOf } from '../shared/args.js'
import { fontFamily, token } from '../shared/css.js'
import { icon } from '../general/icon.js'

const NAME = 'emptyState'

const VARIANTS = ['empty', 'noResults']

const KINDS = ['neutral', 'success', 'error', 'warning', 'info']

const KIND_COLORS = {
  neutral: 'secondary',
  success: 'success',
  error: 'danger',
  warning: 'warning',
  info: 'info',
}

const ICON_SIZE = '3rem'

const KNOWN_PROPS = ['variant', 'title', 'description', 'icon', 'kind']

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

  .icon {
    display: inline-flex;
    margin-block-end: ${token('space-2')};
  }

  p {
    margin: 0;
    line-height: ${token('line-height-normal')};
  }

  .title {
    color: ${token('color-text')};
    font-size: ${token('font-size-lg')};
    font-weight: ${token('font-weight-bold')};
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
  setup: (self, props, children) => {
    const variant = oneOf(NAME, 'variant', props.variant, VARIANTS, 'empty')
    const kind = oneOf(NAME, 'kind', props.kind, KINDS, 'neutral')
    if (props.kind !== undefined && props.icon === undefined) {
      impLogger.warn(`${NAME}: 'kind' only tints the 'icon' - pass an icon from 'imp/icons'`)
    }
    const title = props.title === undefined
      ? lang.text(() => t(TITLE_KEYS[variant]))
      : bindText(self, props.title)
    return div(
      { class: 'root' },
      props.icon === undefined
        ? null
        : span({ class: 'icon' }, icon(props.icon, { size: ICON_SIZE, color: KIND_COLORS[kind] })),
      p({ class: 'title' }, title),
      props.description === undefined
        ? null
        : p({ class: 'description' }, bindText(self, props.description)),
      children.length === 0 ? null : div({ class: 'actions' }, ...children),
    )
  },
}

export const emptyState = (...args) =>
  defineComponent(NAME, () => definition, () => defaultMessages(messages))(...args)
