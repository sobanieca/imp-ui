import { defineComponent } from '../shared/define.js'
import { div } from '../../api/html.js'
import { oneOf } from '../shared/args.js'
import { token } from '../shared/css.js'
import { toSpace } from '../shared/layout.js'
import { applyValues, declarationStyles, resolveValue } from '../shared/declarations.js'

const NAME = 'flex'

const VERTICAL_ALIGNMENTS = ['top', 'bottom', 'center', 'stretch']

const HORIZONTAL_ALIGNMENTS = ['left', 'right', 'center', 'justify']

const KNOWN_PROPS = ['horizontalAlign', 'verticalAlign', 'wrap', 'gap']

const declarations = [
  { property: 'gap', variable: 'gap', fallback: token('space-3') },
]

const styles = () => `
  .root {
    display: flex;
    flex-direction: row;
    min-inline-size: 0;
  }

  .root:dir(rtl) { flex-direction: row-reverse }

  .wrap { flex-wrap: wrap }

  .vertical-top { align-items: flex-start }
  .vertical-bottom { align-items: flex-end }
  .vertical-center { align-items: center }
  .vertical-stretch { align-items: stretch }

  .horizontal-left { justify-content: flex-start }
  .horizontal-right { justify-content: flex-end }
  .horizontal-center { justify-content: center }
  .horizontal-justify { justify-content: space-between }

  ${declarationStyles('.root', declarations)}
`

const definition = {
  styles,
  props: KNOWN_PROPS,
  onMount: (_instance, props, children) => {
    const horizontal = oneOf(
      NAME,
      'horizontalAlign',
      props.horizontalAlign,
      HORIZONTAL_ALIGNMENTS,
      'left',
    )
    const vertical = oneOf(
      NAME,
      'verticalAlign',
      props.verticalAlign,
      VERTICAL_ALIGNMENTS,
      'stretch',
    )
    const root = div(
      {
        class: [
          'root',
          `horizontal-${horizontal}`,
          `vertical-${vertical}`,
          props.wrap && 'wrap',
        ],
      },
      ...children,
    )
    return applyValues(root, [['gap', resolveValue(props.gap, toSpace(NAME, 'gap', 3))]])
  },
}

export const flex = (...args) => defineComponent(NAME, () => definition)(...args)
