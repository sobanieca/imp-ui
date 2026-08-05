import { defineComponent } from '../shared/define.js'
import { div } from '../../api/html.js'
import { toSpace } from '../shared/layout.js'
import {
  applyResponsive,
  displayDeclaration,
  resolveResponsive,
  resolveVisibility,
  responsiveStyles,
  VISIBILITY_PROPS,
} from '../shared/responsive.js'
import { impLogger } from '../../logger.js'

const NAME = 'spacer'

const KNOWN_PROPS = ['size', ...VISIBILITY_PROPS]

const declarations = [
  displayDeclaration('block'),
  { property: 'flex', variable: 'flex', fallback: '1 1 0' },
]

const styles = () => `
  ${responsiveStyles('.root', declarations)}
`

const toFixedFlex = (value) => `0 0 ${toSpace(NAME, 'size', 4)(value)}`

const definition = {
  styles,
  props: KNOWN_PROPS,
  onMount: (_instance, props, children) => {
    if (children.length > 0) {
      impLogger.warn(`${NAME}: takes no content - it is empty space, so its children are ignored`)
    }
    const root = div({ class: 'root', 'aria-hidden': 'true' })
    applyResponsive(root, 'display', resolveVisibility(NAME, props))
    applyResponsive(root, 'flex', resolveResponsive(NAME, 'size', props.size, toFixedFlex))
    return root
  },
}

export const spacer = (...args) => defineComponent(NAME, () => definition)(...args)
