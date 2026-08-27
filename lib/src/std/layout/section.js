import { defineComponent } from '../shared/define.js'
import { el } from '../../api/html.js'
import { applyBox, BOX_PROPS, boxClass, boxStyles } from '../shared/box.js'
import { bindValue } from '../shared/args.js'
import { resolveValue } from '../shared/declarations.js'
import { spaceToken } from '../shared/layout.js'
import { impLogger } from '../../logger.js'

const NAME = 'section'

export const SECTION_SIZES = { sm: 4, md: 5, lg: 6 }

const KNOWN_PROPS = ['size', 'label', ...BOX_PROPS]

const toBlockPadding = (value) => {
  if (Object.hasOwn(SECTION_SIZES, value)) return spaceToken(SECTION_SIZES[value])
  impLogger.warn(
    `${NAME}: 'size' must be one of ${
      Object.keys(SECTION_SIZES).map((size) => `'${size}'`).join(', ')
    } - got '${value}', ignoring it`,
  )
  return null
}

const resolvePadding = (props) => {
  if (props.padding !== undefined || props.paddingY !== undefined) {
    if (props.size !== undefined) {
      impLogger.warn(`${NAME}: 'size' and 'padding'/'paddingY' both given - using the padding prop`)
    }
    return []
  }
  return [['padding-block', resolveValue(props.size ?? 'md', toBlockPadding)]]
}

const definition = {
  styles: () => boxStyles('block'),
  props: KNOWN_PROPS,
  onMount: (_instance, props, children) => {
    const root = el('section', { class: boxClass(props) }, ...children)
    bindValue(props.label, (value) => {
      if (value !== undefined) root.setAttribute('aria-label', String(value))
    })
    return applyBox(NAME, root, props, resolvePadding(props))
  },
}

export const section = (...args) => defineComponent(NAME, () => definition)(...args)
