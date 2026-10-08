import { defineComponent } from '../shared/define.js'
import { div } from '../../api/html.js'
import { oneOf } from '../shared/args.js'
import { groupSeamRules, token } from '../shared/css.js'
import { impLogger } from '../../logger.js'
import { toSpace } from '../shared/layout.js'
import { applyValues, declarationStyles, resolveValue } from '../shared/declarations.js'

const NAME = 'flex'

const VERTICAL_ALIGNMENTS = ['top', 'bottom', 'center', 'stretch']

const HORIZONTAL_ALIGNMENTS = ['start', 'end', 'center', 'justify']

const KNOWN_PROPS = ['horizontalAlign', 'verticalAlign', 'wrap', 'gap', 'joined']

const declarations = () => [
  { property: 'gap', variable: 'gap', fallback: token('space-3') },
]

const styles = () => `
  .root {
    display: flex;
    flex-direction: row;
    min-inline-size: 0;
  }

  .wrap { flex-wrap: wrap }

  .root.joined { gap: 0 }

  ${groupSeamRules('.joined')}

  .vertical-top { align-items: flex-start }
  .vertical-bottom { align-items: flex-end }
  .vertical-center { align-items: center }
  .vertical-stretch { align-items: stretch }

  .horizontal-start { justify-content: flex-start }
  .horizontal-end { justify-content: flex-end }
  .horizontal-center { justify-content: center }
  .horizontal-justify { justify-content: space-between }

  ${declarationStyles('.root', declarations())}
`

const definition = {
  styles,
  props: KNOWN_PROPS,
  setup: (_self, props, children) => {
    const horizontal = oneOf(
      NAME,
      'horizontalAlign',
      props.horizontalAlign,
      HORIZONTAL_ALIGNMENTS,
      'start',
    )
    const vertical = oneOf(
      NAME,
      'verticalAlign',
      props.verticalAlign,
      VERTICAL_ALIGNMENTS,
      'stretch',
    )
    const joined = Boolean(props.joined)
    if (joined && props.gap !== undefined) {
      impLogger.warn(`${NAME}: a joined row has no gap - ignoring 'gap'`)
    }
    const root = div(
      {
        class: [
          'root',
          `horizontal-${horizontal}`,
          `vertical-${vertical}`,
          props.wrap && 'wrap',
          joined && 'joined',
        ],
      },
      ...children,
    )
    if (joined) return root
    return applyValues(root, [['gap', resolveValue(props.gap, toSpace(NAME, 'gap', 3))]])
  },
}

export const flex = (...args) => defineComponent(NAME, () => definition)(...args)
