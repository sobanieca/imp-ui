import { defineComponent } from '../shared/define.js'
import { div } from '../../api/html.js'
import { applyBox, BOX_PROPS, boxClass, boxStyles } from '../shared/box.js'
import { resolveResponsive } from '../shared/responsive.js'
import { impLogger } from '../../logger.js'
import { token } from '../shared/css.js'

const NAME = 'container'

export const CONTAINER_SIZES = ['sm', 'md', 'lg', 'xl']

const KNOWN_PROPS = ['size', ...BOX_PROPS]

const toContentWidth = (value) => {
  if (CONTAINER_SIZES.includes(value)) return token(`content-${value}`)
  impLogger.warn(
    `${NAME}: 'size' must be one of ${
      CONTAINER_SIZES.map((size) => `'${size}'`).join(', ')
    } - got '${value}', ignoring it`,
  )
  return null
}

const resolveWidth = (props) => {
  if (props.maxWidth !== undefined) {
    if (props.size !== undefined) {
      impLogger.warn(`${NAME}: 'size' and 'maxWidth' both given - using 'maxWidth'`)
    }
    return []
  }
  return [['max-width', resolveResponsive(NAME, 'size', props.size ?? 'lg', toContentWidth)]]
}

const definition = {
  styles: () =>
    boxStyles(
      'block',
      [],
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

export const container = (...args) => defineComponent(NAME, () => definition)(...args)
