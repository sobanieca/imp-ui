import { component } from '../../component.js'
import { div } from '../../api/html.js'
import { bindValue, oneOf, splitArgs, warnUnknownProps } from '../shared/args.js'
import { focusRing } from '../shared/css.js'
import { createLogger } from '../../logger.js'
import {
  applyResponsive,
  displayDeclaration,
  resolveResponsive,
  resolveVisibility,
  responsiveStyles,
  VISIBILITY_PROPS,
} from '../shared/responsive.js'

const log = createLogger('imp')

const NAME = 'scrollArea'

const AXES = ['vertical', 'horizontal', 'both']

const KNOWN_PROPS = ['axis', 'maxHeight', 'maxWidth', 'label', ...VISIBILITY_PROPS]

const declarations = [
  displayDeclaration('block'),
  { property: 'max-block-size', variable: 'maxblock', fallback: 'none' },
  { property: 'max-inline-size', variable: 'maxinline', fallback: 'none' },
]

const styles = `
  .root {
    min-inline-size: 0;
    overscroll-behavior: contain;
  }

  .root:focus-visible {${focusRing}}

  .vertical {
    overflow-block: auto;
    overflow-inline: hidden;
  }

  .horizontal {
    overflow-block: hidden;
    overflow-inline: auto;
  }

  .both {
    overflow: auto;
  }

  ${responsiveStyles('.root', declarations)}
`

const toLength = (prop) => (value) => {
  if (typeof value === 'string' && value.trim() !== '') return value
  log.warn(`${NAME}: '${prop}' must be a CSS length like '20rem' — got '${value}', ignoring it`)
  return null
}

const definition = {
  styles,
  onMount: (_instance, ...args) => {
    const { props, children } = splitArgs(NAME, args)
    warnUnknownProps(NAME, props, KNOWN_PROPS)
    const axis = oneOf(NAME, 'axis', props.axis, AXES, 'vertical')
    const root = div({ class: ['root', axis], tabindex: '0' }, ...children)
    if (props.label !== undefined) {
      root.setAttribute('role', 'region')
      bindValue(props.label, (value) => root.setAttribute('aria-label', String(value)))
    }
    const responsive = [
      ['display', resolveVisibility(NAME, props)],
      ['maxblock', resolveResponsive(NAME, 'maxHeight', props.maxHeight, toLength('maxHeight'))],
      ['maxinline', resolveResponsive(NAME, 'maxWidth', props.maxWidth, toLength('maxWidth'))],
    ]
    for (const [variable, resolved] of responsive) applyResponsive(root, variable, resolved)
    return root
  },
}

let create = null

export const scrollArea = (...args) => {
  create ??= component('imp-scroll-area', definition)
  return create(...args)
}
