import { defineComponent } from '../shared/define.js'
import { div, img, p, span } from '../../api/html.js'
import { defaultMessages, lang, t } from '../../api/i18n.js'
import { impLogger } from '../../logger.js'
import { bindText, oneOf } from '../shared/args.js'
import { fontFamily, token } from '../shared/css.js'
import { iconOrNull } from '../shared/items.js'
import { impMarkNode } from '../shared/imp-mark.js'

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

const IMAGE_SIZE = '6rem'

const KNOWN_PROPS = ['variant', 'title', 'description', 'icon', 'image', 'kind']

const EXCLUSIVE_PROPS = [['icon', 'image']]

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

  .icon,
  .image {
    display: inline-flex;
    margin-block-end: ${token('space-2')};
  }

  .image {
    inline-size: ${IMAGE_SIZE};
    max-inline-size: 100%;
    color: ${token('color-text')};
  }

  .image > * {
    display: block;
    inline-size: 100%;
    block-size: auto;
    max-block-size: ${IMAGE_SIZE};
    object-fit: contain;
  }

  p {
    margin: 0;
    line-height: ${token('line-height-normal')};
    overflow-wrap: anywhere;
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

const imageNode = (value) => {
  if (value instanceof Node) return value
  if (typeof value === 'string' && value !== '') return img({ src: value, alt: '' })
  impLogger.warn(`${NAME}: 'image' must be a DOM node or an image URL - drawing the imp mark`)
  return impMarkNode()
}

const visualNode = (props, kind) => {
  if (props.image !== undefined && props.image !== null) {
    if (props.icon !== undefined) {
      impLogger.warn(`${NAME}: pass 'icon' or 'image', not both - drawing the 'image'`)
    }
    return div({ class: 'image' }, imageNode(props.image))
  }
  if (props.icon !== undefined) {
    return span(
      { class: 'icon', 'aria-hidden': 'true' },
      iconOrNull(props.icon, { size: ICON_SIZE, color: KIND_COLORS[kind] }),
    )
  }
  return div({ class: 'image' }, impMarkNode())
}

const definition = {
  styles,
  props: KNOWN_PROPS,
  exclusiveProps: EXCLUSIVE_PROPS,
  setup: (self, props, children) => {
    const variant = oneOf(NAME, 'variant', props.variant, VARIANTS, 'empty')
    const kind = oneOf(NAME, 'kind', props.kind, KINDS, 'neutral')
    if (props.kind !== undefined && props.icon === undefined) {
      impLogger.warn(`${NAME}: 'kind' only tints the 'icon' - pass an icon from 'imp/icons'`)
    }
    const title =
      props.title === undefined
        ? lang.text(() => t(TITLE_KEYS[variant]))
        : bindText(self, props.title)
    return div(
      { class: 'root' },
      visualNode(props, kind),
      p({ class: 'title' }, title),
      props.description === undefined
        ? null
        : p({ class: 'description' }, bindText(self, props.description)),
      children.length === 0 ? null : div({ class: 'actions' }, ...children),
    )
  },
}

export const emptyState = (...args) =>
  defineComponent(
    NAME,
    () => definition,
    () => defaultMessages(messages),
  )(...args)
