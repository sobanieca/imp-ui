import { component } from '../../component.js'
import { div } from '../../api/html.js'
import { splitArgs, warnUnknownProps } from '../shared/args.js'
import { toKeyword, toOrder, toRowSpan, toSpan, toStart } from '../shared/layout.js'
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

const NAME = 'item'

const KNOWN_PROPS = ['grow', 'span', 'start', 'rowSpan', 'order', 'align', ...VISIBILITY_PROPS]

const ALIGN_SELF_VALUES = {
  start: 'start',
  center: 'center',
  end: 'end',
  stretch: 'stretch',
  baseline: 'baseline',
}

const declarations = [
  displayDeclaration('block'),
  { property: 'flex', variable: 'flex', fallback: '0 1 auto' },
  { property: 'grid-column', variable: 'span', fallback: 'auto' },
  { property: 'grid-column-start', variable: 'start', fallback: 'auto' },
  { property: 'grid-row', variable: 'rowspan', fallback: 'auto' },
  { property: 'order', variable: 'order', fallback: '0' },
  { property: 'align-self', variable: 'alignself', fallback: 'auto' },
]

const styles = `
  .root {
    min-inline-size: 0;
  }

  ${responsiveStyles('.root', declarations)}
`

const toFlex = (value) => {
  if (value === true) return '1 1 0'
  if (value === false || value === 0) return '0 1 auto'
  if (Number.isInteger(value) && value > 0) return `${value} 1 0`
  log.warn(
    `${NAME}: 'grow' must be a boolean or a whole number 0 or greater — got '${value}', ignoring it`,
  )
  return null
}

const definition = {
  styles,
  onMount: (_instance, ...args) => {
    const { props, children } = splitArgs(NAME, args)
    warnUnknownProps(NAME, props, KNOWN_PROPS)
    const root = div({ class: 'root' }, ...children)
    const responsive = [
      ['display', resolveVisibility(NAME, props)],
      ['flex', resolveResponsive(NAME, 'grow', props.grow, toFlex)],
      ['span', resolveResponsive(NAME, 'span', props.span, toSpan(NAME))],
      ['start', resolveResponsive(NAME, 'start', props.start, toStart(NAME))],
      ['rowspan', resolveResponsive(NAME, 'rowSpan', props.rowSpan, toRowSpan(NAME))],
      ['order', resolveResponsive(NAME, 'order', props.order, toOrder(NAME))],
      [
        'alignself',
        resolveResponsive(
          NAME,
          'align',
          props.align,
          toKeyword(NAME, 'align', ALIGN_SELF_VALUES, 'stretch'),
        ),
      ],
    ]
    for (const [variable, resolved] of responsive) applyResponsive(root, variable, resolved)
    return root
  },
}

let create = null

export const item = (...args) => {
  create ??= component('imp-item', definition)
  return create(...args)
}
