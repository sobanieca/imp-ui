import { defineComponent } from '../shared/define.js'
import { div } from '../../api/html.js'
import { toKeyword, toSpace } from '../shared/layout.js'
import {
  applyResponsive,
  displayDeclaration,
  resolveResponsive,
  resolveVisibility,
  responsiveStyles,
  VISIBILITY_PROPS,
} from '../shared/responsive.js'
import { token } from '../shared/css.js'

const NAME = 'container'

const KNOWN_PROPS = ['size', 'padding', ...VISIBILITY_PROPS]

export const CONTAINER_SIZES = ['sm', 'md', 'lg', 'xl', 'full']

const SIZE_VALUES = {
  sm: token('container-sm'),
  md: token('container-md'),
  lg: token('container-lg'),
  xl: token('container-xl'),
  full: 'none',
}

const declarations = [
  displayDeclaration('block'),
  { property: 'max-inline-size', variable: 'size', fallback: SIZE_VALUES.lg },
  { property: 'padding-inline', variable: 'padding', fallback: token('space-4') },
]

const styles = () => `
  .root {
    margin-inline: auto;
    inline-size: 100%;
  }

  ${responsiveStyles('.root', declarations)}
`

const definition = {
  styles,
  props: KNOWN_PROPS,
  onMount: (_instance, props, children) => {
    const root = div({ class: 'root' }, ...children)
    const responsive = [
      ['display', resolveVisibility(NAME, props)],
      [
        'size',
        resolveResponsive(NAME, 'size', props.size, toKeyword(NAME, 'size', SIZE_VALUES, 'lg')),
      ],
      ['padding', resolveResponsive(NAME, 'padding', props.padding, toSpace(NAME, 'padding', 4))],
    ]
    for (const [variable, resolved] of responsive) applyResponsive(root, variable, resolved)
    return root
  },
}

export const container = (...args) => defineComponent(NAME, () => definition)(...args)
