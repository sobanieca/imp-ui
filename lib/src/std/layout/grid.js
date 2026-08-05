import { defineComponent } from '../shared/define.js'
import { div } from '../../api/html.js'
import { toColumns, toGridPlacement, toSpace } from '../shared/layout.js'
import {
  applyResponsive,
  displayDeclaration,
  resolveResponsive,
  resolveVisibility,
  responsiveStyles,
  VISIBILITY_PROPS,
} from '../shared/responsive.js'
import { impLogger } from '../../logger.js'
import { token } from '../shared/css.js'

const NAME = 'grid'

const KNOWN_PROPS = ['columns', 'minItemWidth', 'gap', 'align', 'justify', ...VISIBILITY_PROPS]

const declarations = [
  displayDeclaration('grid'),
  { property: 'grid-template-columns', variable: 'columns', fallback: 'repeat(1, minmax(0, 1fr))' },
  { property: 'gap', variable: 'gap', fallback: token('space-3') },
  { property: 'align-items', variable: 'align', fallback: 'stretch' },
  { property: 'justify-items', variable: 'justify', fallback: 'stretch' },
]

const styles = () => `
  .root {
    min-inline-size: 0;
  }

  ${responsiveStyles('.root', declarations)}
`

const toTracks = (value) => {
  if (typeof value === 'string' && value.trim() !== '') {
    return `repeat(auto-fit, minmax(min(${value}, 100%), 1fr))`
  }
  impLogger.warn(
    `${NAME}: 'minItemWidth' must be a CSS length like '16rem' - got '${value}', ignoring it`,
  )
  return null
}

const resolveTracks = (props) => {
  if (props.minItemWidth === undefined) {
    return resolveResponsive(NAME, 'columns', props.columns, toColumns(NAME))
  }
  if (props.columns !== undefined) {
    impLogger.warn(`${NAME}: 'minItemWidth' and 'columns' both given - using 'minItemWidth'`)
  }
  return resolveResponsive(NAME, 'minItemWidth', props.minItemWidth, toTracks)
}

const definition = {
  styles,
  props: KNOWN_PROPS,
  onMount: (_instance, props, children) => {
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

export const grid = (...args) => defineComponent(NAME, () => definition)(...args)
