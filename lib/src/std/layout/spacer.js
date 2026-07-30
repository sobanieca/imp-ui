import { component } from '../../component.js'
import { div } from '../../api/html.js'
import { splitArgs, warnUnknownProps } from '../shared/args.js'
import { toSpace } from '../shared/layout.js'
import {
  applyResponsive,
  displayDeclaration,
  resolveResponsive,
  resolveVisibility,
  responsiveStyles,
  VISIBILITY_PROPS,
} from '../shared/responsive.js'
import { createLogger } from '../../logger.js'

const log = createLogger('imp')

const NAME = 'spacer'

const KNOWN_PROPS = ['size', ...VISIBILITY_PROPS]

const declarations = [
  displayDeclaration('block'),
  { property: 'flex', variable: 'flex', fallback: '1 1 0' },
]

const styles = `
  ${responsiveStyles('.root', declarations)}
`

const toFixedFlex = (value) => `0 0 ${toSpace(NAME, 'size', 4)(value)}`

const definition = {
  styles,
  onMount: (_instance, ...args) => {
    const { props, children } = splitArgs(NAME, args)
    warnUnknownProps(NAME, props, KNOWN_PROPS)
    if (children.length > 0) {
      log.warn(`${NAME}: takes no content — it is empty space, so its children are ignored`)
    }
    const root = div({ class: 'root', 'aria-hidden': 'true' })
    applyResponsive(root, 'display', resolveVisibility(NAME, props))
    applyResponsive(root, 'flex', resolveResponsive(NAME, 'size', props.size, toFixedFlex))
    return root
  },
}

let create = null

export const spacer = (...args) => {
  create ??= component('imp-spacer', definition)
  return create(...args)
}
