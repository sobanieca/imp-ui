import { component } from '../../component.js'
import { div } from '../../api/html.js'
import { splitArgs, warnUnknownProps } from '../shared/args.js'
import { toKeyword, toSpace } from '../shared/layout.js'
import {
  applyResponsive,
  displayDeclaration,
  resolveResponsive,
  resolveVisibility,
  responsiveStyles,
  VISIBILITY_PROPS,
} from '../shared/responsive.js'

const NAME = 'container'

const KNOWN_PROPS = ['size', 'padding', ...VISIBILITY_PROPS]

export const CONTAINER_SIZES = ['sm', 'md', 'lg', 'xl', 'full']

const SIZE_VALUES = {
  sm: 'var(--imp-container-sm, 40rem)',
  md: 'var(--imp-container-md, 48rem)',
  lg: 'var(--imp-container-lg, 64rem)',
  xl: 'var(--imp-container-xl, 80rem)',
  full: 'none',
}

const declarations = [
  displayDeclaration('block'),
  { property: 'max-inline-size', variable: 'size', fallback: SIZE_VALUES.lg },
  { property: 'padding-inline', variable: 'padding', fallback: 'var(--imp-space-4, 16px)' },
]

const styles = `
  .root {
    margin-inline: auto;
    inline-size: 100%;
  }

  ${responsiveStyles('.root', declarations)}
`

const definition = {
  styles,
  onMount: (_instance, ...args) => {
    const { props, children } = splitArgs(NAME, args)
    warnUnknownProps(NAME, props, KNOWN_PROPS)
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

let create = null

export const container = (...args) => {
  create ??= component('imp-container', definition)
  return create(...args)
}
