import { component } from '../../component.js'
import { div } from '../../api/html.js'
import { splitArgs, warnUnknownProps } from '../shared/args.js'
import { toColumns, toGridPlacement, toSpace } from '../shared/layout.js'
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

const NAME = 'grid'

const KNOWN_PROPS = ['columns', 'minItemWidth', 'gap', 'align', 'justify', ...VISIBILITY_PROPS]

const declarations = [
  displayDeclaration('grid'),
  { property: 'grid-template-columns', variable: 'columns', fallback: 'repeat(1, minmax(0, 1fr))' },
  { property: 'gap', variable: 'gap', fallback: 'var(--imp-space-3, 12px)' },
  { property: 'align-items', variable: 'align', fallback: 'stretch' },
  { property: 'justify-items', variable: 'justify', fallback: 'stretch' },
]

const styles = `
  .root {
    min-inline-size: 0;
  }

  ${responsiveStyles('.root', declarations)}
`

const toTracks = (value) => {
  if (typeof value === 'string' && value.trim() !== '') {
    return `repeat(auto-fit, minmax(min(${value}, 100%), 1fr))`
  }
  log.warn(
    `${NAME}: 'minItemWidth' must be a CSS length like '16rem' — got '${value}', ignoring it`,
  )
  return null
}

const resolveTracks = (props) => {
  if (props.minItemWidth === undefined) {
    return resolveResponsive(NAME, 'columns', props.columns, toColumns(NAME))
  }
  if (props.columns !== undefined) {
    log.warn(`${NAME}: 'minItemWidth' and 'columns' both given — using 'minItemWidth'`)
  }
  return resolveResponsive(NAME, 'minItemWidth', props.minItemWidth, toTracks)
}

const definition = {
  styles,
  onMount: (_instance, ...args) => {
    const { props, children } = splitArgs(NAME, args)
    warnUnknownProps(NAME, props, KNOWN_PROPS)
    const root = div({ class: 'root' }, ...children)
    const responsive = [
      ['display', resolveVisibility(NAME, props)],
      ['columns', resolveTracks(props)],
      ['gap', resolveResponsive(NAME, 'gap', props.gap, toSpace(NAME, 'gap', 3))],
      ['align', resolveResponsive(NAME, 'align', props.align, toGridPlacement(NAME, 'align'))],
      [
        'justify',
        resolveResponsive(NAME, 'justify', props.justify, toGridPlacement(NAME, 'justify')),
      ],
    ]
    for (const [variable, resolved] of responsive) applyResponsive(root, variable, resolved)
    return root
  },
}

let create = null

export const grid = (...args) => {
  create ??= component('imp-grid', definition)
  return create(...args)
}
