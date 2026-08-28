import { defineComponent } from '../shared/define.js'
import { div } from '../../api/html.js'
import { oneOf } from '../shared/args.js'
import { token } from '../shared/css.js'
import { toSpace } from '../shared/layout.js'
import { applyValues, declarationStyles, resolveValue } from '../shared/declarations.js'

const NAME = 'stack'

const HORIZONTAL_ALIGNMENTS = ['left', 'right', 'center', 'stretch']

const KNOWN_PROPS = ['horizontalAlign', 'gap']

const declarations = [
  { property: 'gap', variable: 'gap', fallback: token('space-3') },
]

const styles = () => `
  .root {
    display: flex;
    flex-direction: column;
    min-inline-size: 0;
  }

  .horizontal-left { align-items: flex-start }
  .horizontal-right { align-items: flex-end }
  .horizontal-center { align-items: center }
  .horizontal-stretch { align-items: stretch }

  .root:dir(rtl).horizontal-left { align-items: flex-end }
  .root:dir(rtl).horizontal-right { align-items: flex-start }

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
      'stretch',
    )
    const root = div({ class: ['root', `horizontal-${horizontal}`] }, ...children)
    return applyValues(root, [['gap', resolveValue(props.gap, toSpace(NAME, 'gap', 3))]])
  },
}

export const stack = (...args) => defineComponent(NAME, () => definition)(...args)
