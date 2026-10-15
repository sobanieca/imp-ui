import { defineComponent } from '../shared/define.js'
import { div } from '../../api/html.js'
import { oneOf } from '../shared/args.js'
import { token } from '../shared/css.js'
import { toSpace } from '../shared/layout.js'
import { applyValues, declarationStyles, resolveValue } from '../shared/declarations.js'

const NAME = 'stack'

const HORIZONTAL_ALIGNMENTS = ['start', 'end', 'center', 'stretch']

const VERTICAL_ALIGNMENTS = ['top', 'bottom', 'center', 'justify']

const KNOWN_PROPS = ['horizontalAlign', 'verticalAlign', 'gap']

const declarations = () => [{ property: 'gap', variable: 'gap', fallback: token('space-3') }]

const styles = () => `
  :host {
    display: block;
  }

  .root {
    display: flex;
    flex-direction: column;
    box-sizing: border-box;
    block-size: 100%;
    min-inline-size: 0;
  }

  .horizontal-start { align-items: flex-start }
  .horizontal-end { align-items: flex-end }
  .horizontal-center { align-items: center }
  .horizontal-stretch { align-items: stretch }

  .vertical-top { justify-content: flex-start }
  .vertical-bottom { justify-content: flex-end }
  .vertical-center { justify-content: center }
  .vertical-justify { justify-content: space-between }

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
      'stretch',
    )
    const vertical = oneOf(NAME, 'verticalAlign', props.verticalAlign, VERTICAL_ALIGNMENTS, 'top')
    const root = div(
      { class: ['root', `horizontal-${horizontal}`, `vertical-${vertical}`] },
      ...children,
    )
    return applyValues(root, [['gap', resolveValue(props.gap, toSpace(NAME, 'gap', 3))]])
  },
}

export const stack = (...args) => defineComponent(NAME, () => definition)(...args)
