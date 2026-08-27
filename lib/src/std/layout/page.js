import { defineComponent } from '../shared/define.js'
import { div } from '../../api/html.js'
import { applyBox, BOX_PROPS, boxClass, boxStyles } from '../shared/box.js'
import { resolveValue } from '../shared/declarations.js'
import { impLogger } from '../../logger.js'
import { token } from '../shared/css.js'

const NAME = 'page'

export const PAGE_SIZES = ['sm', 'md', 'lg', 'xl', 'full']

const KNOWN_PROPS = ['size', ...BOX_PROPS]

const declarations = [
  { property: 'padding-inline', variable: 'padding-inline', fallback: token('space-page') },
  { property: 'padding-block', variable: 'padding-block', fallback: token('space-page') },
  { property: 'max-inline-size', variable: 'max-width', fallback: token('content-lg') },
]

const toContentWidth = (value) => {
  if (value === 'full') return 'none'
  if (PAGE_SIZES.includes(value)) return token(`content-${value}`)
  impLogger.warn(
    `${NAME}: 'size' must be one of ${
      PAGE_SIZES.map((size) => `'${size}'`).join(', ')
    } - got '${value}', ignoring it`,
  )
  return null
}

const resolveWidth = (props) => {
  if (props.maxWidth === undefined) {
    return [['max-width', resolveValue(props.size, toContentWidth)]]
  }
  if (props.size !== undefined) {
    impLogger.warn(`${NAME}: 'size' and 'maxWidth' both given - using 'maxWidth'`)
  }
  return []
}

const definition = {
  styles: () =>
    boxStyles(
      'block',
      declarations,
      `
  .root {
    margin-inline: auto;
  }
`,
    ),
  props: KNOWN_PROPS,
  onMount: (_instance, props, children) =>
    applyBox(NAME, div({ class: boxClass(props) }, ...children), props, resolveWidth(props)),
}

export const page = (...args) => defineComponent(NAME, () => definition)(...args)
