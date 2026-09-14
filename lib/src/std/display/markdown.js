import { defineComponent } from '../shared/define.js'
import { div } from '../../api/html.js'
import { impLogger } from '../../logger.js'
import { isStateShaped } from '../../render.js'
import { bindValue } from '../shared/args.js'
import { markdownToNodes } from './markdown-read.js'
import { markdownViewStyles } from './markdown-view.js'
import { fontFamily, token } from '../shared/css.js'

const NAME = 'markdown'

const KNOWN_PROPS = ['text']

const styles = () => `
  :host {
    display: block;
  }

  .prose {
    ${fontFamily()}
    color: ${token('color-text')};
    font-size: ${token('font-size-md')};
    line-height: ${token('line-height-normal')};
    overflow-wrap: anywhere;
  }

${markdownViewStyles('.prose')}

  @media (forced-colors: active) {
    .prose blockquote { border-inline-start-color: CanvasText }
    .prose hr { border-block-start-color: CanvasText }
  }
`

const sourceOf = (props, children) => {
  if (children.length > 0) {
    impLogger.warn(`${NAME}: takes no children - pass the markdown as the 'text' prop`)
  }
  const { text } = props
  if (text === undefined || text === null) return ''
  if (typeof text === 'string' || isStateShaped(text)) return text
  impLogger.warn(`${NAME}: 'text' must be a string, or a state that holds one - showing none`)
  return ''
}

const definition = {
  styles,
  props: KNOWN_PROPS,
  setup: (self, props, children) => {
    const prose = div({ class: 'prose' })
    bindValue(self, sourceOf(props, children), (value) => {
      prose.replaceChildren(...markdownToNodes(value === null || value === undefined ? '' : value))
    })
    return prose
  },
}

export const markdown = (...args) => defineComponent(NAME, () => definition)(...args)
