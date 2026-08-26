import { defineComponent } from '../shared/define.js'
import { div } from '../../api/html.js'
import { toColumns, toGridPlacement, toSpace } from '../shared/layout.js'
import { applyBox, BOX_PROPS, boxClass, boxStyles } from '../shared/box.js'
import { resolveResponsive } from '../shared/responsive.js'
import { impLogger } from '../../logger.js'
import { token } from '../shared/css.js'

const NAME = 'grid'

const DEFAULT_MIN_ITEM_WIDTH = '16rem'

const KNOWN_PROPS = ['columns', 'minItemWidth', 'gap', 'align', 'justify', ...BOX_PROPS]

const declarations = [
  {
    property: 'grid-template-columns',
    variable: 'columns',
    fallback: `repeat(auto-fit, minmax(min(${DEFAULT_MIN_ITEM_WIDTH}, 100%), 1fr))`,
  },
  { property: 'gap', variable: 'gap', fallback: token('space-4') },
  { property: 'align-items', variable: 'align', fallback: 'stretch' },
  { property: 'justify-items', variable: 'justify', fallback: 'stretch' },
]

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
  if (props.minItemWidth === undefined && props.columns !== undefined) {
    return resolveResponsive(NAME, 'columns', props.columns, toColumns(NAME))
  }
  if (props.minItemWidth !== undefined && props.columns !== undefined) {
    impLogger.warn(`${NAME}: 'minItemWidth' and 'columns' both given - using 'minItemWidth'`)
  }
  return resolveResponsive(
    NAME,
    'minItemWidth',
    props.minItemWidth ?? DEFAULT_MIN_ITEM_WIDTH,
    toTracks,
  )
}

const definition = {
  styles: () => boxStyles('grid', declarations),
  props: KNOWN_PROPS,
  onMount: (_instance, props, children) =>
    applyBox(NAME, div({ class: boxClass(props) }, ...children), props, [
      ['columns', resolveTracks(props)],
      ['gap', resolveResponsive(NAME, 'gap', props.gap, toSpace(NAME, 'gap', 4))],
      ['align', resolveResponsive(NAME, 'align', props.align, toGridPlacement(NAME, 'align'))],
      [
        'justify',
        resolveResponsive(NAME, 'justify', props.justify, toGridPlacement(NAME, 'justify')),
      ],
    ]),
}

export const grid = (...args) => defineComponent(NAME, () => definition)(...args)
