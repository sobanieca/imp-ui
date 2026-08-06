import { defineComponent } from '../shared/define.js'
import { div } from '../../api/html.js'
import { toAlign, toDirection, toGrow, toJustify, toSpace, toWrap } from '../shared/layout.js'
import {
  applyResponsive,
  displayDeclaration,
  resolveResponsive,
  resolveVisibility,
  responsiveStyles,
  VISIBILITY_PROPS,
} from '../shared/responsive.js'
import { token } from '../shared/css.js'

const NAME = 'flex'

const KNOWN_PROPS = [
  'direction',
  'gap',
  'justify',
  'align',
  'wrap',
  'grow',
  'scroll',
  ...VISIBILITY_PROPS,
]

const declarations = [
  displayDeclaration('flex'),
  { property: 'flex-direction', variable: 'direction', fallback: 'row' },
  { property: 'gap', variable: 'gap', fallback: token('space-3') },
  { property: 'justify-content', variable: 'justify', fallback: 'flex-start' },
  { property: 'align-items', variable: 'align', fallback: 'stretch' },
  { property: 'flex-wrap', variable: 'wrap', fallback: 'nowrap' },
  { property: 'flex', variable: 'grow', fallback: '0 1 auto' },
]

const styles = () => `
  .root {
    box-sizing: border-box;
    min-inline-size: 0;
  }

  .scroll {
    overflow: auto;
    overscroll-behavior: contain;
    scrollbar-width: thin;
    min-block-size: 0;
  }

  ${responsiveStyles('.root', declarations)}
`

const definition = {
  styles,
  props: KNOWN_PROPS,
  onMount: (_instance, props, children) => {
    const root = div({ class: ['root', props.scroll ? 'scroll' : null] }, ...children)
    const responsive = [
      ['display', resolveVisibility(NAME, props)],
      ['direction', resolveResponsive(NAME, 'direction', props.direction, toDirection(NAME))],
      ['gap', resolveResponsive(NAME, 'gap', props.gap, toSpace(NAME, 'gap', 3))],
      ['justify', resolveResponsive(NAME, 'justify', props.justify, toJustify(NAME))],
      ['align', resolveResponsive(NAME, 'align', props.align, toAlign(NAME))],
      ['wrap', resolveResponsive(NAME, 'wrap', props.wrap, toWrap())],
      ['grow', resolveResponsive(NAME, 'grow', props.grow, toGrow(NAME))],
    ]
    for (const [variable, resolved] of responsive) applyResponsive(root, variable, resolved)
    return root
  },
}

export const flex = (...args) => defineComponent(NAME, () => definition)(...args)
